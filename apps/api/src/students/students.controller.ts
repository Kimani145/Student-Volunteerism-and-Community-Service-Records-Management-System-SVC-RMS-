import { ZodValidationPipe } from './zod-validation.pipe.js';
import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '@svc-rms/shared';
import { z } from 'zod';

const updateStudentSchema = z.object({
  schoolId: z.number().int().optional(),
  programme: z.string().optional(),
  yearOfStudy: z.number().int().min(1).max(7).optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
}).strict();

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  @Roles(UserRole.STUDENT)
  async getMe(@CurrentUser() user: any) {
    return this.studentsService.getStudent(user.studentId);
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  async updateMe(@CurrentUser() user: any, @Body(new ZodValidationPipe(updateStudentSchema)) body: any) {
    const data = body;
    return this.studentsService.updateStudent(user.studentId, data);
  }

  @Get()
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async searchStudents(@Query('q') q?: string, @Query('skip') skip = '0', @Query('take') take = '20') {
    return this.studentsService.searchStudents(q, parseInt(skip), parseInt(take));
  }
}
