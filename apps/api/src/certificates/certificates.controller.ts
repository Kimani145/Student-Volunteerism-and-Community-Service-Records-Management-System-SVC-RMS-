import { Controller, Post, Get, Param, Body, UseGuards, Req, Res, Headers, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CertificatesService } from './certificates.service.js';
import { IssueCertificatesDto } from './dto/issue-certificates.dto.js';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller()
export class CertificatesController {
  constructor(private readonly certService: CertificatesService) {}

  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @Post('activities/:id/certificates')
  async issue(@Param('id') activityId: string, @Body() dto: IssueCertificatesDto, @Req() req: FastifyRequest) {
    const user = (req as any).user;
    return this.certService.issueCertificates(activityId, user.id, dto.participationIds);
  }

  @Roles(UserRole.STUDENT)
  @Get('certificates/me')
  async getMyCerts(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    return this.certService.getMyCertificates(user.id);
  }

  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMIN)
  @Get('certificates/:id')
  async getCert(@Param('id') id: string, @Req() req: FastifyRequest) {
    const user = (req as any).user;
    const cert = await this.certService.getCertificate(id);
    if (user.role === 'STUDENT' && cert.participations.students.user_id !== user.id) {
      // Return 404 to obscure existence, per CRT-06 "Cross-student download -> 404"
      throw new NotFoundException('Certificate not found');
    }
    return cert;
  }

  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.ADMIN)
  @Get('certificates/:id/pdf')
  async getPdf(@Param('id') id: string, @Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const user = (req as any).user;
    const buffer = await this.certService.getPdf(id, user.id, user.role);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Length', buffer.length);
    res.header('Content-Disposition', `attachment; filename="certificate_${id}.pdf"`);
    res.send(buffer);
  }

  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @Post('certificates/:id/revoke')
  async revoke(@Param('id') id: string, @Body() dto: RevokeCertificateDto, @Req() req: FastifyRequest) {
    const user = (req as any).user;
    if (user.role === 'STAFF' && !user.canApprove) {
      throw new ForbiddenException('Must be an approver to revoke');
    }
    return this.certService.revoke(id, user.id, dto.reason);
  }

  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @Post('certificates/:id/reissue')
  async reissue(@Param('id') id: string, @Req() req: FastifyRequest) {
    const user = (req as any).user;
    if (user.role === 'STAFF' && !user.canApprove) {
      throw new ForbiddenException('Must be an approver to reissue');
    }
    return this.certService.reissue(id, user.id);
  }
}
