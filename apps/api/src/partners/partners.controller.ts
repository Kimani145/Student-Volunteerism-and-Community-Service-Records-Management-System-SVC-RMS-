import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { PartnersService } from './partners.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';

@Controller('partners')
@Roles(UserRole.STAFF, UserRole.ADMIN)
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly svc: PartnersService) {}

  @Get()
  async getPartners() {
    return this.svc.getPartners();
  }

  @Post()
  async createPartner(@Body() body: any) {
    return this.svc.createPartner(body);
  }

  @Patch(':id')
  async updatePartner(@Param('id') id: string, @Body() body: any) {
    return this.svc.updatePartner(id, body);
  }
}
