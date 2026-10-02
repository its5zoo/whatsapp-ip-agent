import { conversationRepository } from '../db/repositories/conversationRepository';
import { leadRepository } from '../db/repositories/leadRepository';
import { processMessage } from '../engine/engine';
import { ConversationState, ConversationData } from '../engine/types';
import { aiFallbackService } from '../ai/aiFallbackService';
import { env } from '../config/env';
import { QUESTIONNAIRE } from '../engine/questions';
import { n8nNotifier } from './n8nNotifier';
import { ENGINE_CONFIG } from '../engine/constants';
import { getQuestionResponse } from '../engine/engine';
import { LeadCreateInput } from '../db/repositories/leadRepository';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { whatsappOutboundMessageRepository } from '../db/repositories/whatsappOutboundMessageRepository';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const CONTINUITY_META_KEY = '_conversationMeta';
const WELCOME_MESSAGE = `Welcome to GenioBrain IP Solution!
Thank you for connecting with us. We help startups, businesses, researchers, universities and innovators protect and manage their Intellectual Property (IP) through:
Patents
Trademarks
Designs
Copyrights
To help us understand your requirement and connect you with the right IP professional, please answer a few quick questions.
It will take only 2–3 minutes.`;

type ContinuityPrompt = 'incomplete' | 'completed';
type ContinuityMeta = { continuityPrompt: ContinuityPrompt };
type ContinuityData = ConversationData & { [CONTINUITY_META_KEY]?: ContinuityMeta };

const isCommand = (message: string): boolean =>
  ['HELP', 'SERVICES', 'CONSULTATION', 'BACK'].includes(message.trim().toUpperCase());

const getContinuityMeta = (data: ConversationData): ContinuityMeta | undefined => {
  const meta = (data as ContinuityData)[CONTINUITY_META_KEY];
  if (meta?.continuityPrompt === 'incomplete' || meta?.continuityPrompt === 'completed') {
    return meta;
  }
  return undefined;
};

const withoutContinuityMeta = (data: ConversationData): ConversationData => {
  const clean = { ...data } as ContinuityData;
  delete clean[CONTINUITY_META_KEY];
  return clean;
};

const withContinuityMeta = (data: ConversationData, prompt: ContinuityPrompt): ConversationData => ({
  ...withoutContinuityMeta(data),
  [CONTINUITY_META_KEY]: { continuityPrompt: prompt }
} as unknown as ConversationData);

const safeSummary = (data: ConversationData): string => {
  const lines: string[] = [];
  const flowLabels: Record<string, string> = {
    patent: 'Patent',
    trademark: 'Trademark',
    design: 'Design Registration',
    copyright: 'Copyright',
    notsure: 'Not sure'
  };
  if (data.flowType && flowLabels[data.flowType]) {
    lines.push(`- IP Type: ${flowLabels[data.flowType]}`);
  }
  return lines.length ? `\n\nYour previous enquiry included:\n${lines.join('\n')}` : '';
};

const incompletePrompt = (data: ConversationData): string =>
  `Welcome back.${safeSummary(data)}

Would you like to continue your previous enquiry or start a new one?

1. Continue previous enquiry
2. Start new enquiry`;

const completedPrompt = `You have already submitted an enquiry with GenioBrain IP Solution.

Would you like to create a new enquiry?

1. Yes – Start a new enquiry
2. No – Keep my existing enquiry`;
const completedAcknowledgement = 'Your existing enquiry will be kept. Our team can help with it if needed.';
const completedClosedResponse =
  'Your previous enquiry has already been submitted. Please reply HELP to speak to our team, or BACK to start a new enquiry.';

const getWhatsAppMobile = (externalUserId: string): string =>
  externalUserId.endsWith('@g.us')
    ? ''
    : externalUserId.split('@', 1)[0].replace(/^\+/, '');

const buildLeadData = (data: ConversationData): LeadCreateInput => ({
  name: data['shared_name'] || '',
  organization: data['shared_org'] || '',
  email: data['shared_email'] || '',
  mobile: data['shared_mobile'] || '',
  city: data['shared_city'] || '',
  preferredComm: data['shared_comm'] || '',
  phoneCallTime: data['shared_phone_time'] || null,
  flowType: data['flowType'] || 'unknown',
  answers: data as any
});

export class ConversationService {
  async handleMessage(
    channel: string,
    externalUserId: string,
    message: string,
    now = new Date(),
    messageId?: string
  ): Promise<string> {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${channel}:${externalUserId}`}, 0))`;

      if (messageId) {
        try {
          await tx.processedWhatsappMessage.create({
            data: { messageId, waId: externalUserId }
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            return null;
          }
          throw error;
        }
      }

      const result = await this.handleMessageInTransaction(channel, externalUserId, message, now, tx);
      if (messageId && result.response) {
        await whatsappOutboundMessageRepository.create({
          inboundMessageId: messageId,
          waId: externalUserId,
          text: result.response
        }, tx);
      }
      return result;
    });

    if (!result) {
      return '';
    }

    for (const lead of result.notifications) {
      n8nNotifier.notifyNewLead(lead).catch(() => {});
    }

    return result.response;
  }

  private async handleMessageInTransaction(
    channel: string,
    externalUserId: string,
    message: string,
    now: Date,
    db: Prisma.TransactionClient
  ): Promise<{ response: string; notifications: any[] }> {
    const notifications: any[] = [];
    // 1. Find or create conversation
    let conversation = await conversationRepository.findByChannelAndUser(channel, externalUserId, db);
    const isNewConversation = !conversation;
    
    if (!conversation) {
      conversation = await conversationRepository.create(channel, externalUserId, db);
    }

    // 2. Reconstruct ConversationState
    const storedData = conversation.data as ConversationData;
    const data = channel === 'whatsapp' && !storedData.shared_mobile
      ? { ...storedData, shared_mobile: getWhatsAppMobile(externalUserId) }
      : storedData;
    const state: ConversationState = {
      currentQuestionId: conversation.currentQuestionId,
      data,
      isCompleted: conversation.isCompleted
    };

    const pending = getContinuityMeta(data);
    const stale = now.getTime() - conversation.updatedAt.getTime() >= STALE_AFTER_MS;

    if (conversation.isCompleted && !(await leadRepository.findByConversationId(conversation.id, db))) {
      const recoveredLead = await leadRepository.upsertFromConversation(
        conversation.id,
        buildLeadData(withoutContinuityMeta(data)),
        db
      );
      notifications.push(recoveredLead);
    }

    if (isNewConversation) {
      const response = `${WELCOME_MESSAGE}\n\n${getQuestionResponse(QUESTIONNAIRE.main_menu)}`;
      const initialData = channel === 'whatsapp'
        ? { shared_mobile: getWhatsAppMobile(externalUserId) }
        : {};
      await conversationRepository.updateState(conversation.id, 'main_menu', initialData, false, db);
      return { response, notifications };
    }

    if (pending) {
      if (pending.continuityPrompt === 'completed' && message.trim().toUpperCase() === 'BACK') {
        return { response: completedPrompt, notifications };
      }

      if (isCommand(message)) {
        const commandResult = processMessage({ ...state, data: withoutContinuityMeta(data) }, message);
        await conversationRepository.updateState(
          conversation.id,
          commandResult.state.currentQuestionId,
          withoutContinuityMeta(commandResult.state.data),
          commandResult.state.isCompleted,
          db
        );
        return { response: commandResult.response, notifications };
      }

      const input = message.trim();
      if (input === '1') {
        if (pending.continuityPrompt === 'incomplete') {
          await conversationRepository.updateState(
            conversation.id,
            state.currentQuestionId,
            withoutContinuityMeta(data),
            false,
            db
          );
          const currentQuestion = QUESTIONNAIRE[state.currentQuestionId || 'main_menu'];
          return { response: getQuestionResponse(currentQuestion || QUESTIONNAIRE.main_menu), notifications };
        }

        await conversationRepository.updateState(conversation.id, 'main_menu', {}, false, db);
        return { response: getQuestionResponse(QUESTIONNAIRE.main_menu), notifications };
      }

      if (input === '2') {
        if (pending.continuityPrompt === 'incomplete') {
          await conversationRepository.updateState(conversation.id, 'main_menu', {}, false, db);
          return { response: getQuestionResponse(QUESTIONNAIRE.main_menu), notifications };
        }

        await conversationRepository.updateState(
          conversation.id,
          state.currentQuestionId,
          withoutContinuityMeta(data),
          state.isCompleted,
          db
        );
        return { response: completedAcknowledgement, notifications };
      }

      const prompt = pending.continuityPrompt === 'completed'
        ? completedPrompt
        : incompletePrompt(withoutContinuityMeta(data));
      await conversationRepository.updateState(
        conversation.id,
        state.currentQuestionId,
        data,
        state.isCompleted,
        db
      );
      return { response: `Invalid choice. Please reply with 1 or 2.\n\n${prompt}`, notifications };
    }

    if (conversation.isCompleted && message.trim().toUpperCase() === 'BACK') {
      await conversationRepository.updateState(
        conversation.id,
        state.currentQuestionId,
        withContinuityMeta(data, 'completed'),
        state.isCompleted,
        db
      );
      return { response: completedPrompt, notifications };
    }

    if (conversation.isCompleted && !isCommand(message)) {
      return { response: completedClosedResponse, notifications };
    }

    if (stale && !isCommand(message)) {
      const prompt = incompletePrompt(data);
      const promptType: ContinuityPrompt = 'incomplete';
      await conversationRepository.updateState(
        conversation.id,
        state.currentQuestionId,
        withContinuityMeta(data, promptType),
        state.isCompleted,
        db
      );
      return { response: prompt, notifications };
    }

    // 3. Call processMessage (engine logic)
    let result = processMessage({ ...state, data: withoutContinuityMeta(data) }, message);

    // AI Fallback: only for 'choice' questions where deterministic engine rejected input
    const currentQId = state.currentQuestionId || 'main_menu';
    const currentQuestion = QUESTIONNAIRE[currentQId];

    if (
      result.response.startsWith('Invalid option') &&
      currentQuestion?.type === 'choice' &&
      env.AI_API_KEY
    ) {
      const aiResult = await aiFallbackService.interpretChoice(
        message,
        currentQuestion.text,
        currentQuestion.options
      );

      if (aiResult && aiResult.confidence >= env.AI_CONFIDENCE_THRESHOLD) {
        // Validation check happens inside the aiFallbackService already,
        // but just to be sure we can check it again, or trust the service.
        // Re-run the engine with the AI-mapped option ID
        result = processMessage(state, aiResult.optionId);
      }
    }

    // 4. Persist the returned state
    await conversationRepository.updateState(
      conversation.id,
      result.state.currentQuestionId,
      result.state.data,
      result.state.isCompleted,
      db
    );

    // 5. If completed, extract Lead fields and upsert Lead
    if (result.completed) {
      const leadAnswers = withoutContinuityMeta(result.state.data);
      const lead = await leadRepository.upsertFromConversation(
        conversation.id,
        buildLeadData(leadAnswers),
        db
      );

      // Fire n8n only if this is the moment the conversation became completed
      if (!conversation.isCompleted) {
        notifications.push(lead);
      }
    }

    // 6. Return response
    return { response: result.response, notifications };
  }
}

export const conversationService = new ConversationService();
