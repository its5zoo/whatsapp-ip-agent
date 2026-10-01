import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { authService } from '../services/authService';
import { verifyAuthCookie } from '../middleware/auth';
import { adminLeadService, LeadFilter } from '../services/adminLeadService';
import { decodeAnswers } from '../engine/answerDecoder';

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
      const { answers, ...leadWithoutAnswers } = lead;

      return { lead: { ...leadWithoutAnswers, decodedAnswers } };
    });

    protectedServer.get('/admin/stats', async (request, reply) => {
      const stats = await adminLeadService.getStats();
      return stats;
    });
  });
};

export default adminRoutes;
