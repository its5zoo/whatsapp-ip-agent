import { FollowUpStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { createActivity } from './adminActivityService';

export const FOLLOW_UP_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type AdminFollowUpStatus = typeof FOLLOW_UP_STATUSES[number];

export type FollowUpFilter = 'upcoming' | 'overdue' | 'completed';

export interface FollowUpInput {
  leadId: string;
  scheduledAt: Date;
  note: string;
}

const followUpSelect = {
  id: true,
  leadId: true,
  scheduledAt: true,
  note: true,
  status: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  lead: {
    select: {
      id: true,
      name: true,
      organization: true
    }
  }
} as const;

export class AdminFollowUpService {
  async list(filter?: FollowUpFilter, leadId?: string) {
    const now = new Date();
    const where: Record<string, unknown> = {};

    if (leadId) where.leadId = leadId;
    if (filter === 'completed') {
      where.status = FollowUpStatus.COMPLETED;
    } else if (filter === 'upcoming') {
      where.status = FollowUpStatus.PENDING;
      where.scheduledAt = { gte: now };
    } else if (filter === 'overdue') {
      where.status = FollowUpStatus.PENDING;
      where.scheduledAt = { lt: now };
    }

    return prisma.followUp.findMany({
      where,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      select: followUpSelect
    });
  }

  async findById(id: string) {
    return prisma.followUp.findUnique({ where: { id }, select: followUpSelect });
  }

  async create(input: FollowUpInput) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
    if (!lead) return null;

    return prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          leadId: input.leadId,
          scheduledAt: input.scheduledAt,
          note: input.note,
        },
        select: followUpSelect
      });
      await createActivity(tx, input.leadId, 'FOLLOW_UP_CREATED', 'Follow-up scheduled');
      return followUp;
    });
  }

  async update(id: string, data: { scheduledAt?: Date; note?: string }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.followUp.findUnique({
          where: { id },
          select: { leadId: true, scheduledAt: true, note: true }
        });
        if (!existing) return null;
        const followUp = await tx.followUp.update({ where: { id }, data, select: followUpSelect });
        const scheduledChanged = data.scheduledAt
          && data.scheduledAt.getTime() !== existing.scheduledAt.getTime();
        const noteChanged = data.note !== undefined && data.note !== existing.note;
        if (scheduledChanged || noteChanged) {
          const changes = [
            scheduledChanged
              ? `from ${existing.scheduledAt.toISOString()} to ${data.scheduledAt!.toISOString()}`
              : undefined,
            noteChanged ? 'note changed' : undefined
          ].filter(Boolean).join('; ');
          await createActivity(
            tx,
            existing.leadId,
            'FOLLOW_UP_RESCHEDULED',
            `Follow-up rescheduled${changes ? ` (${changes})` : ''}`
          );
        }
        return followUp;
      });
    } catch (error: any) {
      if (error?.code === 'P2025') return null;
      throw error;
    }
  }

  async setStatus(id: string, status: AdminFollowUpStatus) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.followUp.findUnique({ where: { id }, select: { leadId: true, status: true } });
        if (!existing) return null;
        const followUp = await tx.followUp.update({
          where: { id },
          data: {
            status: status as FollowUpStatus,
            completedAt: status === 'COMPLETED' ? new Date() : null
          },
          select: followUpSelect
        });
        if (existing.status !== status) {
          const type = status === 'COMPLETED' ? 'FOLLOW_UP_COMPLETED' : 'FOLLOW_UP_CANCELLED';
          const description = status === 'COMPLETED' ? 'Follow-up completed' : 'Follow-up cancelled';
          await createActivity(tx, existing.leadId, type, description);
        }
        return followUp;
      });
    } catch (error: any) {
      if (error?.code === 'P2025') return null;
      throw error;
    }
  }
}

export const adminFollowUpService = new AdminFollowUpService();
