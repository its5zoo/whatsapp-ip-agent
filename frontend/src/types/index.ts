export interface Lead {
  id: string;
  name: string;
  organization: string;
  email: string;
  mobile: string;
  city: string;
  flowType: string;
  preferredComm: string;
  createdAt: string;
  answers?: any;
  decodedAnswers?: {
    questionId: string;
    questionLabel: string;
    rawValue: string;
    displayValue: string;
  }[];
}

export interface IncompleteConversation {
  id: string;
  channel: string;
  externalUserId: string;
  currentQuestionId: string | null;
  isCompleted: false;
  createdAt: string;
  updatedAt: string;
  data?: Record<string, unknown>;
}
