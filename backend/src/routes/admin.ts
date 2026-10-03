import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { authService } from '../services/authService';
import { verifyAuthCookie } from '../middleware/auth';
import { adminLeadService, LeadFilter, LEAD_STATUSES, AdminLeadStatus } from '../services/adminLeadService';
import { decodeAnswers } from '../engine/answerDecoder';
import {
  adminFollowUpService,
  FollowUpFilter
} from '../services/adminFollowUpService';
import { adminNoteService, MAX_NOTE_LENGTH } from '../services/adminNoteService';
import { adminActivityService } from '../services/adminActivityService';

const adminRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  const failedLoginAttempts = new Map<string, number[]>();
  const loginAttemptLimit = 5;
  const loginAttemptWindowMs = 15 * 60 * 1000;

  const loginKey = (request: FastifyRequest) => {
    const body = request.body as { username?: string } | undefined;
    return `${request.ip}:${body?.username ?? ''}`;
  };

  const rejectExcessiveLoginAttempts = async (request: FastifyRequest, reply: FastifyReply) => {
    const key = loginKey(request);
    const cutoff = Date.now() - loginAttemptWindowMs;
    const attempts = (failedLoginAttempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (attempts.length >= loginAttemptLimit) {
      failedLoginAttempts.set(key, attempts);
      return reply
        .status(429)
        .send(Object.assign(new Error('Too many login attempts'), { statusCode: 429 }));
    }
    failedLoginAttempts.set(key, attempts);
  };

  // Public Login Route
  server.post('/admin/login', {
    preHandler: rejectExcessiveLoginAttempts,
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body as any;

    const isValid = await authService.validateLogin(username, password);
    if (!isValid) {
      const key = loginKey(request);
      const cutoff = Date.now() - loginAttemptWindowMs;
      const attempts = (failedLoginAttempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
      attempts.push(Date.now());
      failedLoginAttempts.set(key, attempts);
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    failedLoginAttempts.delete(loginKey(request));
    const token = authService.generateToken();

    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Appropriate for cross-origin if frontend is proxying, or same-site setup
      maxAge: 8 * 60 * 60 // 8 hours
    });

    return { success: true };
  });

  // Logout is public/idempotent — it only clears the cookie and exposes no data.
  server.post('/admin/logout', async (request, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return { success: true };
  });

  // Protected Admin Routes
  server.register(async (protectedServer) => {
    protectedServer.addHook('preHandler', verifyAuthCookie);

    protectedServer.get('/admin/leads', async (request, reply) => {
      const query = request.query as any;
      const filter: LeadFilter = {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        flowType: query.flowType,
        status: query.status,
        city: query.city,
        source: query.source,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder
      };

      const result = await adminLeadService.getLeads(filter);
      return result;
    });

    protectedServer.get('/admin/conversations', async () => {
      return {
        conversations: await adminLeadService.getIncompleteConversations()
      };
    });

    protectedServer.get('/admin/conversations/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const conversation = await adminLeadService.getIncompleteConversationById(id);

      if (!conversation) {
        return reply.status(404).send({ error: 'Incomplete conversation not found' });
      }

      return { conversation };
    });

    protectedServer.get('/admin/leads/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const lead = await adminLeadService.getLeadById(id);

      if (!lead) {
        return reply.status(404).send({ error: 'Lead not found' });
      }

      // Add decoded answers
      const decodedAnswers = decodeAnswers(lead.answers as any);
      const { answers, conversation, ...leadWithoutAnswers } = lead;
      return {
        lead: {
          ...leadWithoutAnswers,
          decodedAnswers,
          otherEnquiries: conversation.leads
        }
      };
    });

    protectedServer.get('/admin/leads/:id/notes', async (request, reply) => {
      const { id } = request.params as { id: string };
      const lead = await adminLeadService.getLeadById(id);
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      return { notes: await adminNoteService.listForLead(id) };
    });

    protectedServer.post('/admin/leads/:id/notes', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['content'],
          properties: { content: { type: 'string', minLength: 1, maxLength: MAX_NOTE_LENGTH } }
        }
      }
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const content = (request.body as { content: string }).content.trim();
      if (!content) return reply.status(400).send({ error: 'content is required' });
      const note = await adminNoteService.create(id, content);
      if (!note) return reply.status(404).send({ error: 'Lead not found' });
      return reply.status(201).send({ note });
    });

    protectedServer.patch('/admin/notes/:id', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['content'],
          properties: { content: { type: 'string', minLength: 1, maxLength: MAX_NOTE_LENGTH } }
        }
      }
    }, async (request, reply) => {
      const content = (request.body as { content: string }).content.trim();
      if (!content) return reply.status(400).send({ error: 'content is required' });
      const note = await adminNoteService.update((request.params as { id: string }).id, content);
      if (!note) return reply.status(404).send({ error: 'Note not found' });
      return { note };
    });

    protectedServer.delete('/admin/notes/:id', async (request, reply) => {
      const deleted = await adminNoteService.delete((request.params as { id: string }).id);
      if (!deleted) return reply.status(404).send({ error: 'Note not found' });
      return { success: true };
    });

    protectedServer.get('/admin/leads/:id/activity', async (request, reply) => {
      const { id } = request.params as { id: string };
      const lead = await adminLeadService.getLeadById(id);
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      return { activities: await adminActivityService.listForLead(id) };
    });

    protectedServer.patch('/admin/leads/:id/status', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: { type: 'string', enum: [...LEAD_STATUSES] }
          }
        }
      }
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (Object.keys(body).length !== 1 || !Object.prototype.hasOwnProperty.call(body, 'status')) {
        return reply.status(400).send({ error: 'Request body must contain only status' });
      }
      const { status } = body as { status: AdminLeadStatus };

      try {
        const lead = await adminLeadService.updateLeadStatus(id, status);
        const { answers, ...leadWithoutAnswers } = lead;
        return { lead: { ...leadWithoutAnswers, decodedAnswers: decodeAnswers(answers as any) } };
      } catch (error: any) {
        if (error?.code === 'P2025') {
          return reply.status(404).send({ error: 'Lead not found' });
        }
        throw error;
      }
    });

    protectedServer.get('/admin/follow-ups', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            filter: { type: 'string', enum: ['upcoming', 'overdue', 'completed'] },
            leadId: { type: 'string' }
          }
        }
      }
    }, async (request) => {
      const query = request.query as { filter?: FollowUpFilter; leadId?: string };
      return { followUps: await adminFollowUpService.list(query.filter, query.leadId) };
    });

    protectedServer.post('/admin/follow-ups', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['leadId', 'scheduledAt', 'note'],
          properties: {
            leadId: { type: 'string', minLength: 1 },
            scheduledAt: { type: 'string', minLength: 1 },
            note: { type: 'string', minLength: 1 }
          }
        }
      }
    }, async (request, reply) => {
      const body = request.body as { leadId: string; scheduledAt: string; note: string };
      const scheduledAt = new Date(body.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        return reply.status(400).send({ error: 'scheduledAt must be a valid date' });
      }
      if (!body.note.trim()) {
        return reply.status(400).send({ error: 'note is required' });
      }

      const followUp = await adminFollowUpService.create({
        leadId: body.leadId,
        scheduledAt,
        note: body.note.trim()
      });
      if (!followUp) return reply.status(404).send({ error: 'Lead not found' });
      return reply.status(201).send({ followUp });
    });

    protectedServer.patch('/admin/follow-ups/:id', {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            scheduledAt: { type: 'string', minLength: 1 },
            note: { type: 'string', minLength: 1 }
          }
        }
      }
    }, async (request, reply) => {
      const body = request.body as { scheduledAt?: string; note?: string };
      const data: { scheduledAt?: Date; note?: string } = {};
      if (body.scheduledAt !== undefined) {
        const scheduledAt = new Date(body.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          return reply.status(400).send({ error: 'scheduledAt must be a valid date' });
        }
        data.scheduledAt = scheduledAt;
      }
      if (body.note !== undefined) {
        if (!body.note.trim()) return reply.status(400).send({ error: 'note is required' });
        data.note = body.note.trim();
      }

      const followUp = await adminFollowUpService.update(
        (request.params as { id: string }).id,
        data
      );
      if (!followUp) return reply.status(404).send({ error: 'Follow-up not found' });
      return { followUp };
    });

    protectedServer.post('/admin/follow-ups/:id/complete', async (request, reply) => {
      const followUp = await adminFollowUpService.setStatus(
        (request.params as { id: string }).id,
        'COMPLETED'
      );
      if (!followUp) return reply.status(404).send({ error: 'Follow-up not found' });
      return { followUp };
    });

    protectedServer.post('/admin/follow-ups/:id/cancel', async (request, reply) => {
      const followUp = await adminFollowUpService.setStatus(
        (request.params as { id: string }).id,
        'CANCELLED'
      );
      if (!followUp) return reply.status(404).send({ error: 'Follow-up not found' });
      return { followUp };
    });

    protectedServer.get('/admin/stats', async (request, reply) => {
      const stats = await adminLeadService.getStats();
      return stats;
    });
  });
};

export default adminRoutes;
