import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPartners() {
    return await this.prisma.partners.findMany({ orderBy: { name: 'asc' } });
  }

  async createPartner(data: any) {
    return await this.prisma.partners.create({
      data: {
        name: data.name,
        contact_email: data.email,
        contact_phone: data.phone,
        mou_valid_until: data.mou_valid_until ? new Date(data.mou_valid_until) : undefined,
      }
    });
  }

  async updatePartner(id: string, data: any) {
    const partner = await this.prisma.partners.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException();
    return await this.prisma.partners.update({
      where: { id },
      data: {
        name: data.name,
        contact_email: data.email,
        contact_phone: data.phone,
        mou_valid_until: data.mou_valid_until ? new Date(data.mou_valid_until) : undefined,
      }
    });
  }
}
