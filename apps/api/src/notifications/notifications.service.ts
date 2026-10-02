import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notifications.update({
      where: { id, user_id: userId },
      data: { read_at: new Date() },
    });
  }

  async notifyStudents(userIds: string[], type: string, title: string, body?: string, link?: string) {
    if (userIds.length === 0) return;
    await this.prisma.notifications.createMany({
      data: userIds.map(uid => ({
        user_id: uid,
        type,
        title,
        body,
        link,
      })),
    });
  }
}
