import { Controller, Post, Body, Req, Res, Get, UnauthorizedException, UnprocessableEntityException, HttpCode, Inject } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import { Roles } from './roles.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import { ZodValidationPipe } from '../students/zod-validation.pipe.js';
import { UserRole, ErrorCode, type AuthUser } from '@svc-rms/shared';
import { z } from 'zod';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  regNumber: z.string().min(3),
  fullName: z.string().min(2),
  schoolId: z.number().int().min(1).max(32767),
  programme: z.string().min(2),
  yearOfStudy: z.number().int().min(1).max(7),
  noticeVersion: z.string(),
}).strict();
type RegisterBody = z.infer<typeof registerSchema>;

const verifyEmailSchema = z.object({
  token: z.string(),
}).strict();
type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
}).strict();
type LoginBody = z.infer<typeof loginSchema>;

const forgotPasswordSchema = z.object({
  email: z.string().email(),
}).strict();
type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
}).strict();
type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(12),
}).strict();
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(201)
  async register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterBody, @Req() req: FastifyRequest) {
    // Check domain
    const allowed = (process.env.ALLOWED_STUDENT_EMAIL_DOMAINS || 'example.test').split(',');
    const domain = body.email.split('@')[1];
    if (!domain || !allowed.includes(domain)) {
      throw new UnprocessableEntityException('Email domain not allowed');
    }
    await this.authService.register(body, req.ip || '');
  }

  @Post('verify-email')
  @Public()
  @HttpCode(200)
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailBody) {
    await this.authService.verifyEmail(body.token);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 600000 } })
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginBody, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.authService.login(body.email, body.password, ip, userAgent);
    
    res.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: false, // process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    return { accessToken: result.accessToken };
  }

  @Post('refresh')
  @Public()
  async refresh(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const oldRefreshToken = req.cookies?.['refresh_token'];
    if (!oldRefreshToken) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHENTICATED, detail: 'Missing refresh token' });
    }
    
    const result = await this.authService.refresh(oldRefreshToken, req.ip || '', req.headers['user-agent'] || '');
    
    res.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: false, // process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.status(200).send({ accessToken: result.accessToken });
  }

  @Post('logout')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  @HttpCode(200)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply, @CurrentUser() _user: AuthUser) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Get('me')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async getMe(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('password/forgot')
  @Public()
  @HttpCode(200)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordBody) {
    await this.authService.forgotPassword(body.email);
  }

  @Post('password/reset')
  @Public()
  @HttpCode(200)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordBody) {
    await this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('password/change')
  @Roles(UserRole.STUDENT, UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  @HttpCode(200)
  async changePassword(@Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordBody, @CurrentUser() user: AuthUser) {
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
