import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

const expectedDatabaseName = 'whatsapp_agent_test';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Refusing to reset test database: DATABASE_URL is not configured');
}

let configuredDatabaseName: string;
try {
  configuredDatabaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
} catch {
  throw new Error('Refusing to reset test database: DATABASE_URL is invalid');
}

if (configuredDatabaseName !== expectedDatabaseName) {
  throw new Error(
    `Refusing to reset test database: configured database is ${configuredDatabaseName}, expected ${expectedDatabaseName}`
  );
}

const prisma = new PrismaClient();

async function resetTestDatabase(): Promise<void> {
  try {
    const result = await prisma.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `;
    const actualDatabaseName = result[0]?.databaseName;
    if (actualDatabaseName !== expectedDatabaseName) {
      throw new Error(
        `Refusing to reset test database: connected database is ${actualDatabaseName}, expected ${expectedDatabaseName}`
      );
    }

    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.processedWhatsappMessage.deleteMany({});
    await prisma.whatsappOutboundMessage.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}

resetTestDatabase().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
