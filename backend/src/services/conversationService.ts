import { conversationRepository } from '../db/repositories/conversationRepository';
import { leadRepository } from '../db/repositories/leadRepository';
import { processMessage } from '../engine/engine';
import { ConversationState, ConversationData } from '../engine/types';
import { aiFallbackService } from '../ai/aiFallbackService';
import { env } from '../config/env';
import { QUESTIONNAIRE } from '../engine/questions';

export class ConversationService {
  async handleMessage(channel: string, externalUserId: string, message: string): Promise<string> {
    // 1. Find or create conversation
    let conversation = await conversationRepository.findByChannelAndUser(channel, externalUserId);
    
    if (!conversation) {
      conversation = await conversationRepository.create(channel, externalUserId);
    }

    // 2. Reconstruct ConversationState
    const state: ConversationState = {
      currentQuestionId: conversation.currentQuestionId,
      data: conversation.data as ConversationData,
      isCompleted: conversation.isCompleted
    };

    // 3. Call processMessage (engine logic)
    let result = processMessage(state, message);

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
      const data = result.state.data;
      
      const leadData = {
        name: data['shared_name'] || '',
        organization: data['shared_org'] || '',
        email: data['shared_email'] || '',
        mobile: data['shared_mobile'] || '',
        city: data['shared_city'] || '',
        preferredComm: data['shared_comm'] || '',
        phoneCallTime: data['shared_phone_time'] || null,
        flowType: data['flowType'] || 'unknown',
        answers: data as any
      };

      await leadRepository.upsertFromConversation(conversation.id, leadData);
    }

    // 6. Return response
    return result.response;
  }
}

export const conversationService = new ConversationService();
