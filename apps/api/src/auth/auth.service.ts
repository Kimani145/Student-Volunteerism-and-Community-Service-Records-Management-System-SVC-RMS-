import { Injectable, UnauthorizedException, UnprocessableEntityException, GoneException, ConflictException, Logger, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { TokenService } from './token.service.js';
import { AuditEventsService } from '../audit/audit-events.service.js';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditEventsService) private readonly audit: AuditEventsService,
  ) {}

  private hashToken(token: string): Buffer {
    return createHash('sha256').update(token).digest();
  }

  private hashRefreshToken(token: string): Buffer {
    const pepper = process.env.REFRESH_TOKEN_PEPPER || '';
    return createHash('sha256').update(token + pepper).digest();
  }

  async register(data: any, ip: string) {
    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
    const verifyToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.$transaction(async (tx: any) => {
      const existingUser = await tx.user.findUnique({ where: { email: data.email } });
      if (existingUser) throw new ConflictException('Email already in use');

      const existingStudent = await tx.student.findUnique({ where: { reg_number: data.regNumber.toUpperCase() } });
      if (existingStudent) throw new ConflictException('Registration number already in use');

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'STUDENT',
          isActive: true,
        },
      });

      await tx.student.create({
        data: {
          user_id: user.id,
          reg_number: data.regNumber.toUpperCase(),
          full_name: data.fullName,
          school_id: data.schoolId,
          programme: data.programme,
          year_of_study: data.yearOfStudy,
        },
      });

      await tx.consents.create({
        data: {
          user_id: user.id,
          notice_version: data.noticeVersion,
          ip,
        },
      });

      await tx.email_tokens.create({
        data: {
          user_id: user.id,
          purpose: 'VERIFY_EMAIL',
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });
    });

    // Fire email
    await this.mailService.sendEmail(data.email, 'Verify your email', `Your token: ${verifyToken}`);
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    await this.prisma.$transaction(async (tx: any) => {
      const emailToken = await tx.email_tokens.findUnique({ where: { token_hash: tokenHash } });
      if (!emailToken || emailToken.purpose !== 'VERIFY_EMAIL') throw new GoneException('Token invalid or expired');
      if (emailToken.used_at) throw new GoneException('Token already used');
      if (emailToken.expires_at < new Date()) throw new GoneException('Token expired');

      await tx.email_tokens.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      });

      await tx.user.update({
        where: { id: emailToken.user_id },
        data: { email_verified_at: new Date() },
      });
    });
  }

  async login(email: string, password: string, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { student: true } });
    if (!user) {
      await argon2.hash(password, { type: argon2.argon2id }); // dummy
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.locked_until && user.locked_until > new Date()) {
      await this.audit.record('LOGIN_LOCKOUT', { email });
      throw new UnauthorizedException('Account locked');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      const count = user.failed_login_count + 1;
      const locked = count >= 5;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_count: locked ? 0 : count,
          locked_until: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      await this.audit.record('LOGIN_FAILURE', { userId: user.id });
      if (locked) await this.audit.record('LOGIN_LOCKOUT', { userId: user.id });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (!user.email_verified_at && user.role === 'STUDENT') {
      throw new ForbiddenException('Email not verified');
    }

    // Success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failed_login_count: 0, locked_until: null },
    });

    const familyId = randomBytes(16).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const refreshHash = this.hashRefreshToken(refreshToken);

    await this.prisma.sessions.create({
      data: {
        user_id: user.id,
        family_id: familyId,
        refresh_hash: refreshHash,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours absolute
        ip,
        user_agent: userAgent,
      },
    });

    const accessToken = await this.tokenService.signAccess({
      id: user.id,
      role: user.role,
      canApprove: user.canApprove,
      studentId: user.student?.id,
    });

    await this.audit.record('LOGIN_SUCCESS', { userId: user.id });

    return { accessToken, refreshToken };
  }

  async refresh(oldRefreshToken: string, ip: string, userAgent: string) {
    const oldHash = this.hashRefreshToken(oldRefreshToken);

    const session = await this.prisma.sessions.findUnique({ where: { refresh_hash: oldHash } });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    if (session.revoked_at) {
      await this.prisma.sessions.updateMany({
        where: { family_id: session.family_id },
        data: { revoked_at: new Date() },
      });
      await this.audit.record('REFRESH_REUSE_DETECTED', { userId: session.user_id });
      throw new UnauthorizedException('Session revoked');
    }

    if (session.expires_at < new Date() || session.last_used_at.getTime() < Date.now() - 15 * 60 * 1000) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.user_id }, include: { student: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('User deactivated');

    return await this.prisma.$transaction(async (tx: any) => {

      // Revoke old
      await tx.sessions.update({
        where: { id: session.id },
        data: { revoked_at: new Date() },
      });

      // Create new
      const newRefreshToken = randomBytes(32).toString('hex');
      const newHash = this.hashRefreshToken(newRefreshToken);

      await tx.sessions.create({
        data: {
          user_id: user.id,
          family_id: session.family_id,
          refresh_hash: newHash,
          expires_at: session.expires_at, // carry over absolute expiry
          ip,
          user_agent: userAgent,
        },
      });

      const accessToken = await this.tokenService.signAccess({
        id: user.id,
        role: user.role,
        canApprove: user.canApprove,
        studentId: user.student?.id,
      });

      return { accessToken, refreshToken: newRefreshToken };
    });
  }

  async logout(refreshToken: string) {
    const hash = this.hashRefreshToken(refreshToken);
    await this.prisma.sessions.updateMany({
      where: { refresh_hash: hash },
      data: { revoked_at: new Date() },
    });
    await this.audit.record('LOGOUT_SUCCESS', {});
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // Silent return

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(resetToken);

    await this.prisma.email_tokens.create({
      data: {
        user_id: user.id,
        purpose: 'RESET_PASSWORD',
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await this.mailService.sendEmail(email, 'Reset your password', `Token: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    let userId = '';
    await this.prisma.$transaction(async (tx: any) => {
      const emailToken = await tx.email_tokens.findUnique({ where: { token_hash: tokenHash } });
      if (!emailToken || emailToken.purpose !== 'RESET_PASSWORD') throw new GoneException('Token invalid or expired');
      if (emailToken.used_at) throw new GoneException('Token already used');
      if (emailToken.expires_at < new Date()) throw new GoneException('Token expired');

      userId = emailToken.user_id;

      await tx.email_tokens.update({
        where: { id: emailToken.id },
        data: { used_at: new Date() },
      });

      await tx.user.update({
        where: { id: emailToken.user_id },
        data: { passwordHash, must_change_password: false, locked_until: null, failed_login_count: 0 },
      });

      await tx.sessions.updateMany({
        where: { user_id: emailToken.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });

    if (userId) {
      await this.audit.record('PASSWORD_RESET', { userId });
    }
  }

  async changePassword(userId: string, current: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isValid = await argon2.verify(user.passwordHash, current);
    if (!isValid) throw new UnauthorizedException('Incorrect current password');

    const passwordHash = await argon2.hash(newPass, { type: argon2.argon2id });
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, must_change_password: false },
    });

    await this.prisma.sessions.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    await this.audit.record('PASSWORD_CHANGE', { userId });
  }
}
