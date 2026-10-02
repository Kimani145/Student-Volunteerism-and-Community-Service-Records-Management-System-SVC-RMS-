import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, type: string, title: string, body?: string, link?: string): Promise<void> {
    try {
      await this.prisma.notifications.create({
        data: {
          user_id: userId,
          type,
          title,
          ...(body !== undefined && { body }),
          ...(link !== undefined && { link }),
        }
      });
    } catch (err) {
      this.logger.error(`Failed to send notification to ${userId}: ${err}`);
    }
  }
}
