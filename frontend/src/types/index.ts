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
