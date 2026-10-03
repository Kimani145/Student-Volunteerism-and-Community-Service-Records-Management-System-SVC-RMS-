export interface CheckInDto {
  token: string;
  lat?: number;
  lng?: number;
}

export interface AttendanceBulkUpdateItemDto {
  id: string; // participation_id
  status: 'ATTENDED' | 'ABSENT';
  hours_awarded?: number;
  remarks?: string;
  reason?: string; // hours override reason
}

export interface BulkAttendanceDto {
  participations: AttendanceBulkUpdateItemDto[];
}
