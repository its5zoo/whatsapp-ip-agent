import prisma from '../db/prisma';
import { createActivity } from './adminActivityService';

export const MAX_NOTE_LENGTH = 5000;

const noteSelect = {
  id: true,
  leadId: true,
  content: true,
  createdAt: true,
  updatedAt: true
} as const;

export class AdminNoteService {
  async listForLead(leadId: string) {
    return prisma.internalNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: noteSelect
    });
  }

  async create(leadId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) return null;
      const note = await tx.internalNote.create({ data: { leadId, content }, select: noteSelect });
      await createActivity(tx, leadId, 'NOTE_ADDED', 'Internal note added');
      return note;
    });
  }

  async update(id: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const note = await tx.internalNote.findUnique({ where: { id }, select: { leadId: true } });
      if (!note) return null;
      const updated = await tx.internalNote.update({ where: { id }, data: { content }, select: noteSelect });
      await createActivity(tx, note.leadId, 'NOTE_EDITED', 'Internal note edited');
      return updated;
    });
  }

  async delete(id: string) {
    return prisma.$transaction(async (tx) => {
      const note = await tx.internalNote.findUnique({ where: { id }, select: { leadId: true } });
      if (!note) return null;
      await tx.internalNote.delete({ where: { id } });
      await createActivity(tx, note.leadId, 'NOTE_DELETED', 'Internal note deleted');
      return { id };
    });
  }
}

export const adminNoteService = new AdminNoteService();
