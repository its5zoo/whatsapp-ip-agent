import prisma from '../prisma';
import { Prisma, PrismaClient, WhatsappOutboundMessage } from '@prisma/client';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type OutboundMessageStatus = 'pending' | 'sending' | 'sent' | 'retryable' | 'failed';

export interface CreateOutboundMessageInput {
  inboundMessageId: string;
  waId: string;
  text: string;
}

const LEASE_MS = 60_000;

export class WhatsappOutboundMessageRepository {
  async create(
    input: CreateOutboundMessageInput,
    db: DatabaseClient = prisma
  ): Promise<WhatsappOutboundMessage> {
    return db.whatsappOutboundMessage.create({
      data: {
        ...input,
        status: 'pending'
      }
    });
  }

  async findByInboundMessageId(
    inboundMessageId: string,
    db: DatabaseClient = prisma
  ): Promise<WhatsappOutboundMessage | null> {
    return db.whatsappOutboundMessage.findUnique({ where: { inboundMessageId } });
  }

  async claim(
    inboundMessageId?: string,
    db: PrismaClient | Prisma.TransactionClient = prisma
  ): Promise<WhatsappOutboundMessage | null> {
    const staleBefore = new Date(Date.now() - LEASE_MS);
    const rows = inboundMessageId
      ? await db.$queryRaw<WhatsappOutboundMessage[]>`
          UPDATE "whatsapp_outbound_messages"
          SET "status" = 'sending',
              "attempts" = "attempts" + 1,
              "sending_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = (
            SELECT "id"
            FROM "whatsapp_outbound_messages"
            WHERE "inbound_message_id" = ${inboundMessageId}
              AND (
                ("status" IN ('pending', 'retryable') AND "next_attempt_at" <= CURRENT_TIMESTAMP)
                OR ("status" = 'sending' AND "sending_at" < ${staleBefore})
              )
            FOR UPDATE SKIP LOCKED
          )
          RETURNING
            "id",
            "inbound_message_id" AS "inboundMessageId",
            "wa_id" AS "waId",
            "text",
            "status",
            "attempts",
            "next_attempt_at" AS "nextAttemptAt",
            "sending_at" AS "sendingAt",
            "sent_at" AS "sentAt",
            "last_error" AS "lastError",
            "created_at" AS "createdAt",
            "updated_at" AS "updatedAt"
        `
      : await db.$queryRaw<WhatsappOutboundMessage[]>`
          UPDATE "whatsapp_outbound_messages"
          SET "status" = 'sending',
              "attempts" = "attempts" + 1,
              "sending_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = (
            SELECT "id"
            FROM "whatsapp_outbound_messages"
            WHERE (
              ("status" IN ('pending', 'retryable') AND "next_attempt_at" <= CURRENT_TIMESTAMP)
              OR ("status" = 'sending' AND "sending_at" < ${staleBefore})
            )
            ORDER BY "next_attempt_at", "created_at"
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING
            "id",
            "inbound_message_id" AS "inboundMessageId",
            "wa_id" AS "waId",
            "text",
            "status",
            "attempts",
            "next_attempt_at" AS "nextAttemptAt",
            "sending_at" AS "sendingAt",
            "sent_at" AS "sentAt",
            "last_error" AS "lastError",
            "created_at" AS "createdAt",
            "updated_at" AS "updatedAt"
        `;

    return rows[0] || null;
  }

  async markSent(id: string): Promise<void> {
    await prisma.whatsappOutboundMessage.updateMany({
      where: { id, status: 'sending' },
      data: { status: 'sent', sentAt: new Date(), sendingAt: null, lastError: null }
    });
  }

  async markRetryable(id: string, error: string, attempts: number): Promise<void> {
    const delayMs = Math.min(15 * 60_000, 1_000 * (2 ** Math.min(attempts - 1, 8)));
    await prisma.whatsappOutboundMessage.updateMany({
      where: { id, status: 'sending' },
      data: {
        status: 'retryable',
        nextAttemptAt: new Date(Date.now() + delayMs),
        sendingAt: null,
        lastError: error.slice(0, 500)
      }
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.whatsappOutboundMessage.updateMany({
      where: { id, status: 'sending' },
      data: { status: 'failed', sendingAt: null, lastError: error.slice(0, 500) }
    });
  }
}

export const whatsappOutboundMessageRepository = new WhatsappOutboundMessageRepository();
