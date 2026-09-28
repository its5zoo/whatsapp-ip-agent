export type QuestionType = 'choice' | 'text' | 'optional_text';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface ConversationData {
  flowType?: 'patent' | 'trademark' | 'design' | 'copyright' | 'notsure';
  [key: string]: string | undefined;
}

export interface ConversationState {
  currentQuestionId: string | null;
  data: ConversationData;
  isCompleted: boolean;
}

export interface TransitionResult {
  state: ConversationState;
  response: string;
  completed: boolean;
  data: ConversationData;
}

export type NextStateResolver = (answer: string, data: ConversationData) => string;

export interface QuestionDefinition {
  id: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  warning?: string;
  nextState: string | NextStateResolver;
}
