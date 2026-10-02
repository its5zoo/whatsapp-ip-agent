import prisma from '../db/prisma';
import { LeadStatus } from '@prisma/client';
import { createActivity } from './adminActivityService';

export interface LeadFilter {
  page?: number;
  limit?: number;
  flowType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'IN_PROGRESS',
  'ON_HOLD',
  'CONVERTED',
  'NOT_INTERESTED',
  'CLOSED'
] as const;

export type AdminLeadStatus = typeof LEAD_STATUSES[number];

const readableStatus = (status: AdminLeadStatus) =>
  status.toLowerCase().replace(/(^|_)(\w)/g, (_, separator, character) => `${separator ? ' ' : ''}${character.toUpperCase()}`);

export class AdminLeadService {
  async getIncompleteConversations() {
    return prisma.conversation.findMany({
      where: { isCompleted: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        channel: true,
        externalUserId: true,
        currentQuestionId: true,
        isCompleted: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async getIncompleteConversationById(id: string) {
    return prisma.conversation.findFirst({
      where: { id, isCompleted: false },
      select: {
        id: true,
        channel: true,
        externalUserId: true,
        currentQuestionId: true,
        isCompleted: true,
        createdAt: true,
        updatedAt: true,
        data: true
      }
    });
  }

  async getLeads(filter: LeadFilter) {
    let page = filter.page !== undefined ? Number(filter.page) : 1;
    let limit = filter.limit !== undefined ? Number(filter.limit) : 20;

    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.flowType) {
      where.flowType = filter.flowType;
    }
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { organization: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { mobile: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Safe sorting
    const allowedSortFields = ['createdAt', 'name', 'flowType'];
    const sortBy = allowedSortFields.includes(filter.sortBy || '') ? filter.sortBy! : 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 'asc' : 'desc';

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          organization: true,
          email: true,
          mobile: true,
          city: true,
          flowType: true,
          preferredComm: true,
          status: true,
          createdAt: true
        }
      }),
      prisma.lead.count({ where })
    ]);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getLeadById(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        conversationId: true,
        name: true,
        organization: true,
        email: true,
        mobile: true,
        city: true,
        preferredComm: true,
        phoneCallTime: true,
        flowType: true,
        status: true,
        answers: true,
        createdAt: true
      }
    });
  }

  async updateLeadStatus(id: string, status: AdminLeadStatus) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findUnique({ where: { id }, select: { status: true } });
      if (!existing) {
        const error = new Error('Lead not found');
        (error as Error & { code?: string }).code = 'P2025';
        throw error;
      }
      const lead = await tx.lead.update({
        where: { id },
        data: { status: status as LeadStatus },
        select: {
          id: true,
          conversationId: true,
          name: true,
          organization: true,
          email: true,
          mobile: true,
          city: true,
          preferredComm: true,
          phoneCallTime: true,
          flowType: true,
          status: true,
          answers: true,
          createdAt: true
        }
      });
      if (existing.status !== status) {
        await createActivity(tx, id, 'LEAD_STATUS_CHANGED', `Status changed to ${readableStatus(status)}`);
      }
      return lead;
    });
  }

  async getStats() {
    const [totalLeads, byFlowType] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['flowType'],
        _count: true
      })
    ]);

    return {
      totalLeads,
      byFlowType: byFlowType.reduce((acc, curr) => {
        acc[curr.flowType] = curr._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const adminLeadService = new AdminLeadService();
