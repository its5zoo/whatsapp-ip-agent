export interface Lead {
  id: string;
  name: string;
  organization: string;
  email: string;
  mobile: string;
  city: string;
  flowType: string;
  status: LeadStatus;
  preferredComm: string;
  phoneCallTime?: string | null;
  createdAt: string;
  answers?: unknown;
  decodedAnswers?: {
    questionId: string;
    questionLabel: string;
    rawValue: string;
    displayValue: string;
  }[];
  conversationId?: string;
  otherEnquiries?: {
    id: string;
    name: string;
    flowType: string;
    status: LeadStatus;
    createdAt: string;
  }[];
}

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CONVERTED'
  | 'NOT_INTERESTED'
  | 'CLOSED';

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

export interface LeadStats {
  totalLeads: number;
  byFlowType: Record<string, number>;
}

export interface LeadsResponse {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface FollowUp {
  id: string;
  leadId: string;
  scheduledAt: string;
  note: string;
  status: FollowUpStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    name: string;
    organization: string;
  };
}

export interface InternalNote {
  id: string;
  leadId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  leadId: string;
  type: string;
  description: string;
  createdAt: string;
}
