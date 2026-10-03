import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudent(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    return {
      id: student.id,
      regNumber: student.reg_number,
      fullName: student.full_name,
      schoolId: student.school_id,
      programme: student.programme,
      yearOfStudy: student.year_of_study,
      phone: student.phone,
      gender: student.gender,
    };
  }

  async updateStudent(id: string, data: any) {
    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        school_id: data.schoolId,
        programme: data.programme,
        year_of_study: data.yearOfStudy,
        phone: data.phone,
        gender: data.gender,
      },
    });
    return {
      id: updated.id,
      schoolId: updated.school_id,
      yearOfStudy: updated.year_of_study,
    };
  }

  async searchStudents(q?: string, skip = 0, take = 20) {
    const where: Prisma.StudentWhereInput = q
      ? {
          OR: [
            { reg_number: { contains: q, mode: 'insensitive' } },
            { full_name: { contains: q, mode: 'insensitive' } },
            { schools: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy: { full_name: 'asc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items: items.map((s) => ({
        id: s.id,
        regNumber: s.reg_number,
        fullName: s.full_name,
        schoolId: s.school_id,
      })),
      total,
    };
  }
}
