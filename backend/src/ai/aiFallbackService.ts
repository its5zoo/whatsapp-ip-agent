import { AIInterpretation } from './types';
import { aiProvider } from './aiProvider';
import { QuestionOption } from '../engine/types';

const CREDENTIAL_VALUE_PATTERN =
  /\b(?:password|passwd|api[-_ ]?key|secret|token)\b\s*(?:is|=|:|->)\s*\S+/i;
const AUTHORIZATION_PATTERN = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/i;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const PEM_PATTERN = /-----BEGIN (?:[A-Z0-9 ]+ )?(?:PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY)-----/i;
const PAYMENT_PATTERN =
  /\b(?:card|credit card|debit card|bank account|account number|routing number)\b[^\n]{0,32}\b\d(?:[\s-]*\d){5,18}\b/i;
const PROMPT_INJECTION_PATTERN =
  /\b(?:ignore|disregard|override|bypass|forget)\b[^\n]{0,40}\b(?:previous|prior|system|questionnaire|instructions?|prompt)\b|\b(?:reveal|show|print)\b[^\n]{0,32}\b(?:system prompt|instructions?)\b/i;
const CODE_PATTERN =
  /```|<\/?[a-z][^>]*>|^\s*[{[]|^\s*(?:const|let|var|function|class|import|export|select|insert|update|delete)\b|\b(?:const|let|var|function|class)\s+\w+\s*=|^\s*[\w.-]+\s*=\s*\S+/im;

function isUnsafeFallbackInput(input: string): boolean {
  return input.includes('\n') ||
    input.includes('\r') ||
    CREDENTIAL_VALUE_PATTERN.test(input) ||
    AUTHORIZATION_PATTERN.test(input) ||
    JWT_PATTERN.test(input) ||
    PEM_PATTERN.test(input) ||
    PAYMENT_PATTERN.test(input) ||
    PROMPT_INJECTION_PATTERN.test(input) ||
    CODE_PATTERN.test(input);
}

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
    if (isUnsafeFallbackInput(truncatedMessage)) {
      return null;
    }

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

    const aiResult = await aiProvider.callModel(systemInstruction, prompt);

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
