import { AIInterpretation } from './types';
import { aiProvider } from './aiProvider';
import { QuestionOption } from '../engine/types';

export class AIFallbackService {
  async interpretChoice(
    userMessage: string,
    questionText: string,
    options: QuestionOption[] | undefined
  ): Promise<AIInterpretation | null> {
    if (!options || options.length === 0) {
      return null;
    }

    const truncatedMessage = userMessage.slice(0, 500);

    const systemInstruction = `You are an AI assistant helping a user answer a questionnaire.
Your task is ONLY to map the user's natural language input to one of the provided numbered options for the CURRENT question.

DO NOT invent new options.
DO NOT process global commands like BACK or HELP. If the user is asking to go back or for help, map it to the closest option if applicable, or return UNKNOWN.
DO NOT guess if the user's input is unrelated or ambiguous.

Return the corresponding optionId and your confidence level (0.0 to 1.0) that the user intended this option.
If you cannot map the input to any of the specific options, return "UNKNOWN" for optionId and 0.0 for confidence.`;

    const prompt = `Question:
${questionText}

User said: "${truncatedMessage}"`;

    const aiResult = await aiProvider.callGemini(systemInstruction, prompt);

    if (!aiResult) {
      return null;
    }

    // 1. Is it a valid object with required fields?
    if (typeof aiResult.optionId !== 'string' || typeof aiResult.confidence !== 'number') {
      console.warn('[AI Fallback] Invalid structure returned by AI', aiResult);
      return null;
    }

    // 2. Is confidence in range?
    if (aiResult.confidence < 0.0 || aiResult.confidence > 1.0) {
      console.warn('[AI Fallback] Invalid confidence value', aiResult.confidence);
      return null;
    }

    // 3. Is it UNKNOWN?
    if (aiResult.optionId === 'UNKNOWN') {
      return null;
    }

    // 4. Is the optionId actually in the valid options list?
    const isValidOption = options.some(o => o.id === aiResult.optionId);
    if (!isValidOption) {
      console.warn(`[AI Fallback] Hallucinated or invalid optionId: ${aiResult.optionId}`);
      return null;
    }

    return {
      optionId: aiResult.optionId,
      confidence: aiResult.confidence
    };
  }
}

export const aiFallbackService = new AIFallbackService();
