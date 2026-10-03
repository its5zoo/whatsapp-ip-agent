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
  async createFromConversation(
    conversationId: string,
    leadData: LeadCreateInput,
    db: DatabaseClient = prisma
  ): Promise<Lead> {
    return db.lead.create({
      data: {
        conversationId,
        ...leadData
      }
    });
  }

  async findByConversationId(
    conversationId: string,
    db: DatabaseClient = prisma
  ): Promise<Lead | null> {
    return db.lead.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async listByConversationId(
    conversationId: string,
    db: DatabaseClient = prisma
  ): Promise<Lead[]> {
    return db.lead.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const leadRepository = new LeadRepository();
