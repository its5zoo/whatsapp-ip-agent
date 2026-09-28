import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { conversationService } from '../services/conversationService';

const simulatorRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post('/simulator/message', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'message'],
        properties: {
          userId: { type: 'string', minLength: 1, maxLength: 100 },
          message: { type: 'string', minLength: 1, maxLength: 1000 }
        },
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    // Development-only simulator — not for production use
    const { userId, message } = request.body as { userId: string, message: string };

    try {
      const response = await conversationService.handleMessage('simulator', userId, message);
      return { response, userId };
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};

export default simulatorRoutes;
