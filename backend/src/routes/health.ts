import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../db/prisma';

const healthRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get('/health', async () => {
    return { status: 'ok', message: 'Backend is running' };
  });

  server.get('/ready', async (_request, reply) => {
    try {
      const migrationsPath = path.join(process.cwd(), 'src/prisma/migrations');
      const expectedMigrations = fs.readdirSync(migrationsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const appliedMigrations = await prisma.$queryRaw<Array<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;

      const appliedMigrationNames = new Set(
        appliedMigrations
          .filter((migration) => migration.finished_at !== null && migration.rolled_back_at === null)
          .map((migration) => migration.migration_name)
      );
      const migrationsReady = expectedMigrations.every((migration) => appliedMigrationNames.has(migration));

      if (!migrationsReady) {
        return reply.status(503).send({ status: 'not_ready' });
      }

      return { status: 'ready' };
    } catch (error) {
      server.log.warn({ err: error instanceof Error ? error.message : String(error) }, 'Backend readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });
};

export default healthRoutes;
