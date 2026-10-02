import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CsvService } from '../csv/csv.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly csvService: CsvService,
  ) {}

  async getDashboardAggregates(startDate?: Date, endDate?: Date) {
    const params: any[] = [];
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `WHERE a.start_at >= $1 AND a.start_at <= $2`;
      params.push(startDate, endDate);
    }
    
    const query = `
      SELECT 
        to_char(a.start_at, 'YYYY-MM') as "month",
        at.name as "activityType",
        s.school_id as "schoolId",
        s.year_of_study as "yearOfStudy",
        COUNT(DISTINCT a.id)::int as "activities",
        COUNT(DISTINCT p.student_id)::int as "participants",
        COUNT(DISTINCT CASE WHEN p.status = 'ATTENDED' THEN p.student_id END)::int as "attendedCount",
        COALESCE(SUM(p.hours_awarded), 0)::float as "totalHours"
      FROM activities a
      LEFT JOIN "ActivityType" at ON a.type_id = at.id
      LEFT JOIN participations p ON a.id = p.activity_id
      LEFT JOIN students s ON p.student_id = s.id
      ${dateFilter}
      GROUP BY 
        to_char(a.start_at, 'YYYY-MM'),
        at.name,
        s.school_id,
        s.year_of_study
    `;
    const rows = await this.prisma.$queryRawUnsafe(query, ...params);
    return rows;
  }

  async getActivitiesReport() {
    const activities = await this.prisma.activities.findMany({
      include: {
        activity_types: true,
        users_activities_organizer_idTousers: true,
        participations: true,
      }
    });

    return activities.map(a => {
      const registered = a.participations.filter(p => p.status === 'REGISTERED').length;
      const attended = a.participations.filter(p => p.status === 'ATTENDED').length;
      return {
        title: a.title,
        type: a.activity_types.name,
        start_at: a.start_at.toISOString(),
        end_at: a.end_at.toISOString(),
        venue: a.venue,
        status: a.status,
        registered,
        attended,
        hours: a.service_hours,
        organizer: a.users_activities_organizer_idTousers.email,
      };
    });
  }

  async getStudentReport(studentId: string) {
    const participations = await this.prisma.participations.findMany({
      where: { student_id: studentId },
      include: {
        activities: true,
      }
    });

    return participations.map(p => ({
      activity_title: p.activities.title,
      status: p.status,
      hours_awarded: p.hours_awarded,
      date: p.activities.start_at.toISOString()
    }));
  }

  async createActivityReport(activityId: string, title: string, body: string, userId: string) {
    return this.prisma.activity_reports.create({
      data: {
        activity_id: activityId,
        title,
        body,
        created_by: userId
      }
    });
  }

  async getActivityReports(activityId: string) {
    return this.prisma.activity_reports.findMany({
      where: { activity_id: activityId },
      orderBy: { created_at: 'desc' }
    });
  }
}
