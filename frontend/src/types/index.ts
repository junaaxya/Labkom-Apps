export type Role = "KOORDINATOR_LAB" | "ASISTEN_LAB" | "MAHASISWA";

export type LabStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export type PCStatus = "AVAILABLE" | "IN_USE" | "BROKEN" | "MAINTENANCE" | "INACTIVE";

export type AgentStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export type HealthStatus = "NORMAL" | "BROKEN" | "MAINTENANCE" | "NEEDS_CHECK";

export type ScheduleStatus = "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";

export type ScheduleType = "PRAKTIKUM" | "PEMINJAMAN" | "KEGIATAN";

export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ScheduleChangeType = "RESCHEDULE" | "CANCEL_SESSION" | "EXTRA_SLOT";

export type ScheduleChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ScheduleChangeRequest {
  id: string;
  scheduleId?: string;
  requestType: ScheduleChangeType;
  status: ScheduleChangeStatus;
  reason: string;
  newDay?: DayOfWeek;
  newStartTime?: string;
  newEndTime?: string;
  newLabId?: string;
  cancelDate?: string;
  requestedById: string;
  approvedById?: string;
  rejectionReason?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  schedule?: Schedule;
  requestedBy?: User;
  approvedBy?: User;
}

export type DayOfWeek = "SENIN" | "SELASA" | "RABU" | "KAMIS" | "JUMAT" | "SABTU" | "MINGGU";

export type LogbookStatus =
  | "SCHEDULED"
  | "CHECKED_IN"
  | "IN_USE"
  | "CONDITION_SUBMITTED"
  | "WAITING_VERIFICATION"
  | "COMPLETED"
  | "PROBLEM"
  | "CANCELLED";

export type KeyStatus = "AVAILABLE" | "BORROWED" | "MISSING" | "MAINTENANCE";

export type KeyAction = "TAKEN" | "RETURNED";

export type TicketCategory =
  | "MOUSE"
  | "KEYBOARD"
  | "MONITOR"
  | "CPU"
  | "JARINGAN"
  | "SOFTWARE"
  | "KURSI_MEJA"
  | "AC_LISTRIK"
  | "PROYEKTOR"
  | "LAINNYA";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "REJECTED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MissionStatus = "OPEN" | "TAKEN" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type AttendanceStatus = "CHECKED_IN" | "LATE" | "CHECKED_OUT" | "WAITING_VERIFICATION" | "APPROVED" | "REJECTED" | "FORGOT_CHECKOUT" | "ABSENT" | "SICK" | "PERMISSION";

export type DailyTaskStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "NEED_REVISION";

export type CorrectionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ShiftScheduleStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface AttendanceEntry {
  id: string;
  userId: string;
  shiftScheduleId?: string;
  checkinAt?: string;
  checkoutAt?: string;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  checkinLocationId?: string;
  checkoutLocationId?: string;
  workDurationMinutes?: number;
  status: AttendanceStatus;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  shiftSchedule?: ShiftSchedule;
  dailyTasks?: DailyTaskLog[];
  checkinLocation?: AttendanceLocation;
  checkoutLocation?: AttendanceLocation;
  verifier?: User;
}

export interface DailyTaskLog {
  id: string;
  userId: string;
  attendanceId?: string;
  task: string;
  description?: string;
  category?: string;
  categoryConfigId?: string;
  categoryConfig?: TaskCategoryConfig;
  photoUrl?: string;
  duration?: number;
  labId?: string;
  lab?: Lab;
  relatedTicketId?: string;
  relatedMissionId?: string;
  relatedScheduleId?: string;
  status: DailyTaskStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewer?: User;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCategoryConfig {
  id: string;
  name: string;
  description?: string;
  defaultPoints: number;
  isEvidenceRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSchedule {
  id: string;
  userId: string;
  destination?: AsLabPicketDestination;
  labId?: string;
  shiftId: string;
  scheduleDate: string;
  status: ShiftScheduleStatus;
  assignedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  lab?: Lab;
  shift?: Shift;
  assigner?: User;
}

export interface RecurringShiftPattern {
  id?: string;
  effectiveFrom?: string;
  weekStart?: string;
  shiftId?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface RecurringShiftPatternState {
  horizonStart?: string;
  horizonEnd?: string;
  materializedWeeks?: number;
  patterns: RecurringShiftPattern[];
}

export type AsLabPicketDestination = "RUANGAN_ASLAB" | "LAB_MULTIMEDIA" | "LAB_DASAR";

export interface Shift {
  id: string;
  name?: string;
  labId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  checkoutGraceMinutes: number;
  isTaskRequired: boolean;
  isActive: boolean;
  lab?: Lab;
}

export interface AttendanceSettings {
  id: string;
  isGeofencingEnabled: boolean;
  defaultRadiusMeter: number;
  lateToleranceMinutes: number;
  checkoutGraceMinutes: number;
  forgotCheckoutAfterMinutes: number;
  isTaskRequired: boolean;
  isVerificationRequired: boolean;
  activePicketWeekdays: number[];
}

export interface AttendanceCorrectionRequest {
  id: string;
  attendanceId: string;
  userId: string;
  requestType: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
  evidenceUrl?: string;
  status: CorrectionRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  attendance?: AttendanceEntry;
  user?: User;
  reviewer?: User;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalWorkMinutes: number;
  averageWorkMinutes: number;
  totalTasks: number;
  approvedTasks: number;
  present?: number;
  late?: number;
  absent?: number;
  totalHours?: number;
  averageHoursPerDay?: number;
  forgotCheckout?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  nim?: string;
  nip?: string;
  role: Role;
  semester?: string;
  className?: string;
  isKetuaKelas: boolean;
  avatar?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lab {
  id: string;
  name: string;
  location: string;
  description?: string;
  status: LabStatus;
  capacity: number;
  isPicketEnabled: boolean;
  defaultPicketAssistantCount: number;
  pcs?: PC[];
  createdAt: string;
  updatedAt: string;
}

export interface PC {
  id: string;
  labId: string;
  pcCode: string;
  assetCode?: string;
  name: string;
  positionX: number;
  positionY: number;
  status: PCStatus;
  qrCode?: string;
  ipAddress?: string;
  macAddress?: string;
  specs?: string;
  powerWatt?: number;
  isOnline: boolean;
  lastSeen?: string;
  uptimeMinutes: number;
  agentStatus: AgentStatus;
  healthStatus: HealthStatus;
  hostname?: string;
  os?: string;
  architecture?: string;
  cpuModel?: string;
  cpuUsage?: number;
  ramUsage?: number;
  ramTotalGb?: number;
  storageUsage?: number;
  storageTotalGb?: number;
  uptimeSeconds: number;
  agentVersion?: string;
  isAgentInstalled: boolean;
  lab?: Lab;
  _count?: {
    tickets: number;
    statusLogs: number;
    commands: number;
    warnings: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PcAgentLog {
  id: string;
  pcId: string;
  eventType: string;
  level: string;
  message?: string;
  createdAt: string;
}

export interface PcWarning {
  id: string;
  pcId: string;
  warningType: string;
  severity: string;
  message?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PCDetail extends PC {
  tickets: unknown[];
  statusLogs: unknown[];
  commands: unknown[];
  agentLogs: PcAgentLog[];
  warnings: PcWarning[];
}

export interface PCAnalytics {
  totalPCs: number;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  warningCount: number;
  needsCheckCount: number;
  statusCounts: { status: string; count: number }[];
  agentStatusCounts: { agentStatus: string; count: number }[];
  healthStatusCounts: { healthStatus: string; count: number }[];
  issuesByCategory: { warningType: string; count: number }[];
}

export interface Schedule {
  id: string;
  labId: string;
  title: string;
  semester?: string;
  className?: string;
  lecturerName?: string;
  assistantId?: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  type: ScheduleType;
  isActive: boolean;
  lab?: Lab;
  assistant?: User;
  createdAt: string;
  updatedAt: string;
}

export interface LabBooking {
  id: string;
  labId: string;
  requestedBy: string;
  approvedBy?: string;
  title: string;
  description?: string;
  purpose: "UKM" | "Lomba" | "Kerja Kelompok" | "Riset" | "Pelatihan" | "Lainnya";
  date: string;
  startTime: string;
  endTime: string;
  participants: number;
  status: BookingStatus;
  rejectionReason?: string;
  notes?: string;
  lab?: Lab;
  requester?: User;
  approver?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Logbook {
  id: string;
  date: string;
  officialCheckinById?: string;
  officialCheckinAt?: string;
  officialCheckoutById?: string;
  officialCheckoutAt?: string;
  status: LogbookStatus;
  notes?: string;
  officialCheckinBy?: User;
  officialCheckoutBy?: User;
  conditions: LogbookCondition[];
  createdAt: string;
  updatedAt: string;
}

export interface LogbookCondition {
  id: string;
  logbookId: string;
  labId: string;
  submittedById?: string;
  kerusakanBaru?: string;
  catatanKondisi?: string;
  fotoBukti: string[];
  verified: boolean;
  verifiedById?: string;
  verifiedAt?: string;
  lab?: Lab;
  submittedBy?: User;
  verifiedBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Key {
  id: string;
  labId: string;
  keyCode: string;
  qrCode?: string;
  status: KeyStatus;
  currentHolderId?: string;
  lab?: Lab;
  currentHolder?: User;
  createdAt: string;
  updatedAt: string;
}

export interface KeyLog {
  id: string;
  keyId: string;
  userId: string;
  action: KeyAction;
  takenAt?: string;
  returnedAt?: string;
  notes?: string;
  key?: Key;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  pcId?: string;
  labId: string;
  reportedBy: string;
  assignedTo?: string;
  category: TicketCategory;
  title: string;
  description?: string;
  photo: string[];
  status: TicketStatus;
  priority: TicketPriority;
  resolvedAt?: string;
  pc?: PC;
  lab?: Lab;
  reporter?: User;
  assignee?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  title: string;
  description?: string;
  points: number;
  deadline?: string;
  status: MissionStatus;
  createdById: string;
  createdBy?: User;
  claims?: MissionClaim[];
  createdAt: string;
  updatedAt: string;
}

export interface MissionClaim {
  id: string;
  missionId: string;
  aslebId: string;
  status: MissionStatus;
  proof?: string;
  verifiedById?: string;
  verifiedAt?: string;
  mission?: Mission;
  asleb?: User;
  verifiedBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  userId: string;
  checkinAt?: string;
  checkoutAt?: string;
  latitude?: number;
  longitude?: number;
  status: AttendanceStatus;
  notes?: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTaskLog {
  id: string;
  userId: string;
  task: string;
  description?: string;
  date: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Point {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  referenceId?: string;
  user?: User;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  isPinned: boolean;
  startDate: string;
  endDate?: string | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  _count?: { reads: number };
  isRead?: boolean;
}
