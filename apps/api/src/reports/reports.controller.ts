import { Controller, Get, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { CsvService } from '../csv/csv.service.js';
import { UserRole } from '@svc-rms/shared';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser, CurrentUserType } from '../auth/current-user.decorator.js';
import { FastifyReply } from 'fastify';
import { AuditEventsService } from '../audit/audit-events.service.js';

@Controller()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly csvService: CsvService,
    private readonly auditEvents: AuditEventsService,
  ) {}

  @Get('reports/dashboard')
  @Roles(UserRole.MANAGEMENT, UserRole.STAFF, UserRole.ADMIN)
  async getDashboard(@Query('start') start?: string, @Query('end') end?: string) {
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;
    const data = await this.reportsService.getDashboardAggregates(startDate, endDate);
    // Audit log
    await this.auditEvents.record('REPORT_EXPORT', { report: 'dashboard', filters: { start, end } });
    return data;
  }

  @Get('reports/activities')
  @Roles(UserRole.MANAGEMENT, UserRole.STAFF, UserRole.ADMIN)
  async getActivities() {
    return this.reportsService.getActivitiesReport();
  }

  @Get('reports/activities.csv')
  @Roles(UserRole.MANAGEMENT, UserRole.STAFF, UserRole.ADMIN)
  async getActivitiesCsv(@Res() res: FastifyReply) {
    const data = await this.reportsService.getActivitiesReport();
    await this.auditEvents.record('REPORT_EXPORT', { report: 'activities_csv' });
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="activities.csv"');
    
    const headers = ['title', 'type', 'start_at', 'end_at', 'venue', 'status', 'registered', 'attended', 'hours', 'organizer'];
    const stream = this.csvService.generateCsvStream(headers, data);
    return res.send(stream);
  }

  @Get('reports/students/:id.csv')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getStudentCsv(@Param('id') id: string, @Res() res: FastifyReply) {
    const data = await this.reportsService.getStudentReport(id);
    await this.auditEvents.record('REPORT_EXPORT', { report: 'student_csv', studentId: id });
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="student_${id}.csv"`);
    
    const headers = ['activity_title', 'status', 'hours_awarded', 'date'];
    const stream = this.csvService.generateCsvStream(headers, data);
    return res.send(stream);
  }

  @Post('activities/:activityId/reports')
  @Roles(UserRole.STAFF)
  async createActivityReport(
    @Param('activityId') activityId: string,
    @Body() body: { title: string; body: string },
    @CurrentUser() user: CurrentUserType
  ) {
    return this.reportsService.createActivityReport(activityId, body.title, body.body, user.id);
  }

  @Get('activities/:activityId/reports')
  @Roles(UserRole.STAFF, UserRole.MANAGEMENT, UserRole.ADMIN)
  async getActivityReports(@Param('activityId') activityId: string) {
    return this.reportsService.getActivityReports(activityId);
  }
}
