import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(skip = 0, take = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count(),
    ]);
    return {
      items: items.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        canApprove: u.canApprove,
      })),
      total,
    };
  }

  async createUser(email: string, role: any) {
    // Generate random password
    const tempPassword = randomBytes(16).toString('hex');
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        role,
        passwordHash,
        must_change_password: true,
      },
    });
    return { id: user.id, email: user.email, role: user.role };
  }

  async updateUser(id: string, data: any) {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    return { id: user.id, email: user.email, role: user.role, isActive: user.isActive, canApprove: user.canApprove };
  }

  async checkNotLastAdmin(targetUserId: string, currentUserId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException('User not found');
    
    if (targetUser.role === 'ADMIN' && targetUser.isActive) {
      const activeAdminsCount = await this.prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdminsCount <= 1) {
        throw new ConflictException('Cannot deactivate or demote the last active ADMIN');
      }
    }
  }
}
