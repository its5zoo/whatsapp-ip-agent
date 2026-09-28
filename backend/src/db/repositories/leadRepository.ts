import prisma from '../prisma';
import { Lead } from '@prisma/client';

export interface LeadCreateInput {
  name: string;
  organization: string;
  email: string;
  mobile: string;
  city: string;
  preferredComm: string;
  phoneCallTime: string | null;
  flowType: string;
  answers: any;
}

export class LeadRepository {
  async upsertFromConversation(conversationId: string, leadData: LeadCreateInput): Promise<Lead> {
    return prisma.lead.upsert({
      where: { conversationId },
      create: {
        conversationId,
        ...leadData
      },
      update: leadData
    });
  }

  async findByConversationId(conversationId: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { conversationId }
    });
  }
}

export const leadRepository = new LeadRepository();
