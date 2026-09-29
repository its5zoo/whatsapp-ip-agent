import prisma from '../db/prisma';

export interface LeadFilter {
  page?: number;
  limit?: number;
  flowType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AdminLeadService {
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
        answers: true,
        createdAt: true
      }
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
