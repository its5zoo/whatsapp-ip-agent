import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app';
import prisma from '../src/db/prisma';

test.describe('Health API', () => {
  test('keeps the liveness endpoint available', async () => {
    const app = buildApp();
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(JSON.parse(response.payload), {
        status: 'ok',
        message: 'Backend is running'
      });
    } finally {
      await app.close();
    }
  });

  test('reports ready when PostgreSQL and all migrations are available', async () => {
    const migrationNames = fs.readdirSync(path.join(process.cwd(), 'src/prisma/migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const query = async () => migrationNames.map((migration_name) => ({
      migration_name,
      finished_at: new Date(),
      rolled_back_at: null
    }));
    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = query as typeof prisma.$queryRaw;
    const app = buildApp();
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/ready' });
      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(JSON.parse(response.payload), { status: 'ready' });
    } finally {
      prisma.$queryRaw = originalQueryRaw;
      await app.close();
    }
  });

  test('reports not ready when PostgreSQL is unavailable', async () => {
    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = (async () => {
      throw new Error('database unavailable');
    }) as typeof prisma.$queryRaw;
    const app = buildApp();
    await app.ready();

    try {
      const response = await app.inject({ method: 'GET', url: '/ready' });
      assert.strictEqual(response.statusCode, 503);
      assert.deepStrictEqual(JSON.parse(response.payload), { status: 'not_ready' });
    } finally {
      prisma.$queryRaw = originalQueryRaw;
      await app.close();
    }
  });
});
