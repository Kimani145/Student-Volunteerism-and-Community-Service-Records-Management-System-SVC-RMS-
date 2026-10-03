import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPartners() {
    return await this.prisma.community_partners.findMany({ orderBy: { name: 'asc' } });
  }

  async createPartner(data: any) {
    return await this.prisma.community_partners.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        contact_person: data.contactPerson ?? data.contact_person,
      }
    });
  }

  async updatePartner(id: string, data: any) {
    const partner = await this.prisma.community_partners.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException();
    return await this.prisma.community_partners.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        contact_person: data.contactPerson ?? data.contact_person,
      }
    });
  }
}
