import prisma from '../prisma';
import { Conversation } from '@prisma/client';
import { ConversationData } from '../../engine/types';

export class ConversationRepository {
  async findByChannelAndUser(channel: string, externalUserId: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({
      where: {
        channel_externalUserId: {
          channel,
          externalUserId
        }
      }
    });
  }

  async create(channel: string, externalUserId: string): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        channel,
        externalUserId,
        currentQuestionId: null,
        data: {},
        isCompleted: false
      }
    });
  }

  async updateState(id: string, currentQuestionId: string | null, data: ConversationData, isCompleted: boolean): Promise<Conversation> {
    return prisma.conversation.update({
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
