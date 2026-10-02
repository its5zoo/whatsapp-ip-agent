import prisma from '../prisma';
import { Conversation, Prisma, PrismaClient } from '@prisma/client';
import { ConversationData } from '../../engine/types';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class ConversationRepository {
  async findByChannelAndUser(
    channel: string,
    externalUserId: string,
    db: DatabaseClient = prisma
  ): Promise<Conversation | null> {
    return db.conversation.findUnique({
      where: {
        channel_externalUserId: {
          channel,
          externalUserId
        }
      }
    });
  }

  async create(
    channel: string,
    externalUserId: string,
    db: DatabaseClient = prisma
  ): Promise<Conversation> {
    return db.conversation.create({
      data: {
        channel,
        externalUserId,
        currentQuestionId: null,
        data: {},
        isCompleted: false
      }
    });
  }

  async updateState(
    id: string,
    currentQuestionId: string | null,
    data: ConversationData,
    isCompleted: boolean,
    db: DatabaseClient = prisma
  ): Promise<Conversation> {
    return db.conversation.update({
      where: { id },
      data: {
        currentQuestionId,
        data: data as any,
        isCompleted
      }
    });
  }
}

export const conversationRepository = new ConversationRepository();
