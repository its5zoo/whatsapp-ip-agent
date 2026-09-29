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

const completedPrompt = `You have already submitted an enquiry with us.

1. Yes, start a new enquiry
2. No, I need help with my previous enquiry`;

export class ConversationService {
  async handleMessage(channel: string, externalUserId: string, message: string, now = new Date()): Promise<string> {
    // 1. Find or create conversation
    let conversation = await conversationRepository.findByChannelAndUser(channel, externalUserId);
    const isNewConversation = !conversation;
    
    if (!conversation) {
      conversation = await conversationRepository.create(channel, externalUserId);
    }

    // 2. Reconstruct ConversationState
    const state: ConversationState = {
      currentQuestionId: conversation.currentQuestionId,
      data: conversation.data as ConversationData,
      isCompleted: conversation.isCompleted
    };

    const data = state.data;
    const pending = getContinuityMeta(data);
    const stale = now.getTime() - conversation.updatedAt.getTime() >= STALE_AFTER_MS;

    if (isNewConversation) {
      const response = `${WELCOME_MESSAGE}\n\n${getQuestionResponse(QUESTIONNAIRE.main_menu)}`;
      await conversationRepository.updateState(conversation.id, 'main_menu', {}, false);
      return response;
    }

    if (pending) {
      if (isCommand(message)) {
        const commandResult = processMessage({ ...state, data: withoutContinuityMeta(data) }, message);
        await conversationRepository.updateState(
          conversation.id,
          commandResult.state.currentQuestionId,
          withContinuityMeta(commandResult.state.data, pending.continuityPrompt),
          commandResult.state.isCompleted
        );
        return commandResult.response;
      }

      const input = message.trim();
      if (input === '1') {
        if (pending.continuityPrompt === 'incomplete') {
          await conversationRepository.updateState(
            conversation.id,
            state.currentQuestionId,
            withoutContinuityMeta(data),
            false
          );
          const currentQuestion = QUESTIONNAIRE[state.currentQuestionId || 'main_menu'];
          return getQuestionResponse(currentQuestion || QUESTIONNAIRE.main_menu);
        }

        await conversationRepository.updateState(conversation.id, 'main_menu', {}, false);
        return getQuestionResponse(QUESTIONNAIRE.main_menu);
      }

      if (input === '2') {
        if (pending.continuityPrompt === 'incomplete') {
          await conversationRepository.updateState(conversation.id, 'main_menu', {}, false);
          return getQuestionResponse(QUESTIONNAIRE.main_menu);
        }

        await conversationRepository.updateState(
          conversation.id,
          state.currentQuestionId,
          withoutContinuityMeta(data),
          state.isCompleted
        );
        return ENGINE_CONFIG.HELP_INFO;
      }

      const prompt = pending.continuityPrompt === 'incomplete'
        ? incompletePrompt(withoutContinuityMeta(data))
        : completedPrompt;
      await conversationRepository.updateState(
        conversation.id,
        state.currentQuestionId,
        data,
        state.isCompleted
      );
      return `Invalid choice. Please reply with 1 or 2.\n\n${prompt}`;
    }

    if (stale && !isCommand(message)) {
      const prompt = state.isCompleted ? completedPrompt : incompletePrompt(data);
      const promptType: ContinuityPrompt = state.isCompleted ? 'completed' : 'incomplete';
      await conversationRepository.updateState(
        conversation.id,
        state.currentQuestionId,
        withContinuityMeta(data, promptType),
        state.isCompleted
      );
      return prompt;
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
      result.state.isCompleted
    );

    // 5. If completed, extract Lead fields and upsert Lead
    if (result.completed) {
      const leadAnswers = withoutContinuityMeta(result.state.data);
      
      const leadData = {
        name: leadAnswers['shared_name'] || '',
        organization: leadAnswers['shared_org'] || '',
        email: leadAnswers['shared_email'] || '',
        mobile: leadAnswers['shared_mobile'] || '',
        city: leadAnswers['shared_city'] || '',
        preferredComm: leadAnswers['shared_comm'] || '',
        phoneCallTime: leadAnswers['shared_phone_time'] || null,
        flowType: leadAnswers['flowType'] || 'unknown',
        answers: leadAnswers as any
      };

      const lead = await leadRepository.upsertFromConversation(conversation.id, leadData);

      // Fire n8n only if this is the moment the conversation became completed
      if (!conversation.isCompleted) {
        n8nNotifier.notifyNewLead(lead).catch(err => {
          // Fire-and-forget: already logged inside notifier, but catch here just in case
        });
      }
    }

    // 6. Return response
    return result.response;
  }
}

export const conversationService = new ConversationService();
