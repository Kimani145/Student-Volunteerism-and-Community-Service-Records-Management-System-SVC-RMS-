import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { z } from 'zod';
import { ZodValidationPipe } from '../students/zod-validation.pipe.js';
import { UserRole } from '@svc-rms/shared';

const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['STAFF', 'MANAGEMENT', UserRole.ADMIN]),
}).strict();

const updateUserSchema = z.object({
  role: z.enum(['STAFF', 'MANAGEMENT', UserRole.ADMIN]).optional(),
  isActive: z.boolean().optional(),
  canApprove: z.boolean().optional(),
}).strict();

@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@Query('skip') skip = '0', @Query('take') take = '20') {
    return this.usersService.listUsers(parseInt(skip), parseInt(take));
  }

  @Post()
  async createUser(@Body(new ZodValidationPipe(createUserSchema)) body: any) {
    return this.usersService.createUser(body.email, body.role);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: any,
    @CurrentUser() currentUser: any
  ) {
    // If deactivating or demoting, check if it's the last ADMIN
    if (body.isActive === false || (body.role && body.role !== UserRole.ADMIN)) {
      await this.usersService.checkNotLastAdmin(id, currentUser.id);
    }
    return this.usersService.updateUser(id, body);
  }
}
