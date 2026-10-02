import prisma from '../prisma';
import { Lead, Prisma, PrismaClient } from '@prisma/client';

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

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class LeadRepository {
  async upsertFromConversation(
    conversationId: string,
    leadData: LeadCreateInput,
    db: DatabaseClient = prisma
  ): Promise<Lead> {
    return db.lead.upsert({
      where: { conversationId },
      create: {
        conversationId,
        ...leadData
      },
      update: leadData
    });
  }

  async findByConversationId(
    conversationId: string,
    db: DatabaseClient = prisma
  ): Promise<Lead | null> {
    return db.lead.findUnique({
      where: { conversationId }
    });
  }
}

export const leadRepository = new LeadRepository();
