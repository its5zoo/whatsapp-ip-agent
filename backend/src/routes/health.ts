import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get('/health', async (request, reply) => {
    return { status: 'ok', message: 'Backend is running' };
  });
};

export default healthRoutes;
