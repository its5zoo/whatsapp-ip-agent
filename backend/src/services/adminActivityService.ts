import { ActivityType, Prisma, PrismaClient } from '@prisma/client';
import prisma from '../db/prisma';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const ACTIVITY_TYPES = [
  'LEAD_CREATED',
  'LEAD_STATUS_CHANGED',
  'FOLLOW_UP_CREATED',
  'FOLLOW_UP_RESCHEDULED',
  'FOLLOW_UP_COMPLETED',
  'FOLLOW_UP_CANCELLED',
  'NOTE_ADDED',
  'NOTE_EDITED',
  'NOTE_DELETED'
] as const;

export async function createActivity(
  db: DatabaseClient,
  leadId: string,
  type: typeof ACTIVITY_TYPES[number],
  description: string
) {
  return db.activity.create({
    data: { leadId, type: type as ActivityType, description },
    select: { id: true, leadId: true, type: true, description: true, createdAt: true }
  });
}

export class AdminActivityService {
  async listForLead(leadId: string) {
    return prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, leadId: true, type: true, description: true, createdAt: true }
    });
  }
}

export const adminActivityService = new AdminActivityService();
