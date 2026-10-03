import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import { AuthGate, SettingsPanel, apiAssetUrl, authFetch, type AuthUser, type PublicBrand } from './auth-settings'

type Page = 'dashboard' | 'students' | 'classes' | 'branches' | 'attendance' | 'tuition' | 'finance' | 'reports' | 'staff' | 'settings'
type Branch = {
  id: string
  code: string
  name: string
  address?: string | null
  phone?: string | null
}

type Student = {
  id: string
  code: string
  fullName: string
  dateOfBirth?: string | null
  gender?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  joinedAt: string
  status: string
  beltLevel?: string | null
  note?: string | null
  consecutiveAbsences: number
  attendanceStats?: {
    attended: number
    total: number | null
    recorded: number
    subscriptionId?: string | null
    packageId?: string | null
    packageName?: string | null
  }
  branchId: string
  branch?: Branch
  createdAt: string
  updatedAt: string
}

type StudentsResponse = {
  data: Student[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type StudentForm = {
  fullName: string
  dateOfBirth: string
  gender: string
  phone: string
  email: string
  address: string
  beltLevel: string
  note: string
  branchId: string
  status: string
}

const emptyStudentForm: StudentForm = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  beltLevel: '',
  note: '',
  branchId: '',
  status: 'ACTIVE',
}

type StudentModalMode = 'create' | 'view' | 'edit'

function studentToForm(student: Student): StudentForm {
  return {
    fullName: student.fullName ?? '',
    dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
    gender: student.gender ?? '',
    phone: student.phone ?? '',
    email: student.email ?? '',
    address: student.address ?? '',
    beltLevel: student.beltLevel ?? '',
    note: student.note ?? '',
    branchId: student.branchId ?? '',
    status: student.status ?? 'ACTIVE',
  }
}



type KarateClass = {
  id: string
  code: string
  name: string
  description?: string | null
  branchId: string
  teacherId?: string | null
  capacity?: number | null
  scheduleText?: string | null
  tuitionPerSession?: number | string | null
  active: boolean
  createdAt: string
  branch?: Branch
  teacher?: {
    id: string
    user?: { fullName?: string; name?: string } | null
  } | null
  _count?: { enrollments: number }
}

type Enrollment = {
  id: string
  studentId: string
  classId: string
  status: string
  startedAt: string
  endedAt?: string | null
  customPricePerSession?: number | string | null
  student: Student
}

type ClassForm = {
  code: string
  name: string
  description: string
  branchId: string
  capacity: string
  scheduleText: string
  tuitionPerSession: string
}

const emptyClassForm: ClassForm = {
  code: '',
  name: '',
  description: '',
  branchId: '',
  capacity: '',
  scheduleText: '',
  tuitionPerSession: '',
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'MAKEUP'

type ClassSession = {
  id: string
  classId: string
  teacherId?: string | null
  startsAt: string
  endsAt?: string | null
  topic?: string | null
  note?: string | null
  isCancelled: boolean
  class: KarateClass
  _count?: { attendances: number }
}

type SessionAttendanceRow = {
  enrollmentId?: string | null
  studentId: string
  code: string
  fullName: string
  beltLevel?: string | null
  consecutiveAbsences: number
  status: AttendanceStatus | null
  note?: string
  saved: boolean
}

type SessionAttendanceResponse = {
  session: ClassSession
  rows: SessionAttendanceRow[]
}

type StudentAttendanceHistory = {
  student: {
    id: string
    code: string
    fullName: string
    beltLevel?: string | null
    status: string
    branch?: Branch | null
  }
  summary: {
    attended: number
    total: number
    recorded: number
  }
  rows: Array<{
    sessionId: string
    classId: string
    classCode: string
    className: string
    startsAt: string
    topic?: string | null
    status: AttendanceStatus | null
    note?: string | null
    checkedAt?: string | null
  }>
}
type PackageBillingType = 'TIME_BASED' | 'SESSION_BASED' | 'PT' | 'CUSTOM'
type PackageDurationUnit = 'DAY' | 'WEEK' | 'MONTH'

type LearningPackage = {
  id: string
  code: string
  name: string
  billingType: PackageBillingType
  durationValue?: number | null
  durationUnit?: PackageDurationUnit | null
  sessionsPerWeek?: number | null
  includedSessions?: number | null
  price: string | number
  description?: string | null
  active: boolean
}

type StudentPackageSubscription = {
  id: string
  studentId: string
  packageId: string
  startDate: string
  endDate?: string | null
  paymentDueDate?: string | null
  status: string
  displayStatus: string
  packageNameSnapshot: string
  sessionsPerWeekSnapshot?: number | null
  includedSessionsSnapshot?: number | null
  priceSnapshot: number
  note?: string | null
  student: Student
  package: LearningPackage
  usage: {
    usedSessions: number
    remainingSessions: number | null
  }
  billing: {
    invoiceId: string | null
    invoiceNo: string | null
    total: number
    paidAmount: number
    remaining: number
    status: string
    dueDate?: string | null
  }
}

type PackageInvoice = {
  id: string
  invoiceNo: string
  dueDate: string
  status: string
  displayStatus: string
  total: number
  paidAmount: number
  remaining: number
  student: Student
  studentPackage?: StudentPackageSubscription | null
}

type PackageWarning = {
  type: string
  severity: 'danger' | 'warning'
  studentId: string
  studentName: string
  subscriptionId: string
  packageName: string
  message: string
  amount?: number
  date?: string
  remainingSessions?: number
}


type InvoiceQr = {
  invoiceId: string
  invoiceNo: string
  studentId: string
  studentName: string
  packageName: string
  amount: number
  bankId: string
  accountNo: string
  accountName: string
  addInfo: string
  template: string
  qrImageUrl: string
}

type PaymentReceipt = {
  id: string
  paymentNo: string
  amount: number
  method: string
  paidAt: string
  receipt?: {
    id: string
    receiptNo: string
    issuedAt: string
  } | null
  invoice?: {
    id: string
    invoiceNo: string
    studentName: string
    total: number
    paidAmount: number
  }
}


type BankTransferEvent = {
  id: string
  provider: string
  transactionId: string
  amount: number
  description: string
  accountNo?: string | null
  transferredAt: string
  status: 'RECEIVED' | 'MATCHED' | 'UNMATCHED' | 'NEEDS_REVIEW' | 'IGNORED'
  invoiceId?: string | null
  paymentId?: string | null
  note?: string | null
}


type ClassContent = {
  id: string
  classId: string
  teacherId?: string | null
  title: string
  content: string
  createdAt: string
}

type BranchAdmin = Branch & {
  createdAt: string
  stats: {
    activeStudents: number
    allStudents: number
    activeClasses: number
    monthlyIncome: number
    monthlyExpense: number
    monthlyBalance: number
  }
}

type DashboardOverview = {
  generatedAt: string
  branchId: string | null
  metrics: {
    activeStudents: number
    attendanceRate: number
    monthlyRevenue: number
    monthlyExpenses: number
    monthlyBalance: number
    tuitionDebt: number
  }
  todaySessions: Array<{
    id: string
    classId: string
    startsAt: string
    endsAt?: string | null
    topic?: string | null
    className: string
    classCode: string
    branchName: string
    teacherName: string
    attendanceCount: number
  }>
  quickAttendanceTarget?: {
    classId: string
    sessionId: string
    className: string
    startsAt: string
  } | null
  alerts: Array<{
    tone: string
    title: string
    text: string
    targetPage: Page
  }>
  revenueHistory: Array<{ label: string; value: number }>
  branches: Array<{ id: string; code: string; name: string }>
}

type FinanceSummary = {
  branchId: string | null
  monthStart: string
  monthEnd: string
  monthlyIncome: number
  monthlyExpense: number
  monthlyBalance: number
  monthlySales: number
  salesCount: number
  activeProducts: number
  lowStockProducts: number
}

type CashTransactionItem = {
  id: string
  branchId: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  amount: number
  occurredAt: string
  description?: string | null
  referenceType?: string | null
  referenceId?: string | null
  branch: Branch
}

type ProductItem = {
  id: string
  sku: string
  name: string
  unit?: string | null
  price: number
  cost?: number | null
  stockQty: number
  active: boolean
}

type SaleItemView = {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  amount: number
  product: ProductItem
}

type SaleView = {
  id: string
  saleNo: string
  branchId: string
  studentId?: string | null
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  total: number
  soldAt: string
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'OTHER'
  paymentReference?: string | null
  paymentNote?: string | null
  branch: Branch
  student?: {
    id: string
    code: string
    fullName: string
  } | null
  items: SaleItemView[]
}

type SaleQr = {
  saleNo: string
  amount: number
  bankId: string
  accountNo: string
  accountName: string
  addInfo: string
  template: string
  qrImageUrl: string
}


type ReportOverview = {
  from: string
  to: string
  branchId: string | null
  metrics: {
    activeStudents: number
    newStudents: number
    activeClasses: number
    attendanceRate: number
    attendanceRecords: number
    income: number
    expense: number
    balance: number
    tuitionDebt: number
    salesRevenue: number
    salesCount: number
    riskyStudents: number
  }
  branches: Array<{ id: string; code: string; name: string }>
}

type AttendanceReport = {
  from: string
  to: string
  summary: {
    total: number
    present: number
    absent: number
    late: number
    excused: number
    makeup: number
    rate: number
  }
  classes: Array<{
    classId: string
    classCode: string
    className: string
    branchName: string
    sessions: number
    total: number
    present: number
    absent: number
    late: number
    excused: number
    makeup: number
    rate: number
  }>
  students: Array<{
    studentId: string
    code: string
    fullName: string
    branchName: string
    total: number
    present: number
    absent: number
    late: number
    excused: number
    makeup: number
    rate: number
  }>
}

type DebtReport = {
  totalDebt: number
  overdueDebt: number
  overdueCount: number
  rows: Array<{
    id: string
    invoiceNo: string
    studentId: string
    studentCode: string
    studentName: string
    branchName: string
    packageName: string
    dueDate: string
    total: number
    paidAmount: number
    remaining: number
    status: string
  }>
}

type FinanceReport = {
  from: string
  to: string
  summary: {
    income: number
    expense: number
    balance: number
    salesRevenue: number
    salesCount: number
  }
  categories: Array<{
    type: 'INCOME' | 'EXPENSE'
    category: string
    amount: number
    count: number
  }>
  products: Array<{
    productId: string
    sku: string
    name: string
    quantity: number
    revenue: number
  }>
  daily: Array<{
    date: string
    income: number
    expense: number
  }>
}

type RiskReportRow = {
  id: string
  code: string
  fullName: string
  phone?: string | null
  branchName: string
  beltLevel?: string | null
  consecutiveAbsences: number
  status: string
}

type ZaloAutomationStatus = {
  enabled: boolean
  accessTokenConfigured: boolean
  adminUidConfigured: boolean
  sendUrl: string
  guardianCoverage: {
    totalGuardians: number
    withZaloUid: number
  }
  schedules: string[]
  recentLogs: Array<{
    id: string
    templateKey?: string | null
    recipient: string
    content: string
    status: string
    providerId?: string | null
    error?: string | null
    sentAt?: string | null
    createdAt: string
    student?: {
      code: string
      fullName: string
    } | null
  }>
}


type StaffOverview = {
  activePeople: number
  activeTeachers: number
  activeClasses: number
  unassignedClasses: number
  openTasks: number
  overdueTasks: number
  monthSessionCount: number
  monthMinutes: number
  monthPayroll: number
}

type StaffRole = {
  id: string
  code: string
  name: string
  description?: string | null
}

type StaffPerson = {
  id: string
  username: string
  fullName: string
  phone?: string | null
  email?: string | null
  avatarUrl?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
  createdAt: string
  roles: StaffRole[]
  teacher?: {
    id: string
    employeeCode: string
    payPerSession: number
    payPerHour: number
    active: boolean
    classes: Array<{
      id: string
      code: string
      name: string
      branchId: string
      branchName: string
      scheduleText?: string | null
    }>
  } | null
}

type StaffClassItem = {
  id: string
  code: string
  name: string
  branchId: string
  branchName: string
  scheduleText?: string | null
  teacherId?: string | null
  teacherName?: string | null
  enrollmentCount: number
}

type StaffTimesheet = {
  id: string
  teacherId: string
  teacherName: string
  employeeCode: string
  workDate: string
  minutes: number
  sessionCount: number
  amount: number
  note?: string | null
  sessionId?: string | null
  session?: {
    id: string
    startsAt: string
    classId: string
    classCode: string
    className: string
  } | null
}

type StaffPayrollRow = {
  teacherId: string
  employeeCode: string
  fullName: string
  active: boolean
  payPerSession: number
  payPerHour: number
  sessionCount: number
  minutes: number
  amount: number
  timesheetCount: number
}

type StaffTask = {
  id: string
  title: string
  description?: string | null
  creatorId: string
  creatorName: string
  ownerId?: string | null
  ownerName?: string | null
  dueAt?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority: number
  createdAt: string
  updatedAt: string
  overdue: boolean
}

type StaffPersonForm = {
  username: string
  fullName: string
  phone: string
  email: string
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
  roleId: string
  isTeacher: boolean
  employeeCode: string
  payPerSession: string
  payPerHour: string
}

const emptyStaffPersonForm: StaffPersonForm = {
  username: '',
  fullName: '',
  phone: '',
  email: '',
  status: 'ACTIVE',
  roleId: '',
  isTeacher: false,
  employeeCode: '',
  payPerSession: '',
  payPerHour: '',
}

type PackageForm = {
  code: string
  name: string
  billingType: PackageBillingType
  durationValue: string
  durationUnit: PackageDurationUnit
  sessionsPerWeek: string
  includedSessions: string
  price: string
  description: string
}

const BELT_LEVELS = [
  'Đai Trắng',
  'Đai Cam',
  'Đai Xanh Dương',
  'Đai Đỏ',
  'Đai Vàng',
  'Đai Xanh Lá',
  'Đai Tím',
  'Đai Nâu',
  'Đai Đen',
] as const

const emptyPackageForm: PackageForm = {
  code: '',
  name: '',
  billingType: 'TIME_BASED',
  durationValue: '1',
  durationUnit: 'MONTH',
  sessionsPerWeek: '',
  includedSessions: '',
  price: '',
  description: '',
}


const apiBase = import.meta.env.VITE_API_URL ?? '/api'
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function usernameFromFullName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

const nav: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Tổng quan', icon: '▦' },
  { id: 'students', label: 'Học viên', icon: '♙' },
  { id: 'classes', label: 'Lớp học', icon: '◇' },
  { id: 'branches', label: 'Chi nhánh', icon: '⌂' },
  { id: 'attendance', label: 'Điểm danh', icon: '✓' },
  { id: 'tuition', label: 'Học phí & công nợ', icon: '₫' },
  { id: 'finance', label: 'Thu chi & bán hàng', icon: '↗' },
  { id: 'reports', label: 'Báo cáo', icon: '▥' },
  { id: 'staff', label: 'Nhân sự & giáo viên', icon: '♧' },
  { id: 'settings', label: 'Thiết lập', icon: '⚙' },
]

const navPermission: Record<Page, string> = {
  dashboard: 'DASHBOARD_VIEW',
  students: 'STUDENTS_VIEW',
  classes: 'CLASSES_VIEW',
  branches: 'BRANCHES_VIEW',
  attendance: 'ATTENDANCE_VIEW',
  tuition: 'TUITION_VIEW',
  finance: 'FINANCE_VIEW',
  reports: 'REPORTS_VIEW',
  staff: 'STAFF_VIEW',
  settings: 'SETTINGS_VIEW',
}

async function fetchStudents(search = ''): Promise<StudentsResponse> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  params.set('page', '1')
  params.set('limit', '500')

  const response = await authFetch(`${apiBase}/students?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Không tải được học viên (${response.status})`)
  }

  return response.json()
}

async function fetchBranches(): Promise<Branch[]> {
  const response = await authFetch(`${apiBase}/branches`)
  if (!response.ok) {
    throw new Error(`Không tải được chi nhánh (${response.status})`)
  }
  return response.json()
}

async function createStudent(form: StudentForm): Promise<Student> {
  const payload = {
    fullName: form.fullName.trim(),
    branchId: form.branchId,
    status: form.status,
    ...(form.dateOfBirth && { dateOfBirth: form.dateOfBirth }),
    ...(form.gender.trim() && { gender: form.gender.trim() }),
    ...(form.phone.trim() && { phone: form.phone.trim() }),
    ...(form.email.trim() && { email: form.email.trim() }),
    ...(form.address.trim() && { address: form.address.trim() }),
    ...(form.beltLevel.trim() && { beltLevel: form.beltLevel.trim() }),
    ...(form.note.trim() && { note: form.note.trim() }),
  }

  const response = await authFetch(`${apiBase}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể thêm học viên (${response.status})`)
  }

  return response.json()
}


async function updateStudent(id: string, form: StudentForm): Promise<Student> {
  const payload = {
    fullName: form.fullName.trim(),
    branchId: form.branchId,
    status: form.status,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    beltLevel: form.beltLevel.trim() || undefined,
    note: form.note.trim() || undefined,
  }

  const response = await authFetch(`${apiBase}/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể cập nhật học viên (${response.status})`)
  }

  return response.json()
}

async function removeStudent(id: string): Promise<void> {
  const response = await authFetch(`${apiBase}/students/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể xóa học viên (${response.status})`)
  }
}


async function fetchClasses(): Promise<KarateClass[]> {
  const response = await authFetch(`${apiBase}/classes`)
  if (!response.ok) throw new Error(`Không tải được lớp học (${response.status})`)

  const classes: KarateClass[] = await response.json()

  // /api/classes ở một số bản backend cũ chưa include quan hệ teacher.user.
  // Ghép dữ liệu phân công từ module Staff để trang Lớp học luôn hiển thị
  // đúng giáo viên ngay sau khi phân công.
  try {
    const staffResponse = await authFetch(`${apiBase}/staff/classes`)
    if (!staffResponse.ok) return classes

    const assignments: Array<{
      id: string
      teacherId?: string | null
      teacherName?: string | null
    }> = await staffResponse.json()

    const assignmentMap = new Map(
      assignments.map((item) => [item.id, item]),
    )

    return classes.map((item) => {
      const assignment = assignmentMap.get(item.id)
      if (!assignment) return item

      return {
        ...item,
        teacherId: assignment.teacherId ?? null,
        teacher: assignment.teacherId
          ? {
              id: assignment.teacherId,
              user: { fullName: assignment.teacherName ?? 'Giáo viên' },
            }
          : null,
      }
    })
  } catch {
    return classes
  }
}

async function fetchClassEnrollments(classId: string): Promise<Enrollment[]> {
  const response = await authFetch(`${apiBase}/enrollments/class/${classId}`)
  if (!response.ok) throw new Error(`Không tải được danh sách học viên (${response.status})`)
  return response.json()
}

async function createClassApi(form: ClassForm): Promise<KarateClass> {
  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
    branchId: form.branchId,
    ...(form.description.trim() && { description: form.description.trim() }),
    ...(form.capacity && { capacity: Number(form.capacity) }),
    ...(form.scheduleText.trim() && { scheduleText: form.scheduleText.trim() }),
    ...(form.tuitionPerSession && { tuitionPerSession: Number(form.tuitionPerSession) }),
  }

  const response = await authFetch(`${apiBase}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể tạo lớp (${response.status})`)
  }

  return response.json()
}

async function updateClassApi(id: string, form: ClassForm): Promise<KarateClass> {
  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
    branchId: form.branchId,
    description: form.description.trim(),
    capacity: form.capacity ? Number(form.capacity) : undefined,
    scheduleText: form.scheduleText.trim(),
    tuitionPerSession: form.tuitionPerSession ? Number(form.tuitionPerSession) : undefined,
  }

  const response = await authFetch(`${apiBase}/classes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể cập nhật lớp (${response.status})`)
  }

  return response.json()
}

async function removeClassApi(id: string): Promise<void> {
  const response = await authFetch(`${apiBase}/classes/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể xóa lớp (${response.status})`)
  }
}

function classToForm(karateClass: KarateClass): ClassForm {
  return {
    code: karateClass.code ?? '',
    name: karateClass.name ?? '',
    description: karateClass.description ?? '',
    branchId: karateClass.branchId ?? '',
    capacity: karateClass.capacity == null ? '' : String(karateClass.capacity),
    scheduleText: karateClass.scheduleText ?? '',
    tuitionPerSession: karateClass.tuitionPerSession == null ? '' : String(karateClass.tuitionPerSession),
  }
}

async function createEnrollmentApi(classId: string, studentId: string): Promise<Enrollment> {
  const response = await authFetch(`${apiBase}/enrollments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ classId, studentId }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể xếp học viên vào lớp (${response.status})`)
  }

  return response.json()
}

async function removeEnrollmentApi(enrollmentId: string): Promise<void> {
  const response = await authFetch(`${apiBase}/enrollments/${enrollmentId}`, { method: 'DELETE' })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể đưa học viên ra khỏi lớp (${response.status})`)
  }
}


type CopyEnrollmentResult = {
  copied: number
  skipped: number
  totalSource: number
  message?: string
}

async function copyClassEnrollmentsApi(
  sourceClassId: string,
  targetClassId: string,
): Promise<CopyEnrollmentResult> {
  const response = await authFetch(`${apiBase}/enrollments/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ sourceClassId, targetClassId }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Không thể sao chép học viên (${response.status})`)
  }

  return response.json()
}


function AuthenticatedApp({
  currentUser,
  brand,
  onLogout,
  onUserUpdated,
  onBrandUpdated,
  onAppearance,
}: {
  currentUser: AuthUser
  brand: PublicBrand
  onLogout: () => Promise<void>
  onUserUpdated: (user: AuthUser) => void
  onBrandUpdated: (brand: Partial<PublicBrand>) => void
  onAppearance: (theme: PublicBrand['defaultTheme'], accent: string) => void
}) {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [studentResults, setStudentResults] = useState<Student[]>([])
  const [studentTotal, setStudentTotal] = useState(0)
  const [studentLoading, setStudentLoading] = useState(true)
  const [studentError, setStudentError] = useState('')
  const [search, setSearch] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [studentModalMode, setStudentModalMode] = useState<StudentModalMode>('create')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentForm, setStudentForm] = useState<StudentForm>(emptyStudentForm)
  const [studentSaving, setStudentSaving] = useState(false)
  const [studentFormError, setStudentFormError] = useState('')
  const [tuitionWarningCount, setTuitionWarningCount] = useState(0)
  const [financeWarningCount, setFinanceWarningCount] = useState(0)
  const [staffWarningCount, setStaffWarningCount] = useState(0)
  const [attendanceTarget, setAttendanceTarget] = useState<{ classId?: string; sessionId?: string; studentId?: string }>({})
  const [avatarRefresh, setAvatarRefresh] = useState(0)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const isOwner = currentUser.roles.some((role) => role.code === 'OWNER')
  const can = (permission: string) => isOwner || currentUser.permissions.includes(permission)
  const visibleNav = nav.filter((item) => item.id === 'settings' || can(navPermission[item.id]))
  const hasStudentAccess = can('STUDENTS_VIEW')
  const hasBranchAccess = can('BRANCHES_VIEW') || can('CLASSES_VIEW') || can('STUDENTS_VIEW') || can('FINANCE_VIEW') || can('REPORTS_VIEW')
  const hasTuitionAccess = can('TUITION_VIEW')
  const hasFinanceAccess = can('FINANCE_VIEW')
  const hasStaffAccess = can('STAFF_VIEW')
  const hasAnyModuleAccess = visibleNav.length > 0

  useEffect(() => {
    if (!visibleNav.some((item) => item.id === page) && visibleNav[0]) {
      setPage(visibleNav[0].id)
    }
  }, [page, currentUser.id, currentUser.permissions.join('|'), currentUser.roles.map((role) => role.code).join('|')])

  const loadAllStudents = async () => {
    setStudentLoading(true)
    setStudentError('')
    try {
      const result = await fetchStudents()
      setStudents(result.data)
      setStudentResults(result.data)
      setStudentTotal(result.pagination.total)
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : 'Không tải được danh sách học viên')
    } finally {
      setStudentLoading(false)
    }
  }

  useEffect(() => {
    if (hasStudentAccess) {
      void loadAllStudents()
    } else {
      setStudentLoading(false)
      setStudents([])
      setStudentResults([])
      setStudentTotal(0)
    }
  }, [hasStudentAccess])

  const loadBranches = async () => {
    try {
      setBranches(await fetchBranches())
    } catch {
      setBranches([])
    }
  }

  useEffect(() => {
    if (hasBranchAccess) void loadBranches()
    else setBranches([])
  }, [hasBranchAccess])


  useEffect(() => {
    const loadWarningCount = async () => {
      try {
        const response = await authFetch(
          `${apiBase}/learning-packages/warnings?days=7`,
        )
        if (!response.ok) return
        const data = await response.json()
        setTuitionWarningCount(
          Array.isArray(data) ? data.length : 0,
        )
      } catch {
        setTuitionWarningCount(0)
      }
    }

    if (hasTuitionAccess) void loadWarningCount()
    else setTuitionWarningCount(0)
  }, [hasTuitionAccess])

  useEffect(() => {
    const loadFinanceWarningCount = async () => {
      try {
        const response = await authFetch(`${apiBase}/finance-sales/summary`)
        if (!response.ok) {
          setFinanceWarningCount(0)
          return
        }

        const data: FinanceSummary = await response.json()
        setFinanceWarningCount(Number(data.lowStockProducts ?? 0))
      } catch {
        setFinanceWarningCount(0)
      }
    }

    if (hasFinanceAccess) void loadFinanceWarningCount()
    else setFinanceWarningCount(0)
  }, [hasFinanceAccess])


  useEffect(() => {
    const loadStaffWarningCount = async () => {
      try {
        const response = await authFetch(`${apiBase}/staff/overview`)
        if (!response.ok) {
          setStaffWarningCount(0)
          return
        }

        const data: StaffOverview = await response.json()
        setStaffWarningCount(
          Number(data.overdueTasks ?? 0) + Number(data.unassignedClasses ?? 0),
        )
      } catch {
        setStaffWarningCount(0)
      }
    }

    if (hasStaffAccess) void loadStaffWarningCount()
    else setStaffWarningCount(0)
  }, [hasStaffAccess])

  const uploadStudentAvatar = async (student: Student, file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStudentFormError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setStudentFormError('Ảnh đại diện không được lớn hơn 4 MB.')
      return
    }

    setAvatarUploading(true)
    setStudentFormError('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Không đọc được file ảnh'))
        reader.readAsDataURL(file)
      })

      const response = await authFetch(`${apiBase}/student-avatars/${student.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không tải được ảnh (${response.status})`)
      }
      setAvatarRefresh(Date.now())
    } catch (error) {
      setStudentFormError(error instanceof Error ? error.message : 'Không tải được ảnh đại diện')
    } finally {
      setAvatarUploading(false)
    }
  }

  const openQuickAttendance = (classId?: string, sessionId?: string) => {
    setAttendanceTarget({ classId, sessionId })
    setPage('attendance')
  }

  const openStudentAttendance = (student: Student) => {
    setAttendanceTarget({ studentId: student.id })
    setPage('attendance')
  }

  const openStudentModal = () => {
    const defaultBranchId = branches.length === 1 ? branches[0].id : ''
    setSelectedStudent(null)
    setStudentModalMode('create')
    setStudentForm({ ...emptyStudentForm, branchId: defaultBranchId })
    setStudentFormError('')
    setStudentModalOpen(true)
  }

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student)
    setStudentModalMode('view')
    setStudentForm(studentToForm(student))
    setStudentFormError('')
    setStudentModalOpen(true)
  }

  const startStudentEdit = () => {
    if (!selectedStudent) return
    setStudentForm(studentToForm(selectedStudent))
    setStudentFormError('')
    setStudentModalMode('edit')
  }

  const closeStudentModal = () => {
    if (studentSaving) return
    setStudentModalOpen(false)
    setSelectedStudent(null)
    setStudentModalMode('create')
    setStudentFormError('')
  }

  const submitStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!studentForm.fullName.trim()) {
      setStudentFormError('Vui lòng nhập họ tên học viên.')
      return
    }
    if (!studentForm.branchId) {
      setStudentFormError('Vui lòng chọn chi nhánh.')
      return
    }

    setStudentSaving(true)
    setStudentFormError('')
    try {
      if (studentModalMode === 'edit' && selectedStudent) {
        await updateStudent(selectedStudent.id, studentForm)
      } else {
        await createStudent(studentForm)
      }

      setStudentModalOpen(false)
      setSelectedStudent(null)
      setStudentModalMode('create')
      setStudentForm(emptyStudentForm)
      await loadAllStudents()
    } catch (error) {
      setStudentFormError(error instanceof Error ? error.message : 'Không thể lưu học viên')
    } finally {
      setStudentSaving(false)
    }
  }

  const deleteSelectedStudent = async () => {
    if (!selectedStudent) return
    const confirmed = window.confirm(`Xóa học viên ${selectedStudent.fullName}? Dữ liệu lịch sử sẽ được giữ lại.`)
    if (!confirmed) return

    setStudentSaving(true)
    setStudentFormError('')
    try {
      await removeStudent(selectedStudent.id)
      setStudentModalOpen(false)
      setSelectedStudent(null)
      setStudentModalMode('create')
      await loadAllStudents()
    } catch (error) {
      setStudentFormError(error instanceof Error ? error.message : 'Không thể xóa học viên')
    } finally {
      setStudentSaving(false)
    }
  }

  useEffect(() => {
    if (page !== 'students') return

    const timer = window.setTimeout(async () => {
      setStudentLoading(true)
      setStudentError('')
      try {
        const result = await fetchStudents(search)
        setStudentResults(result.data)
        setStudentTotal(result.pagination.total)
      } catch (error) {
        setStudentError(error instanceof Error ? error.message : 'Không tìm kiếm được học viên')
      } finally {
        setStudentLoading(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [page, search])

  const pageTitle = hasAnyModuleAccess
    ? visibleNav.find((item) => item.id === page)?.label ?? nav.find((item) => item.id === page)?.label ?? 'Tổng quan'
    : 'Tài khoản Khách'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className={`brand-mark ${brand.logoUrl ? 'has-logo' : ''}`}>
            {brand.logoUrl ? <img src={apiAssetUrl(brand.logoUrl)} alt="Logo võ đường" /> : '空'}
          </div>
          <div>
            <strong>{brand.dojoName}</strong>
            <span>{brand.slogan || 'Management System'}</span>
          </div>
        </div>

        <nav>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => {
                if (item.id === 'attendance') setAttendanceTarget({})
                setPage(item.id)
                setMobileNav(false)
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'tuition' && tuitionWarningCount > 0 && (
                <span className="badge">
                  {tuitionWarningCount > 99 ? '99+' : tuitionWarningCount}
                </span>
              )}
              {item.id === 'finance' && financeWarningCount > 0 && (
                <span className="badge">
                  {financeWarningCount > 99 ? '99+' : financeWarningCount}
                </span>
              )}
              {item.id === 'staff' && staffWarningCount > 0 && (
                <span className="badge">
                  {staffWarningCount > 99 ? '99+' : staffWarningCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer auth-sidebar-footer">
          <div className="user-avatar">
            {currentUser.avatarUrl
              ? <img src={apiAssetUrl(currentUser.avatarUrl)} alt={currentUser.fullName} />
              : currentUser.fullName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}
          </div>
          <div className="sidebar-user-copy">
            <strong>{currentUser.fullName}</strong>
            <span>{currentUser.roles.map((role) => role.name).join(', ') || 'Chưa phân vai trò'}</span>
          </div>
          <button className="sidebar-logout" title="Đăng xuất" onClick={() => void onLogout()}>↪</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMobileNav((value) => !value)}>☰</button>
          <div>
            <h1>{pageTitle}</h1>
            <p>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</p>
          </div>
          <div className="top-actions">
            {hasStudentAccess && (
              <label className="search-box">
                <span>⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm học viên..." />
              </label>
            )}
            <button className="icon-button">♢<span className="notification-dot"></span></button>
          </div>
        </header>

        <section className="content">
          {!hasAnyModuleAccess && (
            <GuestAccessPage currentUser={currentUser} />
          )}
          {hasAnyModuleAccess && page === 'dashboard' && (
            <Dashboard
              onNavigate={setPage}
              onQuickAttendance={openQuickAttendance}
            />
          )}
          {hasAnyModuleAccess && page === 'students' && (
            <StudentsPage
              students={studentResults}
              total={studentTotal}
              loading={studentLoading}
              error={studentError}
              onAdd={openStudentModal}
              onView={openStudentDetails}
              onAttendance={openStudentAttendance}
            />
          )}
          {hasAnyModuleAccess && page === 'classes' && <ClassesPage students={students} branches={branches} />}
          {hasAnyModuleAccess && page === 'branches' && <BranchesPage onBranchesChanged={loadBranches} />}
          {hasAnyModuleAccess && page === 'attendance' && (
            <AttendancePage
              initialClassId={attendanceTarget.classId}
              initialSessionId={attendanceTarget.sessionId}
              initialStudentId={attendanceTarget.studentId}
              onAttendanceSaved={loadAllStudents}
            />
          )}
          {hasAnyModuleAccess && page === 'tuition' && (
            <TuitionPage
              students={students}
              onWarningCountChange={setTuitionWarningCount}
            />
          )}
          {hasAnyModuleAccess && page === 'finance' && (
            <FinancePage
              students={students}
              branches={branches}
              onWarningCountChange={setFinanceWarningCount}
            />
          )}
          {hasAnyModuleAccess && page === 'reports' && <ReportsPage branches={branches} />}
          {hasAnyModuleAccess && page === 'staff' && <StaffPage currentUser={currentUser} onWarningCountChange={setStaffWarningCount} />}
          {hasAnyModuleAccess && page === 'settings' && <SettingsPage currentUser={currentUser} onUserUpdated={onUserUpdated} onBrandUpdated={onBrandUpdated} onAppearance={onAppearance} />}
        </section>
      </main>

      {studentModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeStudentModal() }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">HỒ SƠ HỌC VIÊN</span>
                <h2 id="student-modal-title">
                  {studentModalMode === 'create' ? 'Thêm học viên mới' : studentModalMode === 'edit' ? 'Cập nhật học viên' : 'Chi tiết học viên'}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeStudentModal} aria-label="Đóng">×</button>
            </div>

            {studentModalMode === 'view' && selectedStudent ? (
              <>
                <div className="student-profile-head">
                  <div className="student-avatar-block">
                    <div className="student-profile-avatar student-profile-avatar-photo">
                      <span>{selectedStudent.fullName.trim().charAt(0).toUpperCase()}</span>
                      <img
                        key={`${selectedStudent.id}-${avatarRefresh}`}
                        src={`${apiBase}/student-avatars/${selectedStudent.id}?v=${avatarRefresh}`}
                        alt={selectedStudent.fullName}
                        onError={(event) => { event.currentTarget.style.display = 'none' }}
                      />
                    </div>
                    <label className="tiny-btn avatar-upload-btn">
                      {avatarUploading ? 'Đang tải...' : 'Đổi ảnh'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={avatarUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void uploadStudentAvatar(selectedStudent, file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <span className="mono">{selectedStudent.code}</span>
                    <h3>{selectedStudent.fullName}</h3>
                    <Status value={studentStatusText(selectedStudent.status)} tone={studentStatusTone(selectedStudent.status)} />
                  </div>
                </div>

                <div className="student-detail-grid">
                  <Detail label="Chi nhánh" value={selectedStudent.branch?.name ?? 'Chưa có chi nhánh'} />
                  <Detail label="Cấp đai" value={selectedStudent.beltLevel ?? 'Chưa có đai'} />
                  <Detail label="Ngày sinh" value={formatDate(selectedStudent.dateOfBirth)} />
                  <Detail label="Giới tính" value={selectedStudent.gender ?? '—'} />
                  <Detail label="Số điện thoại" value={selectedStudent.phone ?? '—'} />
                  <Detail label="Email" value={selectedStudent.email ?? '—'} />
                  <Detail label="Ngày nhập học" value={formatDate(selectedStudent.joinedAt)} />
                  <Detail
  label="Số buổi đã học"
  value={`${selectedStudent.attendanceStats?.attended ?? 0} / ${
    selectedStudent.attendanceStats?.total == null
      ? '—'
      : selectedStudent.attendanceStats.total
  }`}
/>
                  <Detail label="Địa chỉ" value={selectedStudent.address ?? '—'} wide />
                  <Detail label="Ghi chú" value={selectedStudent.note ?? 'Không có ghi chú'} wide />
                </div>

                {studentFormError && <div className="form-error">{studentFormError}</div>}

                <div className="modal-actions modal-actions-split">
                  <button className="danger-btn" type="button" onClick={deleteSelectedStudent} disabled={studentSaving}>
                    {studentSaving ? 'Đang xử lý...' : 'Xóa học viên'}
                  </button>
                  <div className="button-row">
                    <button className="secondary-btn" type="button" onClick={closeStudentModal} disabled={studentSaving}>Đóng</button>
                    <button className="primary-btn" type="button" onClick={startStudentEdit} disabled={studentSaving}>Sửa thông tin</button>
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={submitStudent}>
                <div className="form-grid">
                  <label className="form-field form-field-wide">
                    <span>Họ và tên *</span>
                    <input autoFocus value={studentForm.fullName} onChange={(event) => setStudentForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nguyễn Văn An" required />
                  </label>

                  <label className="form-field">
                    <span>Chi nhánh *</span>
                    <select value={studentForm.branchId} onChange={(event) => setStudentForm((current) => ({ ...current, branchId: event.target.value }))} required>
                      <option value="">Chọn chi nhánh</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Ngày sinh</span>
                    <input type="date" value={studentForm.dateOfBirth} onChange={(event) => setStudentForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
                  </label>

                  <label className="form-field">
                    <span>Giới tính</span>
                    <select value={studentForm.gender} onChange={(event) => setStudentForm((current) => ({ ...current, gender: event.target.value }))}>
                      <option value="">Chưa chọn</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Số điện thoại</span>
                    <input value={studentForm.phone} onChange={(event) => setStudentForm((current) => ({ ...current, phone: event.target.value }))} placeholder="0912345678" />
                  </label>

                  <label className="form-field">
                    <span>Email</span>
                    <input type="email" value={studentForm.email} onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))} placeholder="hocvien@example.com" />
                  </label>

                  <label className="form-field">
                    <span>Cấp đai</span>
                    <select value={studentForm.beltLevel} onChange={(event) => setStudentForm((current) => ({ ...current, beltLevel: event.target.value }))}>
                    <option value="">Chưa chọn</option>

                    {BELT_LEVELS.map((belt) => (
                      <option key={belt} value={belt}>
                        {belt}
                      </option>
                    ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Trạng thái</span>

                    <select value={studentForm.status} onChange={(event) => setStudentForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="ACTIVE">Đang học</option>
                      <option value="PAUSED">Bảo lưu</option>
                      <option value="INACTIVE">Nghỉ hẳn</option>
                    </select>
                  </label>

                  <label className="form-field form-field-wide">
                    <span>Địa chỉ</span>
                    <input value={studentForm.address} onChange={(event) => setStudentForm((current) => ({ ...current, address: event.target.value }))} placeholder="Địa chỉ học viên" />
                  </label>

                  <label className="form-field form-field-wide">
                    <span>Ghi chú</span>
                    <textarea value={studentForm.note} onChange={(event) => setStudentForm((current) => ({ ...current, note: event.target.value }))} placeholder="Thông tin cần lưu ý về học viên..." rows={3} />
                  </label>
                </div>

                {studentFormError && <div className="form-error">{studentFormError}</div>}
                {branches.length === 0 && <div className="form-warning">Chưa tải được chi nhánh. Hãy kiểm tra API /api/branches trước khi lưu.</div>}

                <div className="modal-actions">
                  <button className="secondary-btn" type="button" onClick={studentModalMode === 'edit' ? () => setStudentModalMode('view') : closeStudentModal} disabled={studentSaving}>
                    {studentModalMode === 'edit' ? 'Quay lại' : 'Hủy'}
                  </button>
                  <button className="primary-btn" type="submit" disabled={studentSaving || branches.length === 0}>
                    {studentSaving ? 'Đang lưu...' : studentModalMode === 'edit' ? 'Lưu thay đổi' : 'Thêm học viên'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

function studentStatusText(status: string) {
  return {
    ACTIVE: 'Đang học',
    PAUSED: 'Bảo lưu',
    INACTIVE: 'Nghỉ hẳn',
  }[status] ?? status
}

function studentStatusTone(status: string) {
  if (status === 'ACTIVE') return 'good'
  if (status === 'PAUSED') return 'warning'
  return 'muted'
}

function Dashboard({
  onNavigate,
  onQuickAttendance,
}: {
  onNavigate: (page: Page) => void
  onQuickAttendance: (classId?: string, sessionId?: string) => void
}) {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [branchId, setBranchId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async (nextBranchId = branchId) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextBranchId) params.set('branchId', nextBranchId)
      const response = await authFetch(`${apiBase}/dashboard/overview?${params.toString()}`)
      if (!response.ok) throw new Error(`Không tải được tổng quan (${response.status})`)
      setData(await response.json())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được tổng quan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard(branchId)
  }, [branchId])

  const quick = data?.quickAttendanceTarget

  return (
    <>
      <div className="hero-panel dashboard-hero-live">
        <div>
          <span className="eyebrow">KARATE DOJO · OPERATIONS</span>
          <h2>Tổng quan vận hành</h2>
          <p>
            {data?.todaySessions.length ?? 0} buổi học hôm nay · theo dõi học viên, chuyên cần, học phí và tài chính từ dữ liệu thật.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">Tất cả chi nhánh</option>
            {data?.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
            ))}
          </select>
          <button
            className="primary-btn"
            disabled={!quick}
            onClick={() => quick && onQuickAttendance(quick.classId, quick.sessionId)}
          >
            {quick ? `+ Điểm danh nhanh · ${quick.className}` : 'Hôm nay chưa có buổi học'}
          </button>
        </div>
      </div>

      {loading && <div className="info-strip">Đang tải dashboard...</div>}
      {error && <div className="form-error">{error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <Stat label="Học viên đang học" value={String(data.metrics.activeStudents)} note="Dữ liệu học viên ACTIVE" icon="人" onClick={() => onNavigate('students')} />
            <Stat label="Tỷ lệ đi học" value={`${data.metrics.attendanceRate}%`} note="Có mặt + trễ + học bù trong tháng" icon="✓" onClick={() => onNavigate('attendance')} />
            <Stat label="Doanh thu tháng" value={money.format(data.metrics.monthlyRevenue)} note={`Chi ${money.format(data.metrics.monthlyExpenses)}`} icon="₫" onClick={() => onNavigate('finance')} />
            <Stat label="Công nợ học phí" value={money.format(data.metrics.tuitionDebt)} note="Hóa đơn chưa thanh toán đủ" icon="!" warning={data.metrics.tuitionDebt > 0} onClick={() => onNavigate('tuition')} />
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-title">
                <div><span className="eyebrow">DOANH THU</span><h3>6 tháng gần nhất</h3></div>
                <button className="text-btn" onClick={() => onNavigate('finance')}>Xem thu chi</button>
              </div>
              <MiniBars data={data.revenueHistory} />
            </div>

            <div className="panel">
              <div className="panel-title">
                <div><span className="eyebrow">CẢNH BÁO</span><h3>Cần xử lý</h3></div>
                <button className="text-btn" onClick={() => onNavigate('tuition')}>Học phí</button>
              </div>
              <div className="alert-list">
                {data.alerts.map((alert, index) => (
                  <Alert key={`${alert.title}-${index}`} tone={alert.tone} title={alert.title} text={alert.text} onClick={() => onNavigate(alert.targetPage)} />
                ))}
                {data.alerts.length === 0 && <div className="info-strip">Hiện không có cảnh báo nổi bật.</div>}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">LỊCH HÔM NAY</span><h3>Các buổi học đang vận hành</h3></div>
              <button className="secondary-btn" onClick={() => onNavigate('attendance')}>Mở điểm danh</button>
            </div>
            <div className="timeline">
              {data.todaySessions.map((session) => (
                <Schedule
                  key={session.id}
                  time={new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.startsAt))}
                  name={session.className}
                  teacher={session.teacherName}
                  meta={`${session.branchName} · ${session.attendanceCount} lượt đã điểm danh`}
                  status={new Date(session.startsAt).getTime() <= Date.now() ? 'Đang/đã diễn ra' : 'Sắp diễn ra'}
                  onClick={() => onQuickAttendance(session.classId, session.id)}
                />
              ))}
              {data.todaySessions.length === 0 && <div className="info-strip">Hôm nay chưa có buổi học nào được tạo.</div>}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function StudentsPage({
  students,
  total,
  loading,
  error,
  onAdd,
  onView,
  onAttendance,
}: {
  students: Student[]
  total: number
  loading: boolean
  error: string
  onAdd: () => void
  onView: (student: Student) => void
  onAttendance: (student: Student) => void
}) {
  return (
    <div className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">HỒ SƠ HỌC VIÊN</span>
          <h3>{total} học viên trong hệ thống</h3>
        </div>
        <button className="primary-btn" onClick={onAdd}>+ Thêm học viên</button>
      </div>

      {loading && <div className="info-strip">Đang tải danh sách học viên...</div>}
      {error && <div className="info-strip">Lỗi: {error}</div>}

      {!loading && !error && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Học viên</th>
                <th>Chi nhánh</th>
                <th>Cấp đai</th>
                <th>Trạng thái</th>
                <th>Số buổi đã học</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="subtle">Không có học viên phù hợp.</td>
                </tr>
              ) : students.map((student) => (
                <tr key={student.id}>
                  <td className="mono">{student.code}</td>
                  <td>
                    <strong>{student.fullName}</strong>
                    <br />
                    <span className="subtle">{student.phone ?? 'Chưa có SĐT'}</span>
                  </td>
                  <td>{student.branch?.name ?? 'Chưa có chi nhánh'}</td>
                  <td>{student.beltLevel ?? 'Chưa có đai'}</td>
                  <td>
                    <Status
                      value={studentStatusText(student.status)}
                      tone={studentStatusTone(student.status)}
                    />
                  </td>
                  <td>
                  <button
  type="button"
  className="attendance-progress-btn"
  onClick={() => onAttendance(student)}
  title={
    student.attendanceStats?.packageName
      ? `Gói hiện tại: ${student.attendanceStats.packageName} · Bấm để xem lịch sử điểm danh`
      : 'Chưa có gói học · Bấm để xem lịch sử điểm danh'
  }
>
  <strong>{student.attendanceStats?.attended ?? 0}</strong>
  <span>
    {' / '}
    {student.attendanceStats?.total == null
      ? '—'
      : student.attendanceStats.total}
  </span>
</button>
                  </td>
                  <td><button className="tiny-btn" onClick={() => onView(student)}>Chi tiết</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClassesPage({ students, branches }: { students: Student[]; branches: Branch[] }) {
  const [classes, setClasses] = useState<KarateClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [classModalMode, setClassModalMode] = useState<'create' | 'edit'>('create')
  const [editingClass, setEditingClass] = useState<KarateClass | null>(null)
  const [classForm, setClassForm] = useState<ClassForm>(emptyClassForm)
  const [classSaving, setClassSaving] = useState(false)
  const [classFormError, setClassFormError] = useState('')
  const [selectedClass, setSelectedClass] = useState<KarateClass | null>(null)
  const [classEnrollments, setClassEnrollments] = useState<Enrollment[]>([])
  const [classDetailsOpen, setClassDetailsOpen] = useState(false)
  const [classDetailsLoading, setClassDetailsLoading] = useState(false)
  const [enrollModalOpen, setEnrollModalOpen] = useState(false)
  const [enrollClassId, setEnrollClassId] = useState('')
  const [enrollStudentId, setEnrollStudentId] = useState('')
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [enrollError, setEnrollError] = useState('')
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copySourceClassId, setCopySourceClassId] = useState('')
  const [copyTargetClassId, setCopyTargetClassId] = useState('')
  const [copySaving, setCopySaving] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [contentModalOpen, setContentModalOpen] = useState(false)
  const [contentClassId, setContentClassId] = useState('')
  const [classContents, setClassContents] = useState<ClassContent[]>([])
  const [contentTitle, setContentTitle] = useState('')
  const [contentBody, setContentBody] = useState('')
  const [editingContentId, setEditingContentId] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentError, setContentError] = useState('')

  const loadClasses = async () => {
    setLoading(true)
    setError('')
    try {
      setClasses(await fetchClasses())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được lớp học')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClasses()
  }, [])

  const openCreateClass = () => {
    setClassModalMode('create')
    setEditingClass(null)
    setClassForm({ ...emptyClassForm, branchId: branches.length === 1 ? branches[0].id : '' })
    setClassFormError('')
    setClassModalOpen(true)
  }

  const openEditClass = (karateClass: KarateClass) => {
    setClassDetailsOpen(false)
    setClassModalMode('edit')
    setEditingClass(karateClass)
    setClassForm(classToForm(karateClass))
    setClassFormError('')
    setClassModalOpen(true)
  }

  const submitClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classForm.code.trim() || !classForm.name.trim() || !classForm.branchId) {
      setClassFormError('Vui lòng nhập mã lớp, tên lớp và chọn chi nhánh.')
      return
    }
    setClassSaving(true)
    setClassFormError('')
    try {
      if (classModalMode === 'edit' && editingClass) {
        await updateClassApi(editingClass.id, classForm)
      } else {
        await createClassApi(classForm)
      }
      setClassModalOpen(false)
      setEditingClass(null)
      setClassModalMode('create')
      setClassForm(emptyClassForm)
      await loadClasses()
      if (selectedClass && editingClass?.id === selectedClass.id) {
        setClassDetailsOpen(false)
        setSelectedClass(null)
      }
    } catch (err) {
      setClassFormError(err instanceof Error ? err.message : 'Không thể tạo lớp')
    } finally {
      setClassSaving(false)
    }
  }

  const openClassDetails = async (karateClass: KarateClass) => {
    setSelectedClass(karateClass)
    setClassDetailsOpen(true)
    setClassDetailsLoading(true)
    setEnrollError('')
    try {
      setClassEnrollments(await fetchClassEnrollments(karateClass.id))
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Không tải được học viên trong lớp')
      setClassEnrollments([])
    } finally {
      setClassDetailsLoading(false)
    }
  }

  const openEnroll = (classId = '') => {
    const targetClassId =
      classId || selectedClass?.id || ''
  
    // Đóng modal chi tiết lớp trước
    setClassDetailsOpen(false)
  
    // Sau đó mở modal xếp học viên
    setEnrollClassId(targetClassId)
    setEnrollStudentId('')
    setEnrollError('')
    setEnrollModalOpen(true)
  }

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!enrollClassId || !enrollStudentId) {
      setEnrollError('Vui lòng chọn lớp và học viên.')
      return
    }
    setEnrollSaving(true)
    setEnrollError('')
    try {
      await createEnrollmentApi(enrollClassId, enrollStudentId)
      setEnrollModalOpen(false)
      setEnrollStudentId('')
      await loadClasses()
      if (selectedClass?.id === enrollClassId) {
        setClassEnrollments(await fetchClassEnrollments(enrollClassId))
      }
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Không thể xếp học viên vào lớp')
    } finally {
      setEnrollSaving(false)
    }
  }

  const removeEnrollment = async (enrollment: Enrollment) => {
    const confirmed = window.confirm(`Đưa ${enrollment.student.fullName} ra khỏi lớp? Lịch sử enrollment vẫn được giữ lại.`)
    if (!confirmed) return
    setEnrollError('')
    try {
      await removeEnrollmentApi(enrollment.id)
      if (selectedClass) setClassEnrollments(await fetchClassEnrollments(selectedClass.id))
      await loadClasses()
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Không thể đưa học viên ra khỏi lớp')
    }
  }


  const openCopyStudents = (targetClassId: string) => {
    setClassDetailsOpen(false)
    setCopyTargetClassId(targetClassId)
    setCopySourceClassId('')
    setCopyError('')
    setCopyModalOpen(true)
  }

  const copyStudents = async () => {
    if (!copySourceClassId || !copyTargetClassId) {
      setCopyError('Vui lòng chọn lớp nguồn.')
      return
    }

    setCopySaving(true)
    setCopyError('')
    try {
      const result = await copyClassEnrollmentsApi(copySourceClassId, copyTargetClassId)
      setCopyModalOpen(false)
      setCopySourceClassId('')
      setCopyTargetClassId('')
      await loadClasses()
      window.alert(`Đã sao chép ${result.copied} học viên.\nBỏ qua ${result.skipped} học viên đã có.`)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'Không thể sao chép học viên')
    } finally {
      setCopySaving(false)
    }
  }


  const loadClassContents = async (classId: string) => {
    if (!classId) {
      setClassContents([])
      return
    }
    setContentLoading(true)
    setContentError('')
    try {
      const response = await authFetch(`${apiBase}/class-contents/class/${classId}`)
      if (!response.ok) throw new Error(`Không tải được nội dung lớp (${response.status})`)
      setClassContents(await response.json())
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : 'Không tải được nội dung lớp')
    } finally {
      setContentLoading(false)
    }
  }

  const openClassContents = (classId = '') => {
    const targetId = classId || selectedClass?.id || activeClasses[0]?.id || ''
    setClassDetailsOpen(false)
    setContentClassId(targetId)
    setContentTitle('')
    setContentBody('')
    setEditingContentId(null)
    setContentError('')
    setContentModalOpen(true)
    if (targetId) void loadClassContents(targetId)
  }

  const saveClassContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contentClassId || !contentTitle.trim() || !contentBody.trim()) {
      setContentError('Vui lòng chọn lớp, nhập tiêu đề và nội dung.')
      return
    }
    setContentSaving(true)
    setContentError('')
    try {
      const path = editingContentId
        ? `/class-contents/${editingContentId}`
        : `/class-contents/class/${contentClassId}`
      const response = await authFetch(`${apiBase}${path}`, {
        method: editingContentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ title: contentTitle.trim(), content: contentBody.trim() }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không lưu được nội dung (${response.status})`)
      }
      setContentTitle('')
      setContentBody('')
      setEditingContentId(null)
      await loadClassContents(contentClassId)
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : 'Không lưu được nội dung lớp')
    } finally {
      setContentSaving(false)
    }
  }

  const editClassContent = (item: ClassContent) => {
    setEditingContentId(item.id)
    setContentTitle(item.title)
    setContentBody(item.content)
  }

  const removeClassContent = async (item: ClassContent) => {
    if (!window.confirm(`Xóa nội dung “${item.title}”?`)) return
    setContentError('')
    try {
      const response = await authFetch(`${apiBase}/class-contents/${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Không xóa được nội dung (${response.status})`)
      await loadClassContents(contentClassId)
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : 'Không xóa được nội dung lớp')
    }
  }

  const deleteClass = async (karateClass: KarateClass) => {
    const confirmed = window.confirm(
      `Xóa lớp ${karateClass.code} · ${karateClass.name}? Lớp sẽ được ngừng hoạt động để giữ lịch sử học viên và điểm danh.`,
    )
    if (!confirmed) return

    setError('')
    try {
      await removeClassApi(karateClass.id)
      setClassDetailsOpen(false)
      setSelectedClass(null)
      await loadClasses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa lớp')
    }
  }

  const activeClasses = classes.filter((item) => item.active)
  const selectedClassForEnroll = classes.find((item) => item.id === enrollClassId)
  const copyTargetClass = classes.find((item) => item.id === copyTargetClassId)
  const copySourceClasses = copyTargetClass
    ? classes.filter(
        (item) => item.id !== copyTargetClass.id && item.branchId === copyTargetClass.branchId,
      )
    : []
  const availableStudents = students.filter((student) =>
    student.status === 'ACTIVE' &&
    (!selectedClassForEnroll || student.branchId === selectedClassForEnroll.branchId)
  )

  return (
    <>
      <div className="action-grid">
        <button className="quick-action" onClick={openCreateClass}>
          <span>+</span><div><strong>Tạo lớp mới</strong><p>Lịch học, sĩ số, học phí</p></div>
        </button>
        <button className="quick-action" onClick={() => openEnroll()}>
          <span>↔</span><div><strong>Xếp học viên</strong><p>Đăng ký học viên vào lớp</p></div>
        </button>
        <button className="quick-action" onClick={() => openClassContents()}>
          <span>✎</span><div><strong>Nội dung lớp học</strong><p>Giáo án, bài tập, ghi chú theo lớp</p></div>
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">
          <div><span className="eyebrow">LỚP HỌC</span><h3>{activeClasses.length} lớp đang hoạt động</h3></div>
          <button className="secondary-btn" onClick={() => void loadClasses()}>Làm mới</button>
        </div>

        {loading && <div className="info-strip">Đang tải danh sách lớp...</div>}
        {error && <div className="form-error">{error}</div>}

        {!loading && !error && activeClasses.length === 0 && (
          <div className="info-strip">Chưa có lớp học. Hãy bấm “Tạo lớp mới”.</div>
        )}

        {!loading && !error && activeClasses.length > 0 && (
          <div className="cards">
            {activeClasses.map((karateClass) => {
              const count = karateClass._count?.enrollments ?? 0
              const capacity = karateClass.capacity ?? '∞'
              const tuition = karateClass.tuitionPerSession == null ? 'Chưa đặt' : money.format(Number(karateClass.tuitionPerSession)) + ' / buổi'
              const teacherName = karateClass.teacher?.user?.fullName ?? karateClass.teacher?.user?.name ?? 'Chưa phân giáo viên'
              return (
                <article className="class-card" key={karateClass.id}>
                  <div className="class-card-top">
                    <div className="class-code">{karateClass.code}</div>
                    <Status value="Đang hoạt động" tone="good" />
                  </div>
                  <h3>{karateClass.name}</h3>
                  <p>{teacherName}</p>
                  <div className="class-info-list">
                    <span>◷ {karateClass.scheduleText ?? 'Chưa có lịch học'}</span>
                    <span>人 {count} / {capacity} học viên</span>
                    <span>₫ {tuition}</span>
                    <span>⌂ {karateClass.branch?.name ?? 'Chưa có chi nhánh'}</span>
                  </div>
                  <div className="class-card-actions">
                    <button className="secondary-btn" onClick={() => openEnroll(karateClass.id)}>+ Xếp học viên</button>
                    <button className="secondary-btn" onClick={() => openCopyStudents(karateClass.id)}>⧉ Sao chép học viên</button>
                    <button className="secondary-btn" onClick={() => openClassContents(karateClass.id)}>Nội dung</button>
                    <button className="secondary-btn" onClick={() => openEditClass(karateClass)}>Sửa</button>
                    <button className="primary-btn" onClick={() => void openClassDetails(karateClass)}>Mở lớp</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {contentModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !contentSaving) setContentModalOpen(false) }}>
          <div className="modal-card class-content-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div><span className="eyebrow">NỘI DUNG LỚP HỌC</span><h2>Giáo án & ghi chú lớp</h2></div>
              <button className="modal-close" type="button" onClick={() => setContentModalOpen(false)} disabled={contentSaving}>×</button>
            </div>

            <label className="form-field">
              <span>Lớp học</span>
              <select value={contentClassId} onChange={(event) => { setContentClassId(event.target.value); setEditingContentId(null); setContentTitle(''); setContentBody(''); void loadClassContents(event.target.value) }}>
                <option value="">Chọn lớp</option>
                {activeClasses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </label>

            <form onSubmit={saveClassContent} className="class-content-form">
              <label className="form-field"><span>Tiêu đề *</span><input value={contentTitle} onChange={(event) => setContentTitle(event.target.value)} placeholder="Ví dụ: Kihon - kỹ thuật căn bản" /></label>
              <label className="form-field"><span>Nội dung *</span><textarea rows={5} value={contentBody} onChange={(event) => setContentBody(event.target.value)} placeholder="Bài tập, kỹ thuật, yêu cầu buổi học..." /></label>
              {contentError && <div className="form-error">{contentError}</div>}
              <div className="button-row">
                {editingContentId && <button type="button" className="secondary-btn" onClick={() => { setEditingContentId(null); setContentTitle(''); setContentBody('') }}>Hủy sửa</button>}
                <button type="submit" className="primary-btn" disabled={contentSaving || !contentClassId}>{contentSaving ? 'Đang lưu...' : editingContentId ? 'Lưu thay đổi' : '+ Thêm nội dung'}</button>
              </div>
            </form>

            <div className="class-content-list">
              {contentLoading && <div className="info-strip">Đang tải nội dung lớp...</div>}
              {!contentLoading && classContents.map((item) => (
                <article className="class-content-item" key={item.id}>
                  <div className="class-content-head"><div><span>{formatDateTime(item.createdAt)}</span><h3>{item.title}</h3></div><div className="button-row"><button className="tiny-btn" onClick={() => editClassContent(item)}>Sửa</button><button className="tiny-btn danger-text" onClick={() => void removeClassContent(item)}>Xóa</button></div></div>
                  <p>{item.content}</p>
                </article>
              ))}
              {!contentLoading && contentClassId && classContents.length === 0 && <div className="info-strip">Lớp này chưa có nội dung. Hãy tạo nội dung đầu tiên.</div>}
            </div>
          </div>
        </div>
      )}

      {classModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !classSaving) setClassModalOpen(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div><span className="eyebrow">LỚP HỌC</span><h2>{classModalMode === 'edit' ? 'Chỉnh sửa lớp học' : 'Tạo lớp mới'}</h2></div>
              <button className="modal-close" type="button" onClick={() => setClassModalOpen(false)} disabled={classSaving}>×</button>
            </div>
            <form onSubmit={submitClass}>
              <div className="form-grid">
                <label className="form-field"><span>Mã lớp *</span><input value={classForm.code} onChange={(e) => setClassForm((v) => ({ ...v, code: e.target.value }))} placeholder="CB-B" required /></label>
                <label className="form-field"><span>Tên lớp *</span><input value={classForm.name} onChange={(e) => setClassForm((v) => ({ ...v, name: e.target.value }))} placeholder="Karate Căn bản B" required /></label>
                <label className="form-field form-field-wide"><span>Chi nhánh *</span><select value={classForm.branchId} onChange={(e) => setClassForm((v) => ({ ...v, branchId: e.target.value }))} required><option value="">Chọn chi nhánh</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></label>
                <label className="form-field"><span>Sĩ số tối đa</span><input type="number" min="1" value={classForm.capacity} onChange={(e) => setClassForm((v) => ({ ...v, capacity: e.target.value }))} placeholder="22" /></label>
                <label className="form-field"><span>Học phí / buổi</span><input type="number" min="0" value={classForm.tuitionPerSession} onChange={(e) => setClassForm((v) => ({ ...v, tuitionPerSession: e.target.value }))} placeholder="65000" /></label>
                <label className="form-field form-field-wide"><span>Lịch học</span><input value={classForm.scheduleText} onChange={(e) => setClassForm((v) => ({ ...v, scheduleText: e.target.value }))} placeholder="T3 - T5 - T7 / 18:30" /></label>
                <label className="form-field form-field-wide"><span>Mô tả</span><textarea rows={3} value={classForm.description} onChange={(e) => setClassForm((v) => ({ ...v, description: e.target.value }))} placeholder="Thông tin về lớp..." /></label>
              </div>
              {classFormError && <div className="form-error">{classFormError}</div>}
              <div className="modal-actions">
                <button className="secondary-btn" type="button" onClick={() => setClassModalOpen(false)} disabled={classSaving}>Hủy</button>
                <button className="primary-btn" type="submit" disabled={classSaving}>
                  {classSaving ? 'Đang lưu...' : classModalMode === 'edit' ? 'Lưu thay đổi' : 'Tạo lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {enrollModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !enrollSaving) setEnrollModalOpen(false) }}>
          <div className="modal-card enroll-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div><span className="eyebrow">ENROLLMENT</span><h2>Xếp học viên vào lớp</h2></div>
              <button className="modal-close" type="button" onClick={() => setEnrollModalOpen(false)} disabled={enrollSaving}>×</button>
            </div>
            <form onSubmit={submitEnrollment}>
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Lớp học *</span>
                  <select value={enrollClassId} onChange={(e) => { setEnrollClassId(e.target.value); setEnrollStudentId('') }} required>
                    <option value="">Chọn lớp</option>
                    {activeClasses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} ({c._count?.enrollments ?? 0}/{c.capacity ?? '∞'})</option>)}
                  </select>
                </label>
                <label className="form-field form-field-wide">
                  <span>Học viên *</span>
                  <select value={enrollStudentId} onChange={(e) => setEnrollStudentId(e.target.value)} required disabled={!enrollClassId}>
                    <option value="">Chọn học viên</option>
                    {availableStudents.map((student) => <option key={student.id} value={student.id}>{student.code} · {student.fullName} · {student.beltLevel ?? 'Chưa có đai'}</option>)}
                  </select>
                </label>
              </div>
              {enrollClassId && availableStudents.length === 0 && <div className="form-warning">Không có học viên ACTIVE phù hợp với chi nhánh của lớp.</div>}
              {enrollError && <div className="form-error">{enrollError}</div>}
              <div className="modal-actions">
                <button className="secondary-btn" type="button" onClick={() => setEnrollModalOpen(false)} disabled={enrollSaving}>Hủy</button>
                <button className="primary-btn" type="submit" disabled={enrollSaving || !enrollClassId || !enrollStudentId}>{enrollSaving ? 'Đang xếp...' : 'Xếp vào lớp'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {copyModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !copySaving) setCopyModalOpen(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <span className="eyebrow">SAO CHÉP HỌC VIÊN</span>
                <h2>Sao chép danh sách từ lớp khác</h2>
                <p className="subtle">Chỉ tạo Enrollment mới, không nhân bản hồ sơ học viên.</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setCopyModalOpen(false)} disabled={copySaving}>×</button>
            </div>

            <div className="form-grid">
              <label className="form-field form-field-wide">
                <span>Lớp đích</span>
                <input value={copyTargetClass ? `${copyTargetClass.code} · ${copyTargetClass.name}` : ''} disabled />
              </label>

              <label className="form-field form-field-wide">
                <span>Sao chép học viên từ lớp *</span>
                <select value={copySourceClassId} onChange={(event) => setCopySourceClassId(event.target.value)}>
                  <option value="">Chọn lớp nguồn cùng chi nhánh</option>
                  {copySourceClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name} · {item._count?.enrollments ?? 0} học viên{item.active ? '' : ' · lớp đã ngừng'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {copyTargetClass && copySourceClasses.length === 0 && (
              <div className="form-warning">Không có lớp khác cùng chi nhánh để sao chép.</div>
            )}
            {copyError && <div className="form-error">{copyError}</div>}

            <div className="modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setCopyModalOpen(false)} disabled={copySaving}>Hủy</button>
              <button className="primary-btn" type="button" onClick={() => void copyStudents()} disabled={copySaving || !copySourceClassId}>
                {copySaving ? 'Đang sao chép...' : 'Sao chép toàn bộ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {classDetailsOpen && selectedClass && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setClassDetailsOpen(false) }}>
          <div className="modal-card class-modal-wide" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div><span className="eyebrow">{selectedClass.code}</span><h2>{selectedClass.name}</h2></div>
              <button className="modal-close" type="button" onClick={() => setClassDetailsOpen(false)}>×</button>
            </div>

            <div className="class-detail-grid">
              <Detail label="Chi nhánh" value={selectedClass.branch?.name ?? '—'} />
              <Detail label="Lịch học" value={selectedClass.scheduleText ?? 'Chưa có lịch'} />
              <Detail label="Sĩ số" value={`${classEnrollments.length} / ${selectedClass.capacity ?? '∞'}`} />
              <Detail label="Học phí / buổi" value={selectedClass.tuitionPerSession == null ? 'Chưa đặt' : money.format(Number(selectedClass.tuitionPerSession))} />
              <Detail label="Mô tả" value={selectedClass.description ?? 'Không có mô tả'} wide />
            </div>

            <div className="roster-head">
              <div><span className="eyebrow">DANH SÁCH HỌC VIÊN</span><h3>{classEnrollments.length} học viên đang học</h3></div>
              <div className="button-row">
                <button className="secondary-btn" onClick={() => openCopyStudents(selectedClass.id)}>⧉ Sao chép từ lớp khác</button>
                <button className="primary-btn" onClick={() => openEnroll(selectedClass.id)}>+ Xếp học viên</button>
              </div>
            </div>

            {classDetailsLoading ? <div className="info-strip">Đang tải học viên...</div> : (
              <div className="table-wrap">
                <table className="roster-table">
                  <thead><tr><th>Mã</th><th>Học viên</th><th>Cấp đai</th><th>Ngày vào lớp</th><th></th></tr></thead>
                  <tbody>
                    {classEnrollments.length === 0 ? <tr><td colSpan={5} className="subtle">Lớp chưa có học viên.</td></tr> : classEnrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td className="mono">{enrollment.student.code}</td>
                        <td><strong>{enrollment.student.fullName}</strong><br/><span className="subtle">{enrollment.student.phone ?? 'Chưa có SĐT'}</span></td>
                        <td>{enrollment.student.beltLevel ?? 'Chưa có đai'}</td>
                        <td>{formatDate(enrollment.startedAt)}</td>
                        <td><button className="danger-link" onClick={() => void removeEnrollment(enrollment)}>Đưa ra lớp</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {enrollError && <div className="form-error">{enrollError}</div>}
            <div className="modal-actions modal-actions-split">
              <button className="danger-btn" type="button" onClick={() => void deleteClass(selectedClass)}>Xóa lớp</button>
              <div className="button-row">
                <button className="secondary-btn" type="button" onClick={() => setClassDetailsOpen(false)}>Đóng</button>
                <button className="primary-btn" type="button" onClick={() => openEditClass(selectedClass)}>Sửa chi tiết lớp</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BranchesPage({ onBranchesChanged }: { onBranchesChanged: () => Promise<void> }) {
  const [items, setItems] = useState<BranchAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BranchAdmin | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await authFetch(`${apiBase}/branch-admin`)
      if (!response.ok) throw new Error(`Không tải được chi nhánh (${response.status})`)
      setItems(await response.json())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được chi nhánh')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const openCreate = () => {
    setEditing(null)
    setCode('')
    setName('')
    setAddress('')
    setPhone('')
    setModalOpen(true)
  }

  const openEdit = (branch: BranchAdmin) => {
    setEditing(branch)
    setCode(branch.code)
    setName(branch.name)
    setAddress(branch.address ?? '')
    setPhone(branch.phone ?? '')
    setModalOpen(true)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await authFetch(`${apiBase}/branch-admin${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ code, name, address, phone }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không lưu được chi nhánh (${response.status})`)
      }
      setModalOpen(false)
      await Promise.all([load(), onBranchesChanged()])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được chi nhánh')
    } finally {
      setSaving(false)
    }
  }


  const deleteBranch = async (branch: BranchAdmin) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa chi nhánh "${branch.name}" không?\n\n` +
      'Chi nhánh chỉ có thể xóa khi chưa có học viên, lớp học, giao dịch thu/chi hoặc dữ liệu bán hàng.',
    )

    if (!confirmed) return

    setDeletingId(branch.id)
    setError('')

    try {
      const response = await authFetch(
        `${apiBase}/branch-admin/${branch.id}`,
        {
          method: 'DELETE',
        },
      )

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body.message.join(', ')
          : body?.message

        throw new Error(
          message || `Không xóa được chi nhánh (${response.status})`,
        )
      }

      if (editing?.id === branch.id) {
        setModalOpen(false)
        setEditing(null)
      }

      await Promise.all([
        load(),
        onBranchesChanged(),
      ])
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Không xóa được chi nhánh',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="panel package-toolbar">
        <div><span className="eyebrow">QUẢN LÝ CHI NHÁNH</span><h3>Học viên, lớp học và tài chính theo từng cơ sở</h3><p>Đây là nền tảng để về sau lọc toàn hệ thống theo chi nhánh.</p></div>
        <button className="primary-btn" onClick={openCreate}>+ Tạo chi nhánh</button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="info-strip">Đang tải chi nhánh...</div>}

      <div className="branch-admin-grid">
        {items.map((branch) => (
          <article className="branch-admin-card" key={branch.id}>
            <div className="branch-admin-head">
              <div>
                <span className="class-code">{branch.code}</span>
                <h3>{branch.name}</h3>
              </div>
              <div className="button-row">
                <button
                  className="tiny-btn"
                  onClick={() => openEdit(branch)}
                  disabled={deletingId === branch.id}
                >
                  Chỉnh sửa
                </button>
                <button
                  className="tiny-btn danger-text"
                  onClick={() => void deleteBranch(branch)}
                  disabled={deletingId === branch.id}
                >
                  {deletingId === branch.id ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
            <p>{branch.address || 'Chưa có địa chỉ'} · {branch.phone || 'Chưa có SĐT'}</p>
            <div className="branch-stat-grid">
              <Detail label="Đang học" value={String(branch.stats.activeStudents)} />
              <Detail label="Tổng học viên" value={String(branch.stats.allStudents)} />
              <Detail label="Lớp hoạt động" value={String(branch.stats.activeClasses)} />
              <Detail label="Thu tháng" value={money.format(branch.stats.monthlyIncome)} />
              <Detail label="Chi tháng" value={money.format(branch.stats.monthlyExpense)} />
              <Detail label="Chênh lệch" value={money.format(branch.stats.monthlyBalance)} />
            </div>
          </article>
        ))}
        {!loading && items.length === 0 && <div className="panel">Chưa có chi nhánh.</div>}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header"><div><span className="eyebrow">CHI NHÁNH</span><h2>{editing ? 'Cập nhật chi nhánh' : 'Tạo chi nhánh mới'}</h2></div><button className="modal-close" onClick={() => setModalOpen(false)} disabled={saving}>×</button></div>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label className="form-field"><span>Mã chi nhánh *</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="CN02" required /></label>
                <label className="form-field"><span>Tên chi nhánh *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Võ đường Karate Cầu Giấy" required /></label>
                <label className="form-field form-field-wide"><span>Địa chỉ</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
                <label className="form-field form-field-wide"><span>Điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button><button className="primary-btn" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo chi nhánh'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function AttendancePage({
  initialClassId,
  initialSessionId,
  initialStudentId,
  onAttendanceSaved,
}: {
  initialClassId?: string
  initialSessionId?: string
  initialStudentId?: string
  onAttendanceSaved?: () => void | Promise<void>
}) {
  const [classes, setClasses] = useState<KarateClass[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [attendanceData, setAttendanceData] = useState<SessionAttendanceResponse | null>(null)
  const [rows, setRows] = useState<SessionAttendanceRow[]>([])
  const [startsAt, setStartsAt] = useState(() => toDateTimeLocalValue(new Date()))
  const [topic, setTopic] = useState('')
  const [sessionNote, setSessionNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [rebuildingRisk, setRebuildingRisk] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [studentHistory, setStudentHistory] = useState<StudentAttendanceHistory | null>(null)
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false)
  const [studentHistoryError, setStudentHistoryError] = useState('')

  const loadClasses = async () => {
    const response = await authFetch(`${apiBase}/classes`)
    if (!response.ok) throw new Error(`Không tải được lớp học (${response.status})`)
    const data: KarateClass[] = await response.json()
    const activeClasses = data.filter((item) => item.active)
    setClasses(activeClasses)
    setSelectedClassId((current) => initialClassId || current || activeClasses[0]?.id || '')
  }

  const loadSessions = async (classId: string) => {
    if (!classId) {
      setSessions([])
      setSelectedSessionId('')
      setAttendanceData(null)
      setRows([])
      return
    }

    const response = await authFetch(`${apiBase}/class-sessions?classId=${encodeURIComponent(classId)}`)
    if (!response.ok) throw new Error(`Không tải được buổi học (${response.status})`)
    const data: ClassSession[] = await response.json()
    setSessions(data)

    setSelectedSessionId((current) => {
      if (current && data.some((item) => item.id === current)) return current
      return data.find((item) => !item.isCancelled)?.id ?? data[0]?.id ?? ''
    })
  }

  const loadAttendance = async (sessionId: string) => {
    if (!sessionId) {
      setAttendanceData(null)
      setRows([])
      return
    }

    const response = await authFetch(`${apiBase}/class-sessions/${sessionId}/attendance`)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || `Không tải được điểm danh (${response.status})`)
    }

    const data: SessionAttendanceResponse = await response.json()
    setAttendanceData(data)
    setRows(data.rows)
  }

  const loadStudentHistory = async (studentId: string) => {
    if (!studentId) {
      setStudentHistory(null)
      setStudentHistoryError('')
      return
    }

    setStudentHistoryLoading(true)
    setStudentHistoryError('')
    try {
      const response = await authFetch(`${apiBase}/students/${studentId}/attendance-history`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không tải được lịch sử học viên (${response.status})`)
      }
      setStudentHistory(await response.json())
    } catch (reason) {
      setStudentHistory(null)
      setStudentHistoryError(reason instanceof Error ? reason.message : 'Không tải được lịch sử điểm danh học viên')
    } finally {
      setStudentHistoryLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')

    loadClasses()
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu điểm danh')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (initialClassId) setSelectedClassId(initialClassId)
  }, [initialClassId])

  useEffect(() => {
    if (initialSessionId && sessions.some((item) => item.id === initialSessionId)) {
      setSelectedSessionId(initialSessionId)
    }
  }, [initialSessionId, sessions])

  useEffect(() => {
    if (initialStudentId) {
      void loadStudentHistory(initialStudentId)
    } else {
      setStudentHistory(null)
      setStudentHistoryError('')
    }
  }, [initialStudentId])

  useEffect(() => {
    if (!selectedClassId) return
    setLoading(true)
    setError('')
    setMessage('')

    loadSessions(selectedClassId)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được buổi học'))
      .finally(() => setLoading(false))
  }, [selectedClassId])

  useEffect(() => {
    if (!selectedSessionId) {
      setAttendanceData(null)
      setRows([])
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    loadAttendance(selectedSessionId)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được danh sách điểm danh'))
      .finally(() => setLoading(false))
  }, [selectedSessionId])

  const createSession = async () => {
    if (!selectedClassId) {
      setError('Vui lòng chọn lớp học.')
      return
    }
    if (!startsAt) {
      setError('Vui lòng chọn ngày giờ bắt đầu.')
      return
    }

    setCreating(true)
    setError('')
    setMessage('')
    try {
      const response = await authFetch(`${apiBase}/class-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          classId: selectedClassId,
          startsAt: new Date(startsAt).toISOString(),
          ...(topic.trim() && { topic: topic.trim() }),
          ...(sessionNote.trim() && { note: sessionNote.trim() }),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không thể tạo buổi học (${response.status})`)
      }

      const created: ClassSession = await response.json()
      await loadSessions(selectedClassId)
      setSelectedSessionId(created.id)
      setTopic('')
      setSessionNote('')
      setStartsAt(toDateTimeLocalValue(new Date()))
      setMessage('Đã tạo buổi học. Bạn có thể điểm danh ngay.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo buổi học')
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = (
    studentId: string,
    status: AttendanceStatus,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.studentId === studentId
          ? {
              ...row,
              status: row.status === status ? null : status,
            }
          : row,
      ),
    )
  
    setMessage('')
  }

  const saveAttendance = async () => {
    if (!selectedSessionId || rows.length === 0) return

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await authFetch(`${apiBase}/class-sessions/${selectedSessionId}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          rows: rows.map((row) => ({
            studentId: row.studentId,
            status: row.status,
            ...(row.note?.trim() && { note: row.note.trim() }),
          })),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const text = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
        throw new Error(text || `Không thể lưu điểm danh (${response.status})`)
      }

      const data: SessionAttendanceResponse = await response.json()
      setAttendanceData(data)
      setRows(data.rows)

      // Đồng bộ ngay cột "Số buổi đã học" và các nơi đang dùng danh sách học viên.
      await onAttendanceSaved?.()

      // Nếu đang xem lịch sử của một học viên cụ thể, tải lại ngay sau khi lưu.
      if (initialStudentId) {
        await loadStudentHistory(initialStudentId)
      }

      setMessage('Đã lưu điểm danh và đồng bộ số buổi đã học.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu điểm danh')
    } finally {
      setSaving(false)
    }
  }

  const rebuildAttendanceRisk = async () => {
    setRebuildingRisk(true)
    setError('')
    setMessage('')
    try {
      const response = await authFetch(`${apiBase}/class-sessions/attendance/rebuild-risk`, {
        method: 'POST',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const text = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
        throw new Error(text || `Không thể đồng bộ cảnh báo (${response.status})`)
      }
      const result: { updatedStudents: number; riskyStudents: number; warningThreshold: number } = await response.json()
      if (selectedSessionId) await loadAttendance(selectedSessionId)
      setMessage(`Đã đồng bộ ${result.updatedStudents} học viên · ${result.riskyStudents} học viên đang đạt ngưỡng cảnh báo từ ${result.warningThreshold} buổi nghỉ liên tiếp.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ cảnh báo nghỉ học')
    } finally {
      setRebuildingRisk(false)
    }
  }

  const cancelSession = async () => {
    if (!attendanceData) return
    if (!window.confirm('Hủy buổi học này? Dữ liệu điểm danh lịch sử vẫn được giữ.')) return

    setSaving(true)
    setError('')
    try {
      const response = await authFetch(`${apiBase}/class-sessions/${attendanceData.session.id}/cancel`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Không thể hủy buổi học (${response.status})`)
      }
      await loadSessions(selectedClassId)
      await loadAttendance(attendanceData.session.id)
      setMessage('Đã hủy buổi học.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể hủy buổi học')
    } finally {
      setSaving(false)
    }
  }

  const selectedClass = classes.find((item) => item.id === selectedClassId)
  const currentSession = attendanceData?.session
  // Đi muộn vẫn được tính là có mặt. LATE được giữ riêng để theo dõi kỷ luật giờ giấc.
  const presentCount = rows.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length
  const absentCount = rows.filter((row) => row.status === 'ABSENT').length
  const lateCount = rows.filter((row) => row.status === 'LATE').length
  const excusedCount = rows.filter((row) => row.status === 'EXCUSED').length
  const unmarkedCount = rows.filter((row) => row.status === null).length

  return (
    <>
      {(initialStudentId || studentHistoryLoading || studentHistoryError) && (
        <div className="panel student-attendance-history">
          <div className="panel-title">
            <div>
              <span className="eyebrow">THEO DÕI HỌC VIÊN</span>
              <h3>{studentHistory?.student.fullName ?? 'Lịch sử điểm danh'}</h3>
              {studentHistory && (
                <p>
                  {studentHistory.student.code}
                  {' · '}
                  {studentHistory.student.branch?.name ?? 'Chưa có chi nhánh'}
                  {' · '}
                  {studentHistory.student.beltLevel ?? 'Chưa có đai'}
                </p>
              )}
            </div>
            {studentHistory && (
              <div className="attendance-history-summary">
                <span><strong>{studentHistory.summary.attended}</strong> đã học</span>
                <span><strong>{studentHistory.summary.total}</strong> tổng buổi</span>
                <span><strong>{studentHistory.summary.recorded}</strong> đã ghi nhận</span>
              </div>
            )}
          </div>

          {studentHistoryLoading && <div className="info-strip">Đang tải lịch sử điểm danh...</div>}
          {studentHistoryError && <div className="form-error">{studentHistoryError}</div>}

          {studentHistory && studentHistory.rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Buổi học</th><th>Lớp</th><th>Nội dung</th><th>Điểm danh</th><th>Ghi chú</th></tr>
                </thead>
                <tbody>
                  {studentHistory.rows.map((item) => (
                    <tr
                      key={item.sessionId}
                      className="attendance-history-row"
                      onClick={() => {
                        setSelectedClassId(item.classId)
                        setSelectedSessionId(item.sessionId)
                      }}
                      title="Mở buổi học này trong bảng điểm danh"
                    >
                      <td>{formatDateTime(item.startsAt)}</td>
                      <td><strong>{item.classCode} · {item.className}</strong></td>
                      <td>{item.topic ?? '—'}</td>
                      <td>
                        {item.status === 'PRESENT' ? 'Có mặt'
                          : item.status === 'ABSENT' ? 'Vắng'
                            : item.status === 'LATE' ? 'Trễ'
                              : item.status === 'EXCUSED' ? 'Có phép'
                                : item.status === 'MAKEUP' ? 'Học bù'
                                  : 'Chưa ghi nhận'}
                      </td>
                      <td>{item.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {studentHistory && studentHistory.rows.length === 0 && (
            <div className="info-strip">Học viên chưa có buổi học nào trong lịch sử enrollment.</div>
          )}
        </div>
      )}
      <div className="panel attendance-builder">
        <div className="panel-title">
          <div>
            <span className="eyebrow">BUỔI HỌC & ĐIỂM DANH</span>
            <h3>Tạo hoặc chọn buổi học</h3>
          </div>
          <div className="button-row">
            <button className="secondary-btn" onClick={() => void rebuildAttendanceRisk()} disabled={rebuildingRisk}>
              {rebuildingRisk ? 'Đang đồng bộ...' : '↻ Đồng bộ cảnh báo nghỉ học'}
            </button>
            <button className="secondary-btn" onClick={() => selectedClassId && loadSessions(selectedClassId)}>Làm mới</button>
          </div>
        </div>

        <div className="attendance-control-grid">
          <label className="form-field">
            <span>Lớp học</span>
            <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
              <option value="">Chọn lớp</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>

          <label className="form-field">
            <span>Ngày giờ bắt đầu</span>
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>

          <label className="form-field">
            <span>Nội dung buổi học</span>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Kihon, Kata, Kumite..." />
          </label>

          <button className="primary-btn attendance-create-btn" onClick={createSession} disabled={creating || !selectedClassId}>
            {creating ? 'Đang tạo...' : '+ Tạo buổi học'}
          </button>
        </div>

        <label className="form-field attendance-session-note">
          <span>Ghi chú buổi học</span>
          <input value={sessionNote} onChange={(event) => setSessionNote(event.target.value)} placeholder="Ghi chú tùy chọn..." />
        </label>

        <div className="attendance-session-picker">
          <span>Buổi học đã tạo</span>
          <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)} disabled={!selectedClassId || sessions.length === 0}>
            <option value="">{sessions.length === 0 ? 'Chưa có buổi học' : 'Chọn buổi học'}</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatDateTime(session.startsAt)}{session.topic ? ` · ${session.topic}` : ''}{session.isCancelled ? ' · ĐÃ HỦY' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="form-error attendance-message">{error}</div>}
      {message && <div className="attendance-success attendance-message">{message}</div>}
      {loading && <div className="info-strip">Đang tải dữ liệu điểm danh...</div>}

      {!loading && currentSession && (
        <>
          <div className={`attendance-head ${currentSession.isCancelled ? 'cancelled' : ''}`}>
            <div>
              <span className="eyebrow">ĐIỂM DANH ONLINE</span>
              <h2>{currentSession.class?.name ?? selectedClass?.name ?? 'Lớp học'}</h2>
              <p>
                {formatDateTime(currentSession.startsAt)}
                {currentSession.topic ? ` · ${currentSession.topic}` : ''}
                {currentSession.isCancelled ? ' · Buổi học đã hủy' : ''}
              </p>
            </div>
            <div className="attendance-summary"><strong>{presentCount}</strong><span>Có mặt (gồm trễ) / {rows.length}</span></div>
          </div>

          <div className="attendance-stat-row">
            <span><strong>{presentCount}</strong> Có mặt (gồm trễ)</span>
            <span><strong>{absentCount}</strong> Vắng</span>
            <span><strong>{lateCount}</strong> Trễ</span>
            <span><strong>{excusedCount}</strong> Có phép</span>
            <span><strong>{unmarkedCount}</strong> Chưa ghi nhận</span>
          </div>

          <div className="panel">
            {rows.length === 0 ? (
              <div className="empty-class-state">
                <strong>Chưa có học viên trong buổi học này</strong>
                <p>Hãy xếp học viên vào lớp bằng Enrollment trước, sau đó tạo buổi học mới.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Học viên</th><th>Cấp đai</th><th>Điểm danh</th><th>Cảnh báo</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.studentId}>
                        <td><strong>{row.fullName}</strong><br/><span className="subtle">{row.code}</span></td>
                        <td>{row.beltLevel ?? 'Chưa có đai'}</td>
                        <td>
                          <div className="attendance-buttons">
                            {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((status) => (
                              <button
                                key={status}
                                disabled={currentSession.isCancelled}
                                className={row.status === status ? `selected ${status.toLowerCase()}` : ''}
                                onClick={() => updateStatus(row.studentId, status)}
                              >
                                {{ PRESENT: 'Có mặt', ABSENT: 'Vắng', LATE: 'Trễ', EXCUSED: 'Có phép' }[status]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>{row.consecutiveAbsences >= 2 ? <span className="risk-tag">⚠ {row.consecutiveAbsences} buổi liên tiếp</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel-footer attendance-footer-actions">
              <span>Chỉ lưu khi bạn chọn trạng thái. Chưa ghi nhận không được tính là vắng; đi trễ vẫn tính là đã học nhưng giữ trạng thái LATE riêng.</span>
              <div className="button-row">
                {!currentSession.isCancelled && <button className="danger-btn" onClick={cancelSession} disabled={saving}>Hủy buổi học</button>}
                <button className="primary-btn" onClick={saveAttendance} disabled={saving || rows.length === 0 || currentSession.isCancelled}>
                  {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function TuitionPage({
  students,
  onWarningCountChange,
}: {
  students: Student[]
  onWarningCountChange: (count: number) => void
}) {
  type TuitionTab = 'packages' | 'subscriptions' | 'invoices' | 'warnings' | 'reconciliation'

  const [tab, setTab] = useState<TuitionTab>('packages')
  const [packages, setPackages] = useState<LearningPackage[]>([])
  const [subscriptions, setSubscriptions] = useState<StudentPackageSubscription[]>([])
  const [invoices, setInvoices] = useState<PackageInvoice[]>([])
  const [warnings, setWarnings] = useState<PackageWarning[]>([])
  const [bankEvents, setBankEvents] = useState<BankTransferEvent[]>([])
  const [matchEvent, setMatchEvent] = useState<BankTransferEvent | null>(null)
  const [matchInvoiceId, setMatchInvoiceId] = useState('')
  const [matchingEvent, setMatchingEvent] = useState(false)
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewSubscriptionItem, setRenewSubscriptionItem] = useState<StudentPackageSubscription | null>(null)
  const [renewStartDate, setRenewStartDate] = useState('')
  const [renewDueDate, setRenewDueDate] = useState('')
  const [renewPrice, setRenewPrice] = useState('')
  const [renewNote, setRenewNote] = useState('')
  const [renewSaving, setRenewSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [packageModalOpen, setPackageModalOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<LearningPackage | null>(null)
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackageForm)
  const [savingPackage, setSavingPackage] = useState(false)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignPackageId, setAssignPackageId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [assignDueDate, setAssignDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [assignPrice, setAssignPrice] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState<InvoiceQr | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<PackageInvoice | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'OTHER' | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const apiJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await authFetch(`${apiBase}${path}`, options)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
      throw new Error(message || `API error (${response.status})`)
    }
    return response.json()
  }

  const loadTuition = async () => {
    setLoading(true)
    setError('')
    try {
      const [packageData, subscriptionData, invoiceData, warningData, eventData] = await Promise.all([
        apiJson<LearningPackage[]>('/learning-packages/catalog?includeInactive=true'),
        apiJson<StudentPackageSubscription[]>('/learning-packages/subscriptions'),
        apiJson<PackageInvoice[]>('/learning-packages/invoices'),
        apiJson<PackageWarning[]>('/learning-packages/warnings?days=7'),
        apiJson<BankTransferEvent[]>('/payment-webhooks/events').catch(() => []),
      ])

      setPackages(packageData)
      setSubscriptions(subscriptionData)
      setInvoices(invoiceData)
      setWarnings(warningData)
      setBankEvents(eventData)
      onWarningCountChange(warningData.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu gói học')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTuition()
  }, [])

  const activePackages = packages.filter((item) => item.active)
  const activeSubscriptions = subscriptions.filter((item) =>
    ['ACTIVE', 'PAUSED', 'EXPIRING'].includes(item.displayStatus),
  )

  const totalDebt = invoices.reduce((sum, item) => sum + item.remaining, 0)
  const totalPaid = invoices.reduce((sum, item) => sum + item.paidAmount, 0)
  const overdueCount = warnings.filter((item) => item.type === 'OVERDUE_PAYMENT').length
  const expiringCount = warnings.filter((item) =>
    ['PACKAGE_EXPIRING', 'PACKAGE_EXPIRED', 'SESSIONS_LOW', 'SESSIONS_USED_UP'].includes(item.type),
  ).length
  const reconciliationProblemCount = bankEvents.filter(
    (event) => ['UNMATCHED', 'NEEDS_REVIEW'].includes(event.status),
  ).length

  const openCreatePackage = () => {
    setEditingPackage(null)
    setPackageForm(emptyPackageForm)
    setPackageModalOpen(true)
  }

  const openEditPackage = (item: LearningPackage) => {
    setEditingPackage(item)
    setPackageForm({
      code: item.code,
      name: item.name,
      billingType: item.billingType,
      durationValue: item.durationValue ? String(item.durationValue) : '',
      durationUnit: item.durationUnit ?? 'MONTH',
      sessionsPerWeek: item.sessionsPerWeek ? String(item.sessionsPerWeek) : '',
      includedSessions: item.includedSessions ? String(item.includedSessions) : '',
      price: String(Number(item.price)),
      description: item.description ?? '',
    })
    setPackageModalOpen(true)
  }

  const savePackage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingPackage(true)
    setError('')

    try {
      const payload = {
        code: packageForm.code.trim(),
        name: packageForm.name.trim(),
        billingType: packageForm.billingType,
        durationValue: packageForm.durationValue ? Number(packageForm.durationValue) : undefined,
        durationUnit: packageForm.durationValue ? packageForm.durationUnit : undefined,
        sessionsPerWeek: packageForm.sessionsPerWeek ? Number(packageForm.sessionsPerWeek) : undefined,
        includedSessions: packageForm.includedSessions ? Number(packageForm.includedSessions) : undefined,
        price: Number(packageForm.price),
        description: packageForm.description.trim() || undefined,
      }

      if (editingPackage) {
        await apiJson(`/learning-packages/catalog/${editingPackage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await apiJson('/learning-packages/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setPackageModalOpen(false)
      await loadTuition()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được gói học')
    } finally {
      setSavingPackage(false)
    }
  }

  const deactivatePackage = async (item: LearningPackage) => {
    if (!window.confirm(`Ngừng sử dụng gói ${item.name}? Các học viên đã đăng ký vẫn giữ nguyên gói và giá cũ.`)) return

    try {
      await apiJson(`/learning-packages/catalog/${item.id}`, { method: 'DELETE' })
      await loadTuition()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không ngừng được gói học')
    }
  }

  const openAssignPackage = (studentId = '') => {
    setAssignStudentId(studentId)
    setAssignPackageId(activePackages[0]?.id ?? '')
    setAssignStartDate(new Date().toISOString().slice(0, 10))
    setAssignDueDate(new Date().toISOString().slice(0, 10))
    setAssignPrice('')
    setAssignNote('')
    setAssignModalOpen(true)
  }

  const selectedAssignPackage = activePackages.find((item) => item.id === assignPackageId)

  const assignPackage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAssignSaving(true)
    setError('')

    try {
      await apiJson('/learning-packages/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: assignStudentId,
          packageId: assignPackageId,
          startDate: assignStartDate,
          paymentDueDate: assignDueDate || undefined,
          priceOverride: assignPrice ? Number(assignPrice) : undefined,
          note: assignNote.trim() || undefined,
          createInvoice: true,
        }),
      })

      setAssignModalOpen(false)
      setTab('subscriptions')
      await loadTuition()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng ký được gói cho học viên')
    } finally {
      setAssignSaving(false)
    }
  }

  const openRenewModal = (item: StudentPackageSubscription) => {
    const today = new Date().toISOString().slice(0, 10)
    const endDate = item.endDate
      ? item.endDate.slice(0, 10)
      : ''

    const suggestedStart =
      endDate && new Date(item.endDate as string).getTime() > Date.now()
        ? endDate
        : today

    setRenewSubscriptionItem(item)
    setRenewStartDate(suggestedStart)
    setRenewDueDate(today)
    setRenewPrice(String(Number(item.package.price)))
    setRenewNote('')
    setRenewModalOpen(true)
  }

  const submitRenewal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renewSubscriptionItem) return

    setRenewSaving(true)
    setError('')

    try {
      await apiJson(
        `/learning-packages/subscriptions/${renewSubscriptionItem.id}/renew`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: renewStartDate || undefined,
            paymentDueDate: renewDueDate || undefined,
            priceOverride:
              renewPrice !== ''
                ? Number(renewPrice)
                : undefined,
            note: renewNote.trim() || undefined,
          }),
        },
      )

      setRenewModalOpen(false)
      setRenewSubscriptionItem(null)
      setTab('subscriptions')
      await loadTuition()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không gia hạn được gói học',
      )
    } finally {
      setRenewSaving(false)
    }
  }

  const updateSubscriptionStatus = async (item: StudentPackageSubscription, status: string) => {
    try {
      await apiJson(`/learning-packages/subscriptions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await loadTuition()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái gói')
    }
  }

  const openInvoiceQr = async (invoice: PackageInvoice) => {
    setQrModalOpen(true)
    setQrLoading(true)
    setQrData(null)
    setError('')

    try {
      const data = await apiJson<InvoiceQr>(
        `/learning-packages/invoices/${invoice.id}/qr`,
      )
      setQrData(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tạo được mã QR',
      )
      setQrModalOpen(false)
    } finally {
      setQrLoading(false)
    }
  }

  const showPaymentReceipt = async (invoice: PackageInvoice) => {
    try {
      const payments = await apiJson<PaymentReceipt[]>(
        `/learning-packages/invoices/${invoice.id}/payments`,
      )

      if (payments.length === 0) {
        window.alert('Hóa đơn này chưa có phiếu thu.')
        return
      }

      setReceiptData(payments[0])
      setReceiptModalOpen(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tải được phiếu thu',
      )
    }
  }

  const confirmQrPayment = async () => {
    if (!qrData) return

    if (
      !window.confirm(
        `Xác nhận đã nhận ${money.format(qrData.amount)} cho hóa đơn ${qrData.invoiceNo}?`,
      )
    ) return

    try {
      const payment = await apiJson<PaymentReceipt>(
        `/learning-packages/invoices/${qrData.invoiceId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: qrData.amount,
            method: 'BANK_TRANSFER',
            note: `Chuyển khoản VietQR - ${qrData.addInfo}`,
          }),
        },
      )

      setQrModalOpen(false)
      setQrData(null)
      setReceiptData(payment)
      setReceiptModalOpen(true)
      await loadTuition()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không ghi nhận được thanh toán QR',
      )
    }
  }

  const openPaymentModal = (invoice: PackageInvoice) => {
    setPaymentInvoice(invoice)
    setPaymentMethod(null)
    setPaymentAmount(String(invoice.remaining))
    setPaymentNote('')
    setPaymentModalOpen(true)
  }

  const choosePaymentMethod = async (
    method: 'CASH' | 'BANK_TRANSFER' | 'OTHER',
  ) => {
    setPaymentMethod(method)

    if (method === 'BANK_TRANSFER' && paymentInvoice) {
      setPaymentModalOpen(false)
      await openInvoiceQr(paymentInvoice)
    }
  }

  const submitNonBankPayment = async () => {
    if (!paymentInvoice || !paymentMethod || paymentMethod === 'BANK_TRANSFER') return

    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Số tiền thanh toán không hợp lệ')
      return
    }

    if (amount > paymentInvoice.remaining) {
      setError('Số tiền thanh toán không được lớn hơn công nợ còn lại')
      return
    }

    setPaymentSaving(true)
    setError('')

    try {
      const payment = await apiJson<PaymentReceipt>(
        `/learning-packages/invoices/${paymentInvoice.id}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            method: paymentMethod,
            note: paymentNote.trim() || undefined,
          }),
        },
      )

      setPaymentModalOpen(false)
      setPaymentInvoice(null)
      setPaymentMethod(null)
      setReceiptData(payment)
      setReceiptModalOpen(true)
      await loadTuition()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không ghi nhận được thanh toán',
      )
    } finally {
      setPaymentSaving(false)
    }
  }

  const openManualMatch = (event: BankTransferEvent) => {
    setMatchEvent(event)

    const suggested = invoices.find(
      (invoice) =>
        invoice.remaining > 0 &&
        Number(invoice.remaining) >= Number(event.amount),
    )

    setMatchInvoiceId(suggested?.id ?? '')
  }

  const submitManualMatch = async () => {
    if (!matchEvent || !matchInvoiceId) return

    setMatchingEvent(true)
    setError('')

    try {
      await apiJson(
        `/payment-webhooks/events/${matchEvent.id}/match`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: matchInvoiceId,
          }),
        },
      )

      setMatchEvent(null)
      setMatchInvoiceId('')
      await loadTuition()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không đối soát được giao dịch',
      )
    } finally {
      setMatchingEvent(false)
    }
  }

  const bankEventStatusText = (status: string) => ({
    RECEIVED: 'Đã nhận',
    MATCHED: 'Đã khớp',
    UNMATCHED: 'Chưa khớp',
    NEEDS_REVIEW: 'Cần kiểm tra',
    IGNORED: 'Bỏ qua',
  }[status] ?? status)

  const bankEventTone = (status: string) =>
    status === 'MATCHED'
      ? 'good'
      : ['UNMATCHED', 'NEEDS_REVIEW'].includes(status)
        ? 'danger'
        : status === 'RECEIVED'
          ? 'warning'
          : 'muted'

  const statusText = (status: string) => ({
    ACTIVE: 'Đang sử dụng',
    EXPIRING: 'Sắp hết hạn',
    EXPIRED: 'Đã hết hạn',
    PAUSED: 'Bảo lưu',
    PENDING: 'Chờ kích hoạt',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
    UNPAID: 'Chưa thu',
    PARTIAL: 'Thu một phần',
    PAID: 'Đã thu đủ',
    OVERDUE: 'Quá hạn',
  }[status] ?? status)

  const subscriptionTone = (status: string) =>
    ['ACTIVE', 'PAID'].includes(status) ? 'good' :
    ['EXPIRING', 'PARTIAL', 'PENDING'].includes(status) ? 'warning' :
    ['EXPIRED', 'OVERDUE'].includes(status) ? 'danger' : 'muted'

  return (
    <>
      <div className="stat-grid">
        <Stat label="Gói đang dùng" value={String(activeSubscriptions.length)} note={`${activePackages.length} mẫu gói đang mở bán`} icon="▣" />
        <Stat label="Đã thu học phí" value={money.format(totalPaid)} note="Theo hóa đơn gói học" icon="✓" />
        <Stat label="Công nợ" value={money.format(totalDebt)} note={`${overdueCount} khoản quá hạn`} icon="₫" warning={totalDebt > 0} />
        <Stat label="Cần gia hạn" value={String(expiringCount)} note="Sắp hết hạn / sắp hết buổi" icon="!" warning={expiringCount > 0} />
      </div>

      <div className="package-tabs">
        <button className={tab === 'packages' ? 'active' : ''} onClick={() => setTab('packages')}>Gói học</button>
        <button className={tab === 'subscriptions' ? 'active' : ''} onClick={() => setTab('subscriptions')}>Đăng ký học viên</button>
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>Hóa đơn & công nợ</button>
        <button className={tab === 'warnings' ? 'active' : ''} onClick={() => setTab('warnings')}>
          Cảnh báo {warnings.length > 0 && <span>{warnings.length}</span>}
        </button>
        <button className={tab === 'reconciliation' ? 'active' : ''} onClick={() => setTab('reconciliation')}>
          Đối soát {reconciliationProblemCount > 0 && <span>{reconciliationProblemCount}</span>}
        </button>
      </div>

      {error && <div className="form-error package-page-error">{error}</div>}
      {loading && <div className="info-strip">Đang tải dữ liệu gói học...</div>}

      {!loading && tab === 'packages' && (
        <>
          <div className="panel package-toolbar">
            <div>
              <span className="eyebrow">DANH MỤC GÓI HỌC</span>
              <h3>Tự tạo và điều chỉnh gói học</h3>
              <p>Giá mới chỉ áp dụng cho đăng ký mới; học viên cũ giữ nguyên giá snapshot.</p>
            </div>
            <button className="primary-btn" onClick={openCreatePackage}>+ Tạo gói học</button>
          </div>

          <div className="package-card-grid">
            {packages.map((item) => (
              <article className={`package-card ${!item.active ? 'inactive' : ''}`} key={item.id}>
                <div className="package-card-head">
                  <span className="class-code">{item.code}</span>
                  <Status value={item.active ? 'Đang bán' : 'Ngừng bán'} tone={item.active ? 'good' : 'muted'} />
                </div>
                <h3>{item.name}</h3>
                <strong className="package-price">{money.format(Number(item.price))}</strong>
                <div className="package-meta-list">
                  <span>Loại: {item.billingType === 'PT' ? 'PT' : item.billingType === 'SESSION_BASED' ? 'Theo số buổi' : 'Theo thời hạn'}</span>
                  <span>Thời hạn: {item.durationValue ? `${item.durationValue} ${item.durationUnit === 'MONTH' ? 'tháng' : item.durationUnit === 'WEEK' ? 'tuần' : 'ngày'}` : 'Không giới hạn'}</span>
                  <span>Tần suất: {item.sessionsPerWeek ? `${item.sessionsPerWeek} buổi/tuần` : 'Linh hoạt'}</span>
                  <span>Số buổi: {item.includedSessions ?? 'Không giới hạn riêng'}</span>
                </div>
                {item.description && <p>{item.description}</p>}
                <div className="button-row">
                  <button className="secondary-btn" onClick={() => openEditPackage(item)}>Sửa</button>
                  {item.active && <button className="danger-btn" onClick={() => deactivatePackage(item)}>Ngừng sử dụng</button>}
                </div>
              </article>
            ))}
            {packages.length === 0 && <div className="panel">Chưa có gói học. Hãy tạo gói đầu tiên.</div>}
          </div>
        </>
      )}

      {!loading && tab === 'subscriptions' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">GÓI HỌC CỦA HỌC VIÊN</span>
              <h3>{subscriptions.length} lượt đăng ký</h3>
            </div>
            <button className="primary-btn" onClick={() => openAssignPackage()}>+ Đăng ký gói</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Gói</th>
                  <th>Thời hạn</th>
                  <th>Sử dụng</th>
                  <th>Học phí</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.student.fullName}</strong><br/><span className="subtle">{item.student.code}</span></td>
                    <td><strong>{item.packageNameSnapshot}</strong><br/><span className="subtle">{item.sessionsPerWeekSnapshot ? `${item.sessionsPerWeekSnapshot} buổi/tuần` : 'Linh hoạt'}</span></td>
                    <td>{formatDate(item.startDate)} → {item.endDate ? formatDate(item.endDate) : 'Không giới hạn'}</td>
                    <td>
                      <strong>{item.usage.usedSessions} buổi đã học</strong>
                      <br/>
                      <span className="subtle">
                        {item.usage.remainingSessions == null ? 'Không giới hạn số buổi' : `Còn ${item.usage.remainingSessions} buổi`}
                      </span>
                    </td>
                    <td>
                      <strong>{money.format(item.billing.total)}</strong>
                      <br/>
                      <span className={item.billing.remaining > 0 ? 'debt' : 'subtle'}>
                        {item.billing.remaining > 0 ? `Còn nợ ${money.format(item.billing.remaining)}` : 'Đã thu đủ'}
                      </span>
                    </td>
                    <td><Status value={statusText(item.displayStatus)} tone={subscriptionTone(item.displayStatus)} /></td>
                    <td>
                      <div className="table-actions">
                        {!['CANCELLED', 'PENDING'].includes(item.status) && (
                          <button className="tiny-btn renew-btn" onClick={() => openRenewModal(item)}>
                            Gia hạn
                          </button>
                        )}
                        {item.status === 'ACTIVE' && <button className="tiny-btn" onClick={() => updateSubscriptionStatus(item, 'PAUSED')}>Bảo lưu</button>}
                        {item.status === 'PAUSED' && <button className="tiny-btn" onClick={() => updateSubscriptionStatus(item, 'ACTIVE')}>Kích hoạt</button>}
                        {!['CANCELLED', 'COMPLETED'].includes(item.status) && <button className="tiny-btn danger-text" onClick={() => updateSubscriptionStatus(item, 'CANCELLED')}>Hủy</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && <tr><td colSpan={7}>Chưa có học viên đăng ký gói.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'invoices' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">HÓA ĐƠN & CÔNG NỢ</span>
              <h3>Học phí phát sinh từ gói học</h3>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hóa đơn</th>
                  <th>Học viên</th>
                  <th>Gói học</th>
                  <th>Phải thu</th>
                  <th>Đã thu</th>
                  <th>Còn nợ</th>
                  <th>Hạn thu</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="mono">{invoice.invoiceNo}</td>
                    <td><strong>{invoice.student.fullName}</strong></td>
                    <td>{invoice.studentPackage?.packageNameSnapshot ?? 'Gói học'}</td>
                    <td>{money.format(invoice.total)}</td>
                    <td>{money.format(invoice.paidAmount)}</td>
                    <td className={invoice.remaining > 0 ? 'debt' : ''}>{money.format(invoice.remaining)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td><Status value={statusText(invoice.displayStatus)} tone={subscriptionTone(invoice.displayStatus)} /></td>
                    <td>
                      <div className="table-actions">
                        {invoice.remaining > 0 && (
                          <button
                            className="primary-btn compact-btn"
                            onClick={() => openPaymentModal(invoice)}
                          >
                            Thanh toán
                          </button>
                        )}
                        {invoice.paidAmount > 0 && (
                          <button className="tiny-btn" onClick={() => showPaymentReceipt(invoice)}>
                            Phiếu thu
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={9}>Chưa có hóa đơn gói học.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'warnings' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">CẢNH BÁO TỰ ĐỘNG</span>
              <h3>Sắp hết hạn · hết buổi · chưa nộp phí</h3>
            </div>
          </div>

          <div className="package-warning-list">
            {warnings.map((item, index) => (
              <div className={`package-warning ${item.severity}`} key={`${item.type}-${item.subscriptionId}-${index}`}>
                <div className="package-warning-icon">{item.severity === 'danger' ? '!' : '⌛'}</div>
                <div>
                  <strong>{item.studentName}</strong>
                  <span>{item.packageName}</span>
                  <p>{item.message}</p>
                </div>
                <span className="package-warning-type">{item.type.replaceAll('_', ' ')}</span>
              </div>
            ))}
            {warnings.length === 0 && <div className="info-strip">Hiện không có cảnh báo học phí/gói học.</div>}
          </div>
        </div>
      )}

      {renewModalOpen && renewSubscriptionItem && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !renewSaving
            ) {
              setRenewModalOpen(false)
            }
          }}
        >
          <div className="modal-card renew-modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">GIA HẠN GÓI HỌC</span>
                <h2>{renewSubscriptionItem.student.fullName}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                disabled={renewSaving}
                onClick={() => setRenewModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="renew-summary">
              <Detail
                label="Gói hiện tại"
                value={renewSubscriptionItem.packageNameSnapshot}
              />
              <Detail
                label="Ngày kết thúc"
                value={renewSubscriptionItem.endDate ? formatDate(renewSubscriptionItem.endDate) : 'Theo số buổi'}
              />
              <Detail
                label="Giá niêm yết hiện tại"
                value={money.format(Number(renewSubscriptionItem.package.price))}
              />
              <Detail
                label="Công nợ gói hiện tại"
                value={money.format(renewSubscriptionItem.billing.remaining)}
              />
            </div>

            <form onSubmit={submitRenewal}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Ngày bắt đầu kỳ mới *</span>
                  <input
                    type="date"
                    required
                    value={renewStartDate}
                    onChange={(event) => setRenewStartDate(event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Hạn nộp học phí *</span>
                  <input
                    type="date"
                    required
                    value={renewDueDate}
                    onChange={(event) => setRenewDueDate(event.target.value)}
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Giá áp dụng cho lần gia hạn *</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={renewPrice}
                    onChange={(event) => setRenewPrice(event.target.value)}
                  />
                  <small className="field-help">
                    Mặc định lấy giá hiện tại của gói. Có thể nhập giá riêng cho học viên.
                  </small>
                </label>

                <label className="form-field form-field-wide">
                  <span>Ghi chú</span>
                  <textarea
                    rows={3}
                    value={renewNote}
                    onChange={(event) => setRenewNote(event.target.value)}
                    placeholder="Ví dụ: gia hạn kỳ tiếp theo, ưu đãi học viên cũ..."
                  />
                </label>
              </div>

              <div className="renew-info">
                Khi gia hạn, hệ thống tạo <strong>một lượt gói mới và một hóa đơn mới</strong>.
                Gói cũ vẫn được giữ nguyên để tra cứu lịch sử.
              </div>

              <div className="modal-actions">
                <button
                  className="secondary-btn"
                  type="button"
                  disabled={renewSaving}
                  onClick={() => setRenewModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="primary-btn"
                  type="submit"
                  disabled={renewSaving}
                >
                  {renewSaving ? 'Đang gia hạn...' : 'Gia hạn & tạo hóa đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && tab === 'reconciliation' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">ĐỐI SOÁT CHUYỂN KHOẢN</span>
              <h3>Giao dịch ngân hàng nhận từ webhook</h3>
            </div>
            <button
              className="secondary-btn"
              onClick={() => void loadTuition()}
            >
              Làm mới
            </button>
          </div>

          <div className="info-strip reconciliation-note">
            Giao dịch có đúng mã hóa đơn và số tiền không vượt công nợ sẽ được tự động ghi nhận.
            Giao dịch chưa khớp hoặc cần kiểm tra sẽ không làm thay đổi công nợ.
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nguồn</th>
                  <th>Mã giao dịch</th>
                  <th>Nội dung</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bankEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.transferredAt)}</td>
                    <td>{event.provider}</td>
                    <td className="mono">{event.transactionId}</td>
                    <td>{event.description}</td>
                    <td><strong>{money.format(Number(event.amount))}</strong></td>
                    <td>
                      <Status
                        value={bankEventStatusText(event.status)}
                        tone={bankEventTone(event.status)}
                      />
                    </td>
                    <td>
                      <span className="subtle">
                        {event.note ?? '—'}
                      </span>
                    </td>
                    <td>
                      {['UNMATCHED', 'NEEDS_REVIEW', 'IGNORED'].includes(event.status) && (
                        <button
                          className="tiny-btn"
                          onClick={() => openManualMatch(event)}
                        >
                          Khớp hóa đơn
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {bankEvents.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      Chưa nhận được giao dịch webhook nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {matchEvent && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !matchingEvent
            ) {
              setMatchEvent(null)
            }
          }}
        >
          <div className="modal-card reconcile-modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">ĐỐI SOÁT THỦ CÔNG</span>
                <h2>Khớp giao dịch với hóa đơn</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                disabled={matchingEvent}
                onClick={() => setMatchEvent(null)}
              >
                ×
              </button>
            </div>

            <div className="reconcile-event-summary">
              <Detail
                label="Mã giao dịch"
                value={matchEvent.transactionId}
              />
              <Detail
                label="Số tiền"
                value={money.format(Number(matchEvent.amount))}
              />
              <Detail
                label="Nội dung"
                value={matchEvent.description}
                wide
              />
            </div>

            <label className="form-field">
              <span>Chọn hóa đơn còn công nợ *</span>
              <select
                value={matchInvoiceId}
                onChange={(event) =>
                  setMatchInvoiceId(event.target.value)
                }
              >
                <option value="">Chọn hóa đơn</option>
                {invoices
                  .filter((invoice) => invoice.remaining > 0)
                  .map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNo} · {invoice.student.fullName} · còn {money.format(invoice.remaining)}
                    </option>
                  ))}
              </select>
            </label>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                disabled={matchingEvent}
                onClick={() => setMatchEvent(null)}
              >
                Hủy
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={
                  matchingEvent || !matchInvoiceId
                }
                onClick={() => void submitManualMatch()}
              >
                {matchingEvent
                  ? 'Đang đối soát...'
                  : 'Khớp giao dịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModalOpen && paymentInvoice && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !paymentSaving) {
              setPaymentModalOpen(false)
            }
          }}
        >
          <div className="modal-card payment-method-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">THANH TOÁN HỌC PHÍ</span>
                <h2>Chọn phương thức thanh toán</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                disabled={paymentSaving}
                onClick={() => setPaymentModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="payment-invoice-summary">
              <div>
                <span>Học viên</span>
                <strong>{paymentInvoice.student.fullName}</strong>
              </div>
              <div>
                <span>Hóa đơn</span>
                <strong className="mono">{paymentInvoice.invoiceNo}</strong>
              </div>
              <div>
                <span>Còn phải thu</span>
                <strong className="payment-debt">
                  {money.format(paymentInvoice.remaining)}
                </strong>
              </div>
            </div>

            <div className="payment-method-list">
              <button
                type="button"
                className={`payment-method-card ${paymentMethod === 'CASH' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('CASH')}
              >
                <span className="payment-method-icon">₫</span>
                <div>
                  <strong>Tiền mặt</strong>
                  <p>Thu trực tiếp tại võ đường và xuất phiếu thu.</p>
                </div>
                <span className="payment-method-arrow">›</span>
              </button>

              <button
                type="button"
                className="payment-method-card bank"
                onClick={() => void choosePaymentMethod('BANK_TRANSFER')}
              >
                <span className="payment-method-icon">▣</span>
                <div>
                  <strong>Chuyển khoản ngân hàng</strong>
                  <p>Quét VietQR vào tài khoản VPBank của võ đường.</p>
                </div>
                <span className="payment-method-arrow">›</span>
              </button>

              <button
                type="button"
                className={`payment-method-card ${paymentMethod === 'OTHER' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('OTHER')}
              >
                <span className="payment-method-icon">•••</span>
                <div>
                  <strong>Phương thức khác</strong>
                  <p>Ghi nhận một hình thức thanh toán khác.</p>
                </div>
                <span className="payment-method-arrow">›</span>
              </button>
            </div>

            {(paymentMethod === 'CASH' || paymentMethod === 'OTHER') && (
              <div className="payment-detail-form">
                <label className="form-field">
                  <span>Số tiền thu *</span>
                  <input
                    type="number"
                    min="1"
                    max={paymentInvoice.remaining}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Ghi chú</span>
                  <input
                    value={paymentNote}
                    onChange={(event) => setPaymentNote(event.target.value)}
                    placeholder={
                      paymentMethod === 'CASH'
                        ? 'Ví dụ: thu tiền mặt tại quầy'
                        : 'Nhập ghi chú thanh toán'
                    }
                  />
                </label>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="secondary-btn"
                type="button"
                disabled={paymentSaving}
                onClick={() => setPaymentModalOpen(false)}
              >
                Hủy
              </button>

              {(paymentMethod === 'CASH' || paymentMethod === 'OTHER') && (
                <button
                  className="primary-btn"
                  type="button"
                  disabled={paymentSaving}
                  onClick={() => void submitNonBankPayment()}
                >
                  {paymentSaving ? 'Đang ghi nhận...' : 'Xác nhận thanh toán'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {qrModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQrModalOpen(false)
          }}
        >
          <div className="modal-card qr-modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">CHUYỂN KHOẢN · VIETQR</span>
                <h2>Quét QR để thanh toán</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setQrModalOpen(false)}>×</button>
            </div>

            {qrLoading && <div className="info-strip">Đang tạo mã QR...</div>}

            {!qrLoading && qrData && (
              <div className="qr-payment-layout">
                <div className="qr-image-wrap">
                  <img src={qrData.qrImageUrl} alt={`VietQR ${qrData.invoiceNo}`} />
                </div>

                <div className="qr-payment-info">
                  <span>Học viên</span>
                  <strong>{qrData.studentName}</strong>

                  <span>Gói học</span>
                  <strong>{qrData.packageName}</strong>

                  <span>Số tiền</span>
                  <strong className="qr-amount">{money.format(qrData.amount)}</strong>

                  <span>Nội dung chuyển khoản</span>
                  <strong className="mono">{qrData.addInfo}</strong>

                  <span>Ngân hàng</span>
                  <strong>{qrData.bankId === 'VPBank' ? 'VPBank' : qrData.bankId}</strong>

                  <span>Số tài khoản</span>
                  <strong>{qrData.accountNo}</strong>

                  <span>Chủ tài khoản</span>
                  <strong>{qrData.accountName}</strong>
                </div>
              </div>
            )}

            {!qrLoading && qrData && (
              <div className="bank-confirm-note">
                Sau khi chuyển khoản thành công, quản trị viên kiểm tra tiền đã vào tài khoản
                rồi bấm <strong>Xác nhận đã nhận tiền</strong>.
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setQrModalOpen(false)}>Đóng</button>
              <button className="primary-btn" type="button" disabled={!qrData || qrLoading} onClick={confirmQrPayment}>
                Xác nhận đã nhận tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptModalOpen && receiptData && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReceiptModalOpen(false)
          }}
        >
          <div className="modal-card receipt-modal-card">
            <div className="receipt-print-area">
              <div className="receipt-head">
                <div>
                  <span className="eyebrow">KARATE DOJO</span>
                  <h2>PHIẾU THU HỌC PHÍ</h2>
                </div>
                <span className="mono">{receiptData.receipt?.receiptNo ?? receiptData.paymentNo}</span>
              </div>

              <div className="receipt-grid">
                <Detail label="Học viên" value={receiptData.invoice?.studentName ?? '—'} />
                <Detail label="Hóa đơn" value={receiptData.invoice?.invoiceNo ?? '—'} />
                <Detail label="Số tiền thu" value={money.format(Number(receiptData.amount))} />
                <Detail label="Phương thức" value={receiptData.method} />
                <Detail label="Ngày thu" value={formatDateTime(receiptData.paidAt)} />
                <Detail label="Mã thanh toán" value={receiptData.paymentNo} />
              </div>

              <div className="receipt-total">
                <span>SỐ TIỀN ĐÃ THU</span>
                <strong>{money.format(Number(receiptData.amount))}</strong>
              </div>
            </div>

            <div className="modal-actions no-print">
              <button className="secondary-btn" type="button" onClick={() => setReceiptModalOpen(false)}>Đóng</button>
              <button className="primary-btn" type="button" onClick={() => window.print()}>In phiếu thu</button>
            </div>
          </div>
        </div>
      )}

      {packageModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPackageModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">GÓI HỌC</span>
                <h2>{editingPackage ? 'Chỉnh sửa gói học' : 'Tạo gói học mới'}</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setPackageModalOpen(false)}>×</button>
            </div>

            <form onSubmit={savePackage}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Mã gói *</span>
                  <input required value={packageForm.code} onChange={(e) => setPackageForm((v) => ({ ...v, code: e.target.value }))} placeholder="1M-3B" />
                </label>
                <label className="form-field">
                  <span>Tên gói *</span>
                  <input required value={packageForm.name} onChange={(e) => setPackageForm((v) => ({ ...v, name: e.target.value }))} placeholder="1 tháng · 3 buổi/tuần" />
                </label>
                <label className="form-field">
                  <span>Loại gói</span>
                  <select value={packageForm.billingType} onChange={(e) => setPackageForm((v) => ({ ...v, billingType: e.target.value as PackageBillingType }))}>
                    <option value="TIME_BASED">Theo thời hạn</option>
                    <option value="SESSION_BASED">Theo số buổi</option>
                    <option value="PT">PT</option>
                    <option value="CUSTOM">Tùy chỉnh</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Giá gói *</span>
                  <input required min="0" type="number" value={packageForm.price} onChange={(e) => setPackageForm((v) => ({ ...v, price: e.target.value }))} placeholder="850000" />
                </label>
                <label className="form-field">
                  <span>Thời hạn</span>
                  <input min="1" type="number" value={packageForm.durationValue} onChange={(e) => setPackageForm((v) => ({ ...v, durationValue: e.target.value }))} />
                </label>
                <label className="form-field">
                  <span>Đơn vị thời hạn</span>
                  <select value={packageForm.durationUnit} onChange={(e) => setPackageForm((v) => ({ ...v, durationUnit: e.target.value as PackageDurationUnit }))}>
                    <option value="DAY">Ngày</option>
                    <option value="WEEK">Tuần</option>
                    <option value="MONTH">Tháng</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Buổi / tuần</span>
                  <input min="1" type="number" value={packageForm.sessionsPerWeek} onChange={(e) => setPackageForm((v) => ({ ...v, sessionsPerWeek: e.target.value }))} placeholder="3" />
                </label>
                <label className="form-field">
                  <span>Tổng số buổi</span>
                  <input min="1" type="number" value={packageForm.includedSessions} onChange={(e) => setPackageForm((v) => ({ ...v, includedSessions: e.target.value }))} placeholder="10 (ví dụ PT 10 buổi)" />
                </label>
                <label className="form-field form-field-wide">
                  <span>Mô tả</span>
                  <textarea rows={3} value={packageForm.description} onChange={(e) => setPackageForm((v) => ({ ...v, description: e.target.value }))} placeholder="Điều kiện, đối tượng, ghi chú về gói..." />
                </label>
              </div>

              <div className="modal-actions">
                <button className="secondary-btn" type="button" onClick={() => setPackageModalOpen(false)}>Hủy</button>
                <button className="primary-btn" type="submit" disabled={savingPackage}>{savingPackage ? 'Đang lưu...' : 'Lưu gói học'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">ĐĂNG KÝ GÓI</span>
                <h2>Gán gói học cho học viên</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setAssignModalOpen(false)}>×</button>
            </div>

            <form onSubmit={assignPackage}>
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Học viên *</span>
                  <select required value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)}>
                    <option value="">Chọn học viên</option>
                    {students.filter((student) => student.status === 'ACTIVE').map((student) => (
                      <option key={student.id} value={student.id}>{student.code} · {student.fullName}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field form-field-wide">
                  <span>Gói học *</span>
                  <select required value={assignPackageId} onChange={(e) => {
                    setAssignPackageId(e.target.value)
                    setAssignPrice('')
                  }}>
                    <option value="">Chọn gói</option>
                    {activePackages.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {money.format(Number(item.price))}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Ngày bắt đầu *</span>
                  <input required type="date" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Hạn nộp phí</span>
                  <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
                </label>

                <label className="form-field form-field-wide">
                  <span>Giá áp dụng riêng</span>
                  <input type="number" min="0" value={assignPrice} onChange={(e) => setAssignPrice(e.target.value)} placeholder={selectedAssignPackage ? `Mặc định ${money.format(Number(selectedAssignPackage.price))}` : 'Để trống = giá niêm yết'} />
                  <small className="field-help">Giá này sẽ được snapshot, sửa giá gói sau này không làm thay đổi đăng ký cũ.</small>
                </label>

                <label className="form-field form-field-wide">
                  <span>Ghi chú</span>
                  <textarea rows={3} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Ví dụ: ưu đãi anh em ruột, học viên cũ..." />
                </label>
              </div>

              <div className="modal-actions">
                <button className="secondary-btn" type="button" onClick={() => setAssignModalOpen(false)}>Hủy</button>
                <button className="primary-btn" type="submit" disabled={assignSaving}>{assignSaving ? 'Đang đăng ký...' : 'Đăng ký & tạo hóa đơn'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function FinancePage({
  students,
  branches,
  onWarningCountChange,
}: {
  students: Student[]
  branches: Branch[]
  onWarningCountChange: (count: number) => void
}) {
  type FinanceTab = 'ledger' | 'pos' | 'products' | 'sales'

  const [tab, setTab] = useState<FinanceTab>('ledger')
  const [branchId, setBranchId] = useState('')
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [transactions, setTransactions] = useState<CashTransactionItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [sales, setSales] = useState<SaleView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [transactionBranchId, setTransactionBranchId] = useState('')
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [transactionCategory, setTransactionCategory] = useState('')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => toDateTimeLocalValue(new Date()))
  const [transactionDescription, setTransactionDescription] = useState('')
  const [transactionSaving, setTransactionSaving] = useState(false)

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [productSku, setProductSku] = useState('')
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState('cái')
  const [productPrice, setProductPrice] = useState('')
  const [productCost, setProductCost] = useState('')
  const [productInitialStock, setProductInitialStock] = useState('0')
  const [productSaving, setProductSaving] = useState(false)

  const [stockProduct, setStockProduct] = useState<ProductItem | null>(null)
  const [stockQuantity, setStockQuantity] = useState('')
  const [stockReason, setStockReason] = useState('')
  const [stockSaving, setStockSaving] = useState(false)

  const [saleBranchId, setSaleBranchId] = useState('')
  const [saleStudentId, setSaleStudentId] = useState('')
  const [cart, setCart] = useState<Array<{ productId: string; quantity: number }>>([])
  const [saleSaving, setSaleSaving] = useState(false)
  const [salePaymentModalOpen, setSalePaymentModalOpen] = useState(false)
  const [salePaymentMethod, setSalePaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'OTHER' | null>(null)
  const [salePaymentNote, setSalePaymentNote] = useState('')
  const [saleQrModalOpen, setSaleQrModalOpen] = useState(false)
  const [saleQrLoading, setSaleQrLoading] = useState(false)
  const [saleQr, setSaleQr] = useState<SaleQr | null>(null)

  const apiJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await authFetch(`${apiBase}${path}`, options)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
      throw new Error(message || `API error (${response.status})`)
    }
    return response.json()
  }

  const loadFinance = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (branchId) params.set('branchId', branchId)

      const query = params.toString() ? `?${params.toString()}` : ''
      const [summaryData, transactionData, productData, saleData] = await Promise.all([
        apiJson<FinanceSummary>(`/finance-sales/summary${query}`),
        apiJson<CashTransactionItem[]>(`/finance-sales/transactions${query}`),
        apiJson<ProductItem[]>('/finance-sales/products?includeInactive=true'),
        apiJson<SaleView[]>(`/finance-sales/sales${query}`),
      ])

      setSummary(summaryData)
      onWarningCountChange(Number(summaryData.lowStockProducts ?? 0))
      setTransactions(transactionData)
      setProducts(productData)
      setSales(saleData)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu thu chi & bán hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFinance()
  }, [branchId])

  useEffect(() => {
    if (branchId) {
      setSaleBranchId(branchId)
      return
    }

    if (!saleBranchId && branches.length === 1) {
      setSaleBranchId(branches[0].id)
    }
  }, [branchId, branches])

  const openTransactionModal = () => {
    setTransactionBranchId(branchId || (branches.length === 1 ? branches[0].id : ''))
    setTransactionType('INCOME')
    setTransactionCategory('')
    setTransactionAmount('')
    setTransactionDate(toDateTimeLocalValue(new Date()))
    setTransactionDescription('')
    setTransactionModalOpen(true)
  }

  const submitTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(transactionAmount)
    if (!transactionBranchId || !transactionCategory.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Vui lòng nhập đủ chi nhánh, danh mục và số tiền hợp lệ.')
      return
    }

    setTransactionSaving(true)
    setError('')

    try {
      await apiJson('/finance-sales/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          branchId: transactionBranchId,
          type: transactionType,
          category: transactionCategory.trim(),
          amount,
          occurredAt: new Date(transactionDate).toISOString(),
          description: transactionDescription.trim() || undefined,
        }),
      })

      setTransactionModalOpen(false)
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không ghi được thu/chi')
    } finally {
      setTransactionSaving(false)
    }
  }

  const openCreateProduct = () => {
    setEditingProduct(null)
    setProductSku('')
    setProductName('')
    setProductUnit('cái')
    setProductPrice('')
    setProductCost('')
    setProductInitialStock('0')
    setProductModalOpen(true)
  }

  const openEditProduct = (product: ProductItem) => {
    setEditingProduct(product)
    setProductSku(product.sku)
    setProductName(product.name)
    setProductUnit(product.unit ?? '')
    setProductPrice(String(product.price))
    setProductCost(product.cost == null ? '' : String(product.cost))
    setProductInitialStock(String(product.stockQty))
    setProductModalOpen(true)
  }

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const price = Number(productPrice)
    const cost = productCost === '' ? undefined : Number(productCost)
    const stockQty = Number(productInitialStock)

    if (!productSku.trim() || !productName.trim() || !Number.isFinite(price) || price < 0) {
      setError('Mã SKU, tên sản phẩm và giá bán là bắt buộc.')
      return
    }

    setProductSaving(true)
    setError('')

    try {
      const payload = {
        sku: productSku.trim(),
        name: productName.trim(),
        unit: productUnit.trim() || undefined,
        price,
        cost,
        ...(!editingProduct && { stockQty: Number.isFinite(stockQty) && stockQty >= 0 ? stockQty : 0 }),
      }

      await apiJson(
        editingProduct ? `/finance-sales/products/${editingProduct.id}` : '/finance-sales/products',
        {
          method: editingProduct ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        },
      )

      setProductModalOpen(false)
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được sản phẩm')
    } finally {
      setProductSaving(false)
    }
  }

  const deactivateProduct = async (product: ProductItem) => {
    if (!window.confirm(`Ngừng bán sản phẩm “${product.name}”? Dữ liệu bán hàng cũ vẫn được giữ.`)) return

    setError('')
    try {
      await apiJson(`/finance-sales/products/${product.id}`, { method: 'DELETE' })
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không ngừng bán được sản phẩm')
    }
  }

  const submitStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stockProduct) return

    const quantity = Number(stockQuantity)
    if (!Number.isInteger(quantity) || quantity === 0 || !stockReason.trim()) {
      setError('Số lượng điều chỉnh phải là số nguyên khác 0 và cần có lý do.')
      return
    }

    setStockSaving(true)
    setError('')

    try {
      await apiJson(`/finance-sales/products/${stockProduct.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ quantity, reason: stockReason.trim() }),
      })

      setStockProduct(null)
      setStockQuantity('')
      setStockReason('')
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không điều chỉnh được tồn kho')
    } finally {
      setStockSaving(false)
    }
  }

  const activeProducts = products.filter((product) => product.active)
  const saleStudents = students.filter(
    (student) => student.status === 'ACTIVE' && (!saleBranchId || student.branchId === saleBranchId),
  )

  const addToCart = (productId: string) => {
    setCart((current) => {
      const product = activeProducts.find((item) => item.id === productId)
      const existing = current.find((item) => item.productId === productId)

      if (!product || product.stockQty <= 0) return current

      if (existing) {
        if (existing.quantity >= product.stockQty) return current
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      return [...current, { productId, quantity: 1 }]
    })
  }

  const changeCartQuantity = (productId: string, nextQuantity: number) => {
    const product = activeProducts.find((item) => item.id === productId)
    if (!product) return

    if (nextQuantity <= 0) {
      setCart((current) => current.filter((item) => item.productId !== productId))
      return
    }

    setCart((current) => current.map((item) =>
      item.productId === productId
        ? { ...item, quantity: Math.min(nextQuantity, product.stockQty) }
        : item,
    ))
  }

  const cartRows = cart.map((item) => {
    const product = activeProducts.find((productItem) => productItem.id === item.productId)
    return {
      ...item,
      product,
      amount: product ? product.price * item.quantity : 0,
    }
  }).filter((item) => item.product)

  const cartTotal = cartRows.reduce((sum, item) => sum + item.amount, 0)

  const validateSaleCart = () => {
    if (!saleBranchId) {
      setError('Vui lòng chọn chi nhánh bán hàng.')
      return false
    }

    if (cart.length === 0 || cartTotal <= 0) {
      setError('Giỏ hàng đang trống.')
      return false
    }

    return true
  }

  const openSalePayment = () => {
    if (!validateSaleCart()) return

    setSalePaymentMethod(null)
    setSalePaymentNote('')
    setSalePaymentModalOpen(true)
    setError('')
  }

  const createSaleWithPayment = async (
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'OTHER',
    options?: {
      saleNo?: string
      paymentReference?: string
      paymentNote?: string
    },
  ) => {
    if (!validateSaleCart()) return

    setSaleSaving(true)
    setError('')

    try {
      await apiJson('/finance-sales/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          branchId: saleBranchId,
          studentId: saleStudentId || undefined,
          items: cart,
          paymentMethod,
          saleNo: options?.saleNo,
          paymentReference: options?.paymentReference,
          paymentNote: options?.paymentNote,
        }),
      })

      setSalePaymentModalOpen(false)
      setSaleQrModalOpen(false)
      setSaleQr(null)
      setSalePaymentMethod(null)
      setSalePaymentNote('')
      setCart([])
      setSaleStudentId('')
      setTab('sales')
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được đơn bán hàng')
    } finally {
      setSaleSaving(false)
    }
  }

  const chooseSalePaymentMethod = async (
    method: 'CASH' | 'BANK_TRANSFER' | 'OTHER',
  ) => {
    setSalePaymentMethod(method)

    if (method !== 'BANK_TRANSFER') return

    setSaleQrLoading(true)
    setError('')

    try {
      const data = await apiJson<SaleQr>(
        `/finance-sales/sales/qr?amount=${encodeURIComponent(String(cartTotal))}`,
      )

      setSaleQr(data)
      setSalePaymentModalOpen(false)
      setSaleQrModalOpen(true)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Không tạo được mã QR bán hàng',
      )
    } finally {
      setSaleQrLoading(false)
    }
  }

  const confirmSaleQrPayment = async () => {
    if (!saleQr) return

    if (
      !window.confirm(
        `Xác nhận đã nhận ${money.format(saleQr.amount)} cho đơn ${saleQr.saleNo}?`,
      )
    ) return

    await createSaleWithPayment('BANK_TRANSFER', {
      saleNo: saleQr.saleNo,
      paymentReference: saleQr.addInfo,
      paymentNote: `Chuyển khoản VietQR - ${saleQr.addInfo}`,
    })
  }

  const cancelSale = async (sale: SaleView) => {
    if (!window.confirm(`Hủy đơn ${sale.saleNo}? Tồn kho sẽ được hoàn lại và khoản thu bán hàng sẽ được gỡ khỏi sổ thu chi.`)) return

    setError('')
    try {
      await apiJson(`/finance-sales/sales/${sale.id}/cancel`, { method: 'PATCH' })
      await loadFinance()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không hủy được đơn hàng')
    }
  }

  return (
    <>
      <div className="finance-filter-bar">
        <div>
          <span className="eyebrow">TÀI CHÍNH & BÁN HÀNG</span>
          <h3>Thu chi, kho sản phẩm và POS võ đường</h3>
        </div>

        <label className="form-field finance-branch-filter">
          <span>Chi nhánh đang xem</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="stat-grid">
        <Stat label="Tổng thu" value={money.format(summary?.monthlyIncome ?? 0)} note="CashTransaction · tháng hiện tại" icon="↗" />
        <Stat label="Tổng chi" value={money.format(summary?.monthlyExpense ?? 0)} note="CashTransaction · tháng hiện tại" icon="↘" warning={(summary?.monthlyExpense ?? 0) > 0} />
        <Stat label="Dòng tiền ròng" value={money.format(summary?.monthlyBalance ?? 0)} note="Tổng thu - tổng chi" icon="=" warning={(summary?.monthlyBalance ?? 0) < 0} />
        <Stat label="Doanh số bán hàng" value={money.format(summary?.monthlySales ?? 0)} note={`${summary?.salesCount ?? 0} đơn · ${summary?.lowStockProducts ?? 0} mặt hàng sắp hết`} icon="□" />
      </div>

      <div className="package-tabs finance-tabs">
        <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>Sổ thu chi</button>
        <button className={tab === 'pos' ? 'active' : ''} onClick={() => setTab('pos')}>Bán hàng / POS</button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          Kho sản phẩm {summary && summary.lowStockProducts > 0 && <span>{summary.lowStockProducts}</span>}
        </button>
        <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>Lịch sử bán hàng</button>
      </div>

      {error && <div className="form-error package-page-error">{error}</div>}
      {loading && <div className="info-strip">Đang tải dữ liệu tài chính...</div>}

      {!loading && tab === 'ledger' && (
        <div className="panel">
          <div className="panel-title">
            <div><span className="eyebrow">SỔ THU CHI</span><h3>Giao dịch thực tế</h3></div>
            <div className="button-row">
              <button className="secondary-btn" onClick={() => void loadFinance()}>Làm mới</button>
              <button className="primary-btn" onClick={openTransactionModal}>+ Ghi thu / chi</button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Thời gian</th><th>Chi nhánh</th><th>Loại</th><th>Danh mục</th><th>Mô tả</th><th>Số tiền</th><th>Nguồn</th></tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.occurredAt)}</td>
                    <td>{item.branch?.name ?? '—'}</td>
                    <td><Status value={item.type === 'INCOME' ? 'Thu' : 'Chi'} tone={item.type === 'INCOME' ? 'good' : 'danger'} /></td>
                    <td><strong>{item.category}</strong></td>
                    <td>{item.description || '—'}</td>
                    <td className={item.type === 'INCOME' ? 'positive' : 'negative'}>
                      <strong>{item.type === 'EXPENSE' ? '-' : '+'}{money.format(item.amount)}</strong>
                    </td>
                    <td>{item.referenceType ? <span className="mono">{item.referenceType}</span> : 'Nhập tay'}</td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={7}>Chưa có giao dịch thu/chi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'pos' && (
        <div className="pos-layout">
          <div className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">POS</span><h3>Chọn sản phẩm</h3></div>
              <button className="secondary-btn" onClick={() => setTab('products')}>Quản lý kho</button>
            </div>

            <div className="pos-products-grid">
              {activeProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`pos-product-card ${product.stockQty <= 5 ? 'low' : ''}`}
                  disabled={product.stockQty <= 0}
                  onClick={() => addToCart(product.id)}
                >
                  <span className="class-code">{product.sku}</span>
                  <strong>{product.name}</strong>
                  <span>{money.format(product.price)}</span>
                  <small>{product.stockQty > 0 ? `Còn ${product.stockQty} ${product.unit ?? 'sp'}` : 'Hết hàng'}</small>
                </button>
              ))}
              {activeProducts.length === 0 && <div className="info-strip">Chưa có sản phẩm đang bán.</div>}
            </div>
          </div>

          <div className="panel pos-cart-panel">
            <div className="panel-title"><div><span className="eyebrow">ĐƠN HÀNG</span><h3>Giỏ hàng</h3></div></div>

            <label className="form-field">
              <span>Chi nhánh bán *</span>
              <select value={saleBranchId} onChange={(event) => { setSaleBranchId(event.target.value); setSaleStudentId('') }}>
                <option value="">Chọn chi nhánh</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>Học viên mua (không bắt buộc)</span>
              <select value={saleStudentId} onChange={(event) => setSaleStudentId(event.target.value)} disabled={!saleBranchId}>
                <option value="">Khách lẻ / không chọn</option>
                {saleStudents.map((student) => <option key={student.id} value={student.id}>{student.code} · {student.fullName}</option>)}
              </select>
            </label>

            <div className="pos-cart-list">
              {cartRows.map((row) => row.product && (
                <div className="pos-cart-row" key={row.productId}>
                  <div><strong>{row.product.name}</strong><span>{money.format(row.product.price)} / {row.product.unit ?? 'sp'}</span></div>
                  <div className="pos-qty-control">
                    <button type="button" onClick={() => changeCartQuantity(row.productId, row.quantity - 1)}>−</button>
                    <strong>{row.quantity}</strong>
                    <button type="button" onClick={() => changeCartQuantity(row.productId, row.quantity + 1)}>+</button>
                  </div>
                  <strong>{money.format(row.amount)}</strong>
                </div>
              ))}
              {cartRows.length === 0 && <div className="info-strip">Chưa có sản phẩm trong giỏ.</div>}
            </div>

            <div className="pos-total"><span>TỔNG THANH TOÁN</span><strong>{money.format(cartTotal)}</strong></div>
            <button className="primary-btn pos-checkout-btn" disabled={saleSaving || !saleBranchId || cart.length === 0} onClick={openSalePayment}>
              Thanh toán
            </button>
          </div>
        </div>
      )}

      {!loading && tab === 'products' && (
        <div className="panel">
          <div className="panel-title">
            <div><span className="eyebrow">KHO SẢN PHẨM</span><h3>{activeProducts.length} mặt hàng đang bán</h3></div>
            <button className="primary-btn" onClick={openCreateProduct}>+ Thêm sản phẩm</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Sản phẩm</th><th>Giá vốn</th><th>Giá bán</th><th>Tồn</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className={!product.active ? 'inactive-row' : ''}>
                    <td className="mono">{product.sku}</td>
                    <td><strong>{product.name}</strong><br/><span className="subtle">Đơn vị: {product.unit ?? '—'}</span></td>
                    <td>{product.cost == null ? '—' : money.format(product.cost)}</td>
                    <td><strong>{money.format(product.price)}</strong></td>
                    <td>{product.stockQty <= 5 ? <span className="risk-tag">⚠ {product.stockQty}</span> : product.stockQty}</td>
                    <td><Status value={product.active ? 'Đang bán' : 'Ngừng bán'} tone={product.active ? 'good' : 'muted'} /></td>
                    <td>
                      <div className="table-actions">
                        <button className="tiny-btn" onClick={() => openEditProduct(product)}>Sửa</button>
                        {product.active && <button className="tiny-btn" onClick={() => { setStockProduct(product); setStockQuantity(''); setStockReason('') }}>± Tồn kho</button>}
                        {product.active && <button className="tiny-btn danger-text" onClick={() => void deactivateProduct(product)}>Ngừng bán</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={7}>Chưa có sản phẩm.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'sales' && (
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">LỊCH SỬ BÁN HÀNG</span><h3>{sales.length} đơn gần nhất</h3></div><button className="primary-btn" onClick={() => setTab('pos')}>+ Bán hàng</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mã đơn</th><th>Thời gian</th><th>Chi nhánh</th><th>Khách / học viên</th><th>Sản phẩm</th><th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono">{sale.saleNo}</td>
                    <td>{formatDateTime(sale.soldAt)}</td>
                    <td>{sale.branch?.name ?? '—'}</td>
                    <td>{sale.student ? `${sale.student.code} · ${sale.student.fullName}` : 'Khách lẻ'}</td>
                    <td>{sale.items.map((item) => `${item.product.name} ×${item.quantity}`).join(', ')}</td>
                    <td>{sale.paymentMethod === 'CASH' ? 'Tiền mặt' : sale.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Khác'}</td>
                    <td><strong>{money.format(sale.total)}</strong></td>
                    <td><Status value={sale.status === 'COMPLETED' ? 'Hoàn tất' : sale.status === 'CANCELLED' ? 'Đã hủy' : 'Nháp'} tone={sale.status === 'COMPLETED' ? 'good' : 'muted'} /></td>
                    <td>{sale.status === 'COMPLETED' && <button className="tiny-btn danger-text" onClick={() => void cancelSale(sale)}>Hủy đơn</button>}</td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={9}>Chưa có đơn bán hàng.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {salePaymentModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saleSaving) {
              setSalePaymentModalOpen(false)
            }
          }}
        >
          <div className="modal-card payment-method-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">THANH TOÁN ĐƠN HÀNG</span>
                <h2>Chọn phương thức thanh toán</h2>
              </div>
              <button className="modal-close" type="button" disabled={saleSaving} onClick={() => setSalePaymentModalOpen(false)}>×</button>
            </div>

            <div className="payment-invoice-summary">
              <div>
                <span>Chi nhánh</span>
                <strong>{branches.find((branch) => branch.id === saleBranchId)?.name ?? '—'}</strong>
              </div>
              <div>
                <span>Khách hàng</span>
                <strong>{saleStudents.find((student) => student.id === saleStudentId)?.fullName ?? 'Khách lẻ'}</strong>
              </div>
              <div>
                <span>Tổng thanh toán</span>
                <strong className="payment-debt">{money.format(cartTotal)}</strong>
              </div>
            </div>

            <div className="payment-method-list">
              <button
                type="button"
                className={`payment-method-card ${salePaymentMethod === 'CASH' ? 'selected' : ''}`}
                onClick={() => setSalePaymentMethod('CASH')}
              >
                <span className="payment-method-icon">₫</span>
                <div><strong>Tiền mặt</strong><p>Thu trực tiếp tại quầy.</p></div>
                <span className="payment-method-arrow">›</span>
              </button>

              <button
                type="button"
                className="payment-method-card bank"
                onClick={() => void chooseSalePaymentMethod('BANK_TRANSFER')}
              >
                <span className="payment-method-icon">▣</span>
                <div><strong>Chuyển khoản ngân hàng</strong><p>Quét VietQR vào tài khoản VPBank của võ đường.</p></div>
                <span className="payment-method-arrow">›</span>
              </button>

              <button
                type="button"
                className={`payment-method-card ${salePaymentMethod === 'OTHER' ? 'selected' : ''}`}
                onClick={() => setSalePaymentMethod('OTHER')}
              >
                <span className="payment-method-icon">•••</span>
                <div><strong>Phương thức khác</strong><p>Ví điện tử hoặc hình thức thanh toán khác.</p></div>
                <span className="payment-method-arrow">›</span>
              </button>
            </div>

            {(salePaymentMethod === 'CASH' || salePaymentMethod === 'OTHER') && (
              <div className="payment-detail-form sale-payment-note-form">
                <label className="form-field form-field-wide">
                  <span>Ghi chú</span>
                  <input
                    value={salePaymentNote}
                    onChange={(event) => setSalePaymentNote(event.target.value)}
                    placeholder={salePaymentMethod === 'CASH' ? 'Ví dụ: thu tiền mặt tại quầy' : 'Ví dụ: ví điện tử...'}
                  />
                </label>
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-btn" type="button" disabled={saleSaving} onClick={() => setSalePaymentModalOpen(false)}>Hủy</button>
              {(salePaymentMethod === 'CASH' || salePaymentMethod === 'OTHER') && (
                <button
                  className="primary-btn"
                  type="button"
                  disabled={saleSaving}
                  onClick={() => void createSaleWithPayment(salePaymentMethod, { paymentNote: salePaymentNote.trim() || undefined })}
                >
                  {saleSaving ? 'Đang thanh toán...' : 'Xác nhận thanh toán'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {saleQrModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saleSaving) {
              setSaleQrModalOpen(false)
            }
          }}
        >
          <div className="modal-card qr-modal-card">
            <div className="modal-header">
              <div>
                <span className="eyebrow">BÁN HÀNG · VIETQR</span>
                <h2>Quét QR để thanh toán</h2>
              </div>
              <button className="modal-close" type="button" disabled={saleSaving} onClick={() => setSaleQrModalOpen(false)}>×</button>
            </div>

            {saleQrLoading && <div className="info-strip">Đang tạo mã QR...</div>}

            {!saleQrLoading && saleQr && (
              <>
                <div className="qr-payment-layout">
                  <div className="qr-image-wrap">
                    <img src={saleQr.qrImageUrl} alt={`VietQR ${saleQr.saleNo}`} />
                  </div>

                  <div className="qr-payment-info">
                    <span>Mã đơn</span>
                    <strong className="mono">{saleQr.saleNo}</strong>

                    <span>Số tiền</span>
                    <strong className="qr-amount">{money.format(saleQr.amount)}</strong>

                    <span>Nội dung chuyển khoản</span>
                    <strong className="mono">{saleQr.addInfo}</strong>

                    <span>Ngân hàng</span>
                    <strong>{saleQr.bankId === 'VPBank' ? 'VPBank' : saleQr.bankId}</strong>

                    <span>Số tài khoản</span>
                    <strong>{saleQr.accountNo}</strong>

                    <span>Chủ tài khoản</span>
                    <strong>{saleQr.accountName}</strong>
                  </div>
                </div>

                <div className="bank-confirm-note">
                  Sau khi khách chuyển khoản thành công, kiểm tra tiền đã vào tài khoản rồi bấm <strong>Xác nhận đã nhận tiền</strong>.
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="secondary-btn" type="button" disabled={saleSaving} onClick={() => setSaleQrModalOpen(false)}>Đóng</button>
              <button className="primary-btn" type="button" disabled={!saleQr || saleQrLoading || saleSaving} onClick={() => void confirmSaleQrPayment()}>
                {saleSaving ? 'Đang hoàn tất...' : 'Xác nhận đã nhận tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !transactionSaving) setTransactionModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header"><div><span className="eyebrow">SỔ THU CHI</span><h2>Ghi giao dịch mới</h2></div><button className="modal-close" onClick={() => setTransactionModalOpen(false)} disabled={transactionSaving}>×</button></div>
            <form onSubmit={submitTransaction}>
              <div className="form-grid">
                <label className="form-field"><span>Chi nhánh *</span><select required value={transactionBranchId} onChange={(event) => setTransactionBranchId(event.target.value)}><option value="">Chọn chi nhánh</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label>
                <label className="form-field"><span>Loại *</span><select value={transactionType} onChange={(event) => setTransactionType(event.target.value as 'INCOME' | 'EXPENSE')}><option value="INCOME">Thu</option><option value="EXPENSE">Chi</option></select></label>
                <label className="form-field"><span>Danh mục *</span><input required value={transactionCategory} onChange={(event) => setTransactionCategory(event.target.value)} placeholder={transactionType === 'INCOME' ? 'Ví dụ: Thu khác' : 'Ví dụ: Tiền điện, dụng cụ'} /></label>
                <label className="form-field"><span>Số tiền *</span><input required type="number" min="1" value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} /></label>
                <label className="form-field form-field-wide"><span>Thời gian *</span><input required type="datetime-local" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} /></label>
                <label className="form-field form-field-wide"><span>Mô tả</span><textarea rows={3} value={transactionDescription} onChange={(event) => setTransactionDescription(event.target.value)} placeholder="Nội dung thu/chi..." /></label>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setTransactionModalOpen(false)} disabled={transactionSaving}>Hủy</button><button className="primary-btn" disabled={transactionSaving}>{transactionSaving ? 'Đang lưu...' : 'Ghi giao dịch'}</button></div>
            </form>
          </div>
        </div>
      )}

      {productModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !productSaving) setProductModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header"><div><span className="eyebrow">SẢN PHẨM</span><h2>{editingProduct ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h2></div><button className="modal-close" onClick={() => setProductModalOpen(false)} disabled={productSaving}>×</button></div>
            <form onSubmit={submitProduct}>
              <div className="form-grid">
                <label className="form-field"><span>SKU *</span><input required value={productSku} onChange={(event) => setProductSku(event.target.value)} placeholder="VP-TR-01" /></label>
                <label className="form-field"><span>Tên sản phẩm *</span><input required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Võ phục Karate trẻ em" /></label>
                <label className="form-field"><span>Đơn vị</span><input value={productUnit} onChange={(event) => setProductUnit(event.target.value)} placeholder="bộ / cái / đôi" /></label>
                <label className="form-field"><span>Giá bán *</span><input required type="number" min="0" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} /></label>
                <label className="form-field"><span>Giá vốn</span><input type="number" min="0" value={productCost} onChange={(event) => setProductCost(event.target.value)} /></label>
                {!editingProduct && <label className="form-field"><span>Tồn ban đầu</span><input type="number" min="0" value={productInitialStock} onChange={(event) => setProductInitialStock(event.target.value)} /></label>}
              </div>
              {editingProduct && <div className="info-strip">Tồn hiện tại: {editingProduct.stockQty}. Muốn tăng/giảm tồn hãy dùng nút “± Tồn kho”.</div>}
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setProductModalOpen(false)} disabled={productSaving}>Hủy</button><button className="primary-btn" disabled={productSaving}>{productSaving ? 'Đang lưu...' : 'Lưu sản phẩm'}</button></div>
            </form>
          </div>
        </div>
      )}

      {stockProduct && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !stockSaving) setStockProduct(null) }}>
          <div className="modal-card">
            <div className="modal-header"><div><span className="eyebrow">TỒN KHO</span><h2>{stockProduct.name}</h2></div><button className="modal-close" onClick={() => setStockProduct(null)} disabled={stockSaving}>×</button></div>
            <form onSubmit={submitStock}>
              <div className="info-strip">Tồn hiện tại: <strong>{stockProduct.stockQty} {stockProduct.unit ?? 'sản phẩm'}</strong>. Nhập số dương để nhập thêm, số âm để giảm kho.</div>
              <div className="form-grid">
                <label className="form-field"><span>Điều chỉnh *</span><input required type="number" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="Ví dụ: 20 hoặc -2" /></label>
                <label className="form-field"><span>Lý do *</span><input required value={stockReason} onChange={(event) => setStockReason(event.target.value)} placeholder="Nhập hàng / kiểm kê / hỏng..." /></label>
              </div>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setStockProduct(null)} disabled={stockSaving}>Hủy</button><button className="primary-btn" disabled={stockSaving}>{stockSaving ? 'Đang cập nhật...' : 'Cập nhật tồn'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function ReportsPage({ branches }: { branches: Branch[] }) {
  type ReportTab = 'overview' | 'attendance' | 'debts' | 'finance' | 'risks'

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const toInputDate = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  }

  const [tab, setTab] = useState<ReportTab>('overview')
  const [from, setFrom] = useState(toInputDate(monthStart))
  const [to, setTo] = useState(toInputDate(monthEnd))
  const [branchId, setBranchId] = useState('')
  const [overview, setOverview] = useState<ReportOverview | null>(null)
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null)
  const [debts, setDebts] = useState<DebtReport | null>(null)
  const [finance, setFinance] = useState<FinanceReport | null>(null)
  const [risks, setRisks] = useState<RiskReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [zaloStatus, setZaloStatus] = useState<ZaloAutomationStatus | null>(null)
  const [zaloRunning, setZaloRunning] = useState(false)
  const [zaloMessage, setZaloMessage] = useState('')

  const reportJson = async <T,>(path: string): Promise<T> => {
    const response = await authFetch(`${apiBase}${path}`)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
      throw new Error(message || `Không tải được báo cáo (${response.status})`)
    }
    return response.json()
  }

  const buildParams = (includeDates = true) => {
    const params = new URLSearchParams()
    if (includeDates) {
      if (from) params.set('from', from)
      if (to) params.set('to', to)
    }
    if (branchId) params.set('branchId', branchId)
    return params.toString()
  }

  const loadReports = async () => {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const dateParams = buildParams(true)
      const branchParams = buildParams(false)

      const [overviewData, attendanceData, debtData, financeData, riskData] = await Promise.all([
        reportJson<ReportOverview>(`/reports/overview?${dateParams}`),
        reportJson<AttendanceReport>(`/reports/attendance?${dateParams}`),
        reportJson<DebtReport>(`/reports/debts?${branchParams}`),
        reportJson<FinanceReport>(`/reports/finance?${dateParams}`),
        reportJson<RiskReportRow[]>(`/reports/risks?${branchParams}`),
      ])

      setOverview(overviewData)
      setAttendance(attendanceData)
      setDebts(debtData)
      setFinance(financeData)
      setRisks(riskData)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu báo cáo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [branchId])

  const downloadGeneratedReport = async (kind: 'excel' | 'pdf') => {
    setExporting(kind)
    setError('')

    try {
      const params = buildParams(true)
      const response = await authFetch(`${apiBase}/reports/export/${kind}?${params}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
        throw new Error(message || `Không xuất được ${kind === 'excel' ? 'Excel' : 'PDF'} (${response.status})`)
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
      const fallback = kind === 'excel'
        ? `bao-cao-karate-${from}-${to}.xlsx`
        : `bao-cao-karate-${from}-${to}.pdf`
      const filename = filenameMatch?.[1] ?? fallback

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xuất được báo cáo')
    } finally {
      setExporting(null)
    }
  }

  const loadZaloStatus = async () => {
    try {
      const response = await authFetch(`${apiBase}/zalo-automation/status`)
      if (!response.ok) return
      setZaloStatus(await response.json())
    } catch {
      setZaloStatus(null)
    }
  }

  const runZaloAutomationNow = async () => {
    setZaloRunning(true)
    setZaloMessage('')

    try {
      const response = await authFetch(`${apiBase}/zalo-automation/run-now`, {
        method: 'POST',
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.message || `Không chạy được Zalo Automation (${response.status})`)
      }

      setZaloMessage(body?.message ?? 'Đã chạy các tác vụ Zalo.')
      await loadZaloStatus()
    } catch (reason) {
      setZaloMessage(reason instanceof Error ? reason.message : 'Không chạy được Zalo Automation')
    } finally {
      setZaloRunning(false)
    }
  }

  useEffect(() => {
    void loadZaloStatus()
  }, [])

  const debtStatusText = (status: string) =>
    status === 'OVERDUE' ? 'Quá hạn' : status === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu'

  const debtStatusTone = (status: string) =>
    status === 'OVERDUE' ? 'danger' : status === 'PARTIAL' ? 'warning' : 'muted'

  return (
    <>
      <div className="panel report-toolbar">
        <div>
          <span className="eyebrow">BÁO CÁO VẬN HÀNH</span>
          <h3>Tổng hợp dữ liệu thật từ toàn hệ thống</h3>
          <p>Chuyên cần · công nợ · thu chi · bán hàng · học viên có nguy cơ nghỉ học.</p>
        </div>

        <div className="report-filter-grid">
          <label className="form-field">
            <span>Từ ngày</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>

          <label className="form-field">
            <span>Đến ngày</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <label className="form-field">
            <span>Chi nhánh</span>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-btn report-run-btn" onClick={() => void loadReports()} disabled={loading}>
            {loading ? 'Đang tổng hợp...' : 'Xem báo cáo'}
          </button>
        </div>
      </div>

      <div className="package-tabs report-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Tổng hợp</button>
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Chuyên cần</button>
        <button className={tab === 'debts' ? 'active' : ''} onClick={() => setTab('debts')}>Công nợ</button>
        <button className={tab === 'finance' ? 'active' : ''} onClick={() => setTab('finance')}>Tài chính & bán hàng</button>
        <button className={tab === 'risks' ? 'active' : ''} onClick={() => setTab('risks')}>Học viên rủi ro</button>
        <div className="report-export-actions">
          <button
            className="secondary-btn report-export-btn"
            onClick={() => void downloadGeneratedReport('excel')}
            disabled={loading || exporting !== null}
          >
            {exporting === 'excel' ? 'Đang tạo Excel...' : '↓ Xuất Excel đầy đủ'}
          </button>
          <button
            className="secondary-btn"
            onClick={() => void downloadGeneratedReport('pdf')}
            disabled={loading || exporting !== null}
          >
            {exporting === 'pdf' ? 'Đang tạo PDF...' : '↓ Tải PDF đầy đủ'}
          </button>
        </div>
      </div>

      <div className="panel zalo-automation-panel">
        <div className="zalo-automation-head">
          <div>
            <span className="eyebrow">ZALO AUTOMATION</span>
            <h3>Báo cáo & nhắc việc tự động</h3>
            <p>
              Nhắc lịch học · học phí sắp đến hạn · học phí quá hạn · đánh giá mới · báo cáo vận hành hàng ngày.
            </p>
          </div>

          <div className="zalo-automation-actions">
            <Status
              value={zaloStatus?.enabled ? 'Đang bật gửi thật' : 'Chế độ mô phỏng'}
              tone={zaloStatus?.enabled ? 'good' : 'warning'}
            />
            <button
              className="secondary-btn"
              type="button"
              disabled={zaloRunning}
              onClick={() => void runZaloAutomationNow()}
            >
              {zaloRunning ? 'Đang chạy...' : 'Chạy kiểm tra ngay'}
            </button>
          </div>
        </div>

        {zaloStatus && (
          <div className="zalo-automation-grid">
            <Detail
              label="Phụ huynh có Zalo UID"
              value={`${zaloStatus.guardianCoverage.withZaloUid} / ${zaloStatus.guardianCoverage.totalGuardians}`}
            />
            <Detail
              label="OA Access Token"
              value={zaloStatus.accessTokenConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}
            />
            <Detail
              label="Zalo quản trị viên"
              value={zaloStatus.adminUidConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}
            />
            <Detail
              label="Nhật ký gần đây"
              value={`${zaloStatus.recentLogs.length} bản ghi`}
            />
          </div>
        )}

        {zaloStatus && (
          <div className="zalo-schedule-list">
            {zaloStatus.schedules.map((item) => (
              <span key={item}>✓ {item}</span>
            ))}
          </div>
        )}

        {zaloMessage && <div className="info-strip zalo-run-message">{zaloMessage}</div>}

        {zaloStatus?.recentLogs?.length ? (
          <div className="table-wrap zalo-log-table">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Học viên</th>
                  <th>Người nhận</th>
                  <th>Trạng thái</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {zaloStatus.recentLogs.slice(0, 6).map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td className="mono">{log.templateKey ?? '—'}</td>
                    <td>{log.student ? `${log.student.code} · ${log.student.fullName}` : 'Quản trị viên'}</td>
                    <td className="mono">{log.recipient}</td>
                    <td>
                      <Status
                        value={log.providerId === 'DRY_RUN' ? 'Mô phỏng' : log.status === 'SENT' ? 'Đã gửi' : log.status === 'FAILED' ? 'Lỗi' : 'Đang chờ'}
                        tone={log.status === 'FAILED' ? 'danger' : log.status === 'SENT' ? 'good' : 'warning'}
                      />
                    </td>
                    <td className="zalo-log-content">{log.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="info-strip">Đang tổng hợp dữ liệu báo cáo...</div>}

      {!loading && tab === 'overview' && overview && (
        <>
          <div className="stat-grid">
            <Stat label="Học viên đang học" value={String(overview.metrics.activeStudents)} note={`${overview.metrics.newStudents} học viên mới trong kỳ`} icon="人" />
            <Stat label="Tỷ lệ đi học" value={`${overview.metrics.attendanceRate}%`} note={`${overview.metrics.attendanceRecords} lượt điểm danh`} icon="✓" />
            <Stat label="Tổng thu" value={money.format(overview.metrics.income)} note={`Chi ${money.format(overview.metrics.expense)}`} icon="↗" />
            <Stat label="Công nợ học phí" value={money.format(overview.metrics.tuitionDebt)} note="Hóa đơn chưa thanh toán đủ" icon="₫" warning={overview.metrics.tuitionDebt > 0} />
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-title"><div><span className="eyebrow">VẬN HÀNH</span><h3>Quy mô trong kỳ</h3></div></div>
              <div className="report-detail-grid">
                <Detail label="Lớp hoạt động" value={String(overview.metrics.activeClasses)} />
                <Detail label="Học viên mới" value={String(overview.metrics.newStudents)} />
                <Detail label="Học viên rủi ro" value={String(overview.metrics.riskyStudents)} />
                <Detail label="Lượt điểm danh" value={String(overview.metrics.attendanceRecords)} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-title"><div><span className="eyebrow">TÀI CHÍNH</span><h3>Kết quả trong kỳ</h3></div></div>
              <div className="report-detail-grid">
                <Detail label="Dòng tiền ròng" value={money.format(overview.metrics.balance)} />
                <Detail label="Doanh số bán hàng" value={money.format(overview.metrics.salesRevenue)} />
                <Detail label="Số đơn bán hàng" value={String(overview.metrics.salesCount)} />
                <Detail label="Công nợ hiện tại" value={money.format(overview.metrics.tuitionDebt)} />
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'attendance' && attendance && (
        <>
          <div className="stat-grid">
            <Stat label="Tỷ lệ chuyên cần" value={`${attendance.summary.rate}%`} note={`${attendance.summary.total} lượt điểm danh`} icon="✓" />
            <Stat label="Có mặt" value={String(attendance.summary.present)} note="Gồm đúng giờ, trễ và học bù" icon="人" />
            <Stat label="Vắng" value={String(attendance.summary.absent)} note="Trạng thái ABSENT" icon="!" warning={attendance.summary.absent > 0} />
            <Stat label="Đi trễ" value={String(attendance.summary.late)} note={`${attendance.summary.excused} lượt có phép`} icon="◷" warning={attendance.summary.late > 0} />
          </div>

          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">THEO LỚP</span><h3>Tỷ lệ đi học</h3></div></div>
            {attendance.classes.map((item) => (
              <div className="report-progress-item" key={item.classId}>
                <Progress label={`${item.classCode} · ${item.className}`} value={item.rate} />
                <div className="report-progress-meta">
                  {item.branchName} · {item.sessions} buổi · {item.present}/{item.total} lượt có mặt
                </div>
              </div>
            ))}
            {attendance.classes.length === 0 && <div className="info-strip">Chưa có dữ liệu điểm danh trong khoảng thời gian đã chọn.</div>}
          </div>

          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">THEO HỌC VIÊN</span><h3>Chi tiết chuyên cần</h3></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mã</th><th>Học viên</th><th>Chi nhánh</th><th>Có mặt</th><th>Vắng</th><th>Trễ</th><th>Có phép</th><th>Tỷ lệ</th></tr></thead>
                <tbody>
                  {attendance.students.map((item) => (
                    <tr key={item.studentId}>
                      <td className="mono">{item.code}</td>
                      <td><strong>{item.fullName}</strong></td>
                      <td>{item.branchName}</td>
                      <td>{item.present}/{item.total}</td>
                      <td className={item.absent > 0 ? 'debt' : ''}>{item.absent}</td>
                      <td>{item.late}</td>
                      <td>{item.excused}</td>
                      <td><Status value={`${item.rate}%`} tone={item.rate >= 80 ? 'good' : item.rate >= 60 ? 'warning' : 'danger'} /></td>
                    </tr>
                  ))}
                  {attendance.students.length === 0 && <tr><td colSpan={8}>Chưa có dữ liệu chuyên cần.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'debts' && debts && (
        <>
          <div className="stat-grid">
            <Stat label="Tổng công nợ" value={money.format(debts.totalDebt)} note={`${debts.rows.length} hóa đơn còn nợ`} icon="₫" warning={debts.totalDebt > 0} />
            <Stat label="Nợ quá hạn" value={money.format(debts.overdueDebt)} note={`${debts.overdueCount} hóa đơn quá hạn`} icon="!" warning={debts.overdueDebt > 0} />
          </div>

          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">CÔNG NỢ HỌC PHÍ</span><h3>Hóa đơn chưa thanh toán đủ</h3></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Hóa đơn</th><th>Học viên</th><th>Chi nhánh</th><th>Gói học</th><th>Hạn thu</th><th>Phải thu</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {debts.rows.map((item) => (
                    <tr key={item.id}>
                      <td className="mono">{item.invoiceNo}</td>
                      <td><strong>{item.studentName}</strong><br/><span className="subtle">{item.studentCode}</span></td>
                      <td>{item.branchName}</td>
                      <td>{item.packageName}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>{money.format(item.total)}</td>
                      <td>{money.format(item.paidAmount)}</td>
                      <td className="debt">{money.format(item.remaining)}</td>
                      <td><Status value={debtStatusText(item.status)} tone={debtStatusTone(item.status)} /></td>
                    </tr>
                  ))}
                  {debts.rows.length === 0 && <tr><td colSpan={9}>Không có công nợ học phí.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'finance' && finance && (
        <>
          <div className="stat-grid">
            <Stat label="Tổng thu" value={money.format(finance.summary.income)} note="Theo sổ thu chi" icon="↗" />
            <Stat label="Tổng chi" value={money.format(finance.summary.expense)} note="Theo sổ thu chi" icon="↘" warning={finance.summary.expense > 0} />
            <Stat label="Dòng tiền ròng" value={money.format(finance.summary.balance)} note="Thu - chi" icon="=" warning={finance.summary.balance < 0} />
            <Stat label="Doanh số bán hàng" value={money.format(finance.summary.salesRevenue)} note={`${finance.summary.salesCount} đơn hoàn tất`} icon="□" />
          </div>

          <div className="two-col">
            <div className="panel">
              <div className="panel-title"><div><span className="eyebrow">THU CHI</span><h3>Theo danh mục</h3></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Loại</th><th>Danh mục</th><th>Số giao dịch</th><th>Số tiền</th></tr></thead>
                  <tbody>
                    {finance.categories.map((item) => (
                      <tr key={`${item.type}-${item.category}`}>
                        <td><Status value={item.type === 'INCOME' ? 'Thu' : 'Chi'} tone={item.type === 'INCOME' ? 'good' : 'danger'} /></td>
                        <td>{item.category}</td>
                        <td>{item.count}</td>
                        <td className={item.type === 'INCOME' ? 'positive' : 'negative'}><strong>{money.format(item.amount)}</strong></td>
                      </tr>
                    ))}
                    {finance.categories.length === 0 && <tr><td colSpan={4}>Chưa có giao dịch trong kỳ.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title"><div><span className="eyebrow">BÁN HÀNG</span><h3>Sản phẩm bán chạy</h3></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>SKU</th><th>Sản phẩm</th><th>SL bán</th><th>Doanh số</th></tr></thead>
                  <tbody>
                    {finance.products.map((item) => (
                      <tr key={item.productId}>
                        <td className="mono">{item.sku}</td>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.quantity}</td>
                        <td>{money.format(item.revenue)}</td>
                      </tr>
                    ))}
                    {finance.products.length === 0 && <tr><td colSpan={4}>Chưa có sản phẩm bán trong kỳ.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">DÒNG TIỀN</span><h3>Theo ngày</h3></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ngày</th><th>Thu</th><th>Chi</th><th>Ròng</th></tr></thead>
                <tbody>
                  {finance.daily.map((item) => (
                    <tr key={item.date}>
                      <td>{formatDate(item.date)}</td>
                      <td className="positive">{money.format(item.income)}</td>
                      <td className="negative">{money.format(item.expense)}</td>
                      <td className={item.income - item.expense < 0 ? 'negative' : item.income - item.expense > 0 ? 'positive' : ''}><strong>{money.format(item.income - item.expense)}</strong></td>
                    </tr>
                  ))}
                  {finance.daily.length === 0 && <tr><td colSpan={4}>Chưa có dòng tiền trong kỳ.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'risks' && (
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">RỦI RO NGHỈ HỌC</span><h3>{risks.length} học viên cần theo dõi</h3></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mã</th><th>Học viên</th><th>Chi nhánh</th><th>Cấp đai</th><th>SĐT</th><th>Nghỉ liên tiếp</th><th>Mức cảnh báo</th></tr></thead>
              <tbody>
                {risks.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.code}</td>
                    <td><strong>{item.fullName}</strong></td>
                    <td>{item.branchName}</td>
                    <td>{item.beltLevel ?? 'Chưa có đai'}</td>
                    <td>{item.phone ?? '—'}</td>
                    <td><strong>{item.consecutiveAbsences} buổi</strong></td>
                    <td><Status value={item.consecutiveAbsences >= 4 ? 'Cao' : item.consecutiveAbsences >= 3 ? 'Cần liên hệ' : 'Theo dõi'} tone={item.consecutiveAbsences >= 4 ? 'danger' : 'warning'} /></td>
                  </tr>
                ))}
                {risks.length === 0 && <tr><td colSpan={7}>Không có học viên nghỉ từ 2 buổi liên tiếp.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function StaffPage({
  currentUser,
  onWarningCountChange,
}: {
  currentUser: AuthUser
  onWarningCountChange: (count: number) => void
}) {
  type StaffTab = 'people' | 'classes' | 'time' | 'tasks'

  const roleCodes = currentUser.roles.map((role) => role.code)
  const isTeacherReadOnly = roleCodes.includes('TEACHER') && !roleCodes.includes('OWNER') && !roleCodes.includes('MANAGER')
  const isOwner = roleCodes.includes('OWNER')
  const canManageStaff = !isTeacherReadOnly && (isOwner || currentUser.permissions.includes('STAFF_MANAGE'))
  const canManagePayroll = !isTeacherReadOnly && (isOwner || currentUser.permissions.includes('PAYROLL_MANAGE'))

  const today = new Date()
  const localDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [tab, setTab] = useState<StaffTab>('people')
  const [overview, setOverview] = useState<StaffOverview | null>(null)
  const [people, setPeople] = useState<StaffPerson[]>([])
  const [roles, setRoles] = useState<StaffRole[]>([])
  const [classes, setClasses] = useState<StaffClassItem[]>([])
  const [timesheets, setTimesheets] = useState<StaffTimesheet[]>([])
  const [payroll, setPayroll] = useState<StaffPayrollRow[]>([])
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [from, setFrom] = useState(localDate(monthStart))
  const [to, setTo] = useState(localDate(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<StaffPerson | null>(null)
  const [personForm, setPersonForm] = useState<StaffPersonForm>(emptyStaffPersonForm)
  const [personAvatarDataUrl, setPersonAvatarDataUrl] = useState<string | null>(null)
  const [personRemoveAvatar, setPersonRemoveAvatar] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)

  const [timesheetModalOpen, setTimesheetModalOpen] = useState(false)
  const [editingTimesheet, setEditingTimesheet] = useState<StaffTimesheet | null>(null)
  const [timesheetTeacherId, setTimesheetTeacherId] = useState('')
  const [timesheetDate, setTimesheetDate] = useState(localDate(today))
  const [timesheetMinutes, setTimesheetMinutes] = useState('')
  const [timesheetSessions, setTimesheetSessions] = useState('1')
  const [timesheetAmount, setTimesheetAmount] = useState('')
  const [timesheetNote, setTimesheetNote] = useState('')

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskOwnerId, setTaskOwnerId] = useState('')
  const [taskDueAt, setTaskDueAt] = useState('')
  const [taskPriority, setTaskPriority] = useState('2')

  const apiJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await authFetch(`${apiBase}${path}`, options)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
      throw new Error(msg || `API error (${response.status})`)
    }
    return response.json()
  }

  const loadCore = async () => {
    const [overviewData, peopleData, roleData, classData, taskData] = await Promise.all([
      apiJson<StaffOverview>('/staff/overview'),
      apiJson<StaffPerson[]>('/staff/people'),
      apiJson<StaffRole[]>('/staff/roles'),
      apiJson<StaffClassItem[]>('/staff/classes'),
      apiJson<StaffTask[]>('/staff/tasks'),
    ])

    setOverview(overviewData)
    setPeople(peopleData)
    setRoles(roleData)
    setClasses(classData)
    setTasks(taskData)
    onWarningCountChange(
      Number(overviewData.overdueTasks ?? 0) +
      Number(overviewData.unassignedClasses ?? 0),
    )
  }

  const loadTimeData = async (nextFrom = from, nextTo = to) => {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo })
    const [timeData, payrollData] = await Promise.all([
      apiJson<StaffTimesheet[]>(`/staff/timesheets?${params.toString()}`),
      apiJson<StaffPayrollRow[]>(`/staff/payroll?${params.toString()}`),
    ])
    setTimesheets(timeData)
    setPayroll(payrollData)
  }

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadCore(), loadTimeData()])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu nhân sự')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const activeTeachers = people.filter(
    (item) =>
      item.status === 'ACTIVE' &&
      Boolean(item.teacher) &&
      item.teacher?.active !== false,
  )
  // Cho phép quản lý nhìn thấy cả hồ sơ Teacher cũ đang bị active=false.
  // Khi thực sự phân lớp, backend sẽ kích hoạt lại Teacher đó.
  const assignableTeachers = people.filter(
    (item) => item.status === 'ACTIVE' && Boolean(item.teacher),
  )
  const activePeople = people.filter((item) => item.status === 'ACTIVE')

  const bootstrapRoles = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const roleData = await apiJson<StaffRole[]>('/staff/roles/bootstrap', { method: 'POST' })
      setRoles(roleData)
      setMessage('Đã tạo các vai trò mặc định cho võ đường.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được vai trò mặc định')
    } finally {
      setSaving(false)
    }
  }

  const openCreatePerson = () => {
    setEditingPerson(null)
    setPersonForm(emptyStaffPersonForm)
    setUsernameTouched(false)
    setError('')
    setPersonModalOpen(true)
  }

  const openEditPerson = (person: StaffPerson) => {
    setEditingPerson(person)
    setUsernameTouched(true)
    setPersonForm({
      username: person.username,
      fullName: person.fullName,
      phone: person.phone ?? '',
      email: person.email ?? '',
      status: person.status,
      roleId: person.roles[0]?.id ?? '',
      isTeacher: Boolean(person.teacher),
      employeeCode: person.teacher?.employeeCode ?? '',
      payPerSession: person.teacher?.payPerSession ? String(person.teacher.payPerSession) : '',
      payPerHour: person.teacher?.payPerHour ? String(person.teacher.payPerHour) : '',
    })
    setPersonAvatarDataUrl(null)
    setPersonRemoveAvatar(false)
    setError('')
    setPersonModalOpen(true)
  }

  const prepareStaffAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Ảnh gốc không được vượt quá 5 MB.')
    }

    const sourceUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
        const img = new Image()
        img.onload = () => resolveImage(img)
        img.onerror = () => rejectImage(new Error('Không đọc được file ảnh.'))
        img.src = sourceUrl
      })

      const maxSide = 512
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * ratio))
      const height = Math.max(1, Math.round(image.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Không xử lý được ảnh trên trình duyệt.')
      context.drawImage(image, 0, 0, width, height)

      let quality = 0.82
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      const approxBytes = (value: string) => Math.ceil((value.length * 3) / 4)
      while (approxBytes(dataUrl) > 85 * 1024 && quality > 0.48) {
        quality -= 0.08
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      return dataUrl
    } finally {
      URL.revokeObjectURL(sourceUrl)
    }
  }

  const choosePersonAvatar = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      const dataUrl = await prepareStaffAvatar(file)
      setPersonAvatarDataUrl(dataUrl)
      setPersonRemoveAvatar(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xử lý được ảnh đại diện')
    }
  }

  const deletePerson = async (person: StaffPerson) => {
    const confirmed = window.confirm(
      `Xóa nhân sự ${person.fullName}?\n\nNếu nhân sự đã có lịch sử giảng dạy/chấm công, hệ thống sẽ không cho xóa để bảo toàn dữ liệu.`,
    )
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiJson(`/staff/people/${person.id}`, { method: 'DELETE' })
      setMessage(`Đã xóa nhân sự ${person.fullName}.`)
      await Promise.all([loadCore(), loadTimeData()])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xóa được nhân sự')
    } finally {
      setSaving(false)
    }
  }

  const savePerson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Đọc trực tiếp từ DOM của chính form nhân sự. Cách này tránh trường hợp
    // trình duyệt/autofill hiển thị giá trị nhưng React state chưa đồng bộ.
    const form = event.currentTarget
    const usernameInput = form.elements.namedItem('staffUsername') as HTMLInputElement | null
    const fullNameInput = form.elements.namedItem('staffFullName') as HTMLInputElement | null

    const username = (usernameInput?.value ?? personForm.username ?? '').trim()
    const fullName = (fullNameInput?.value ?? personForm.fullName ?? '').trim()

    if (!fullName) {
      setError('Vui lòng nhập họ và tên nhân sự.')
      fullNameInput?.focus()
      return
    }

    if (!username) {
      setError('Tên đăng nhập chưa được điền. Hãy nhập lại họ tên hoặc nhập tên đăng nhập.')
      usernameInput?.focus()
      return
    }

    // Username được tự ĐIỀN ở giao diện từ họ tên, nhưng vẫn hiển thị để
    // quản trị viên kiểm tra/chỉnh sửa. Backend không tự sinh username ngầm.
    setPersonForm((current) => ({ ...current, username, fullName }))

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        ...(username && { username }),
        fullName,
        name: fullName,
        phone: personForm.phone.trim() || null,
        email: personForm.email.trim() || null,
        status: personForm.status,
        roleIds: personForm.roleId ? [personForm.roleId] : [],
        isTeacher: personForm.isTeacher,
        // Mã giáo viên do backend tự sinh (GV001, GV002, ...).
        payPerSession: personForm.payPerSession === '' ? null : Number(personForm.payPerSession),
        payPerHour: personForm.payPerHour === '' ? null : Number(personForm.payPerHour),
      }

      const savedPerson = await apiJson<StaffPerson>(
        editingPerson ? `/staff/people/${editingPerson.id}` : '/staff/people',
        {
          method: editingPerson ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        },
      )

      let avatarWarning = ''
      try {
        if (personAvatarDataUrl) {
          await apiJson<StaffPerson>(`/staff/people/${savedPerson.id}/avatar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ dataUrl: personAvatarDataUrl }),
          })
        } else if (editingPerson && personRemoveAvatar && editingPerson.avatarUrl) {
          await apiJson<StaffPerson>(`/staff/people/${savedPerson.id}/avatar`, {
            method: 'DELETE',
          })
        }
      } catch (avatarReason) {
        avatarWarning = avatarReason instanceof Error
          ? ` Tuy nhiên ảnh đại diện chưa lưu được: ${avatarReason.message}`
          : ' Tuy nhiên ảnh đại diện chưa lưu được.'
      }

      setPersonModalOpen(false)
      setEditingPerson(null)
      setPersonForm(emptyStaffPersonForm)
      setPersonAvatarDataUrl(null)
      setPersonRemoveAvatar(false)
      setMessage(`${editingPerson ? 'Đã cập nhật nhân sự.' : 'Đã tạo nhân sự mới.'}${avatarWarning}`)
      await loadCore()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được nhân sự')
    } finally {
      setSaving(false)
    }
  }

  const assignTeacher = async (classId: string, teacherId: string) => {
    setError('')
    setMessage('')
    try {
      const updatedClasses = await apiJson<StaffClassItem[]>(
        `/staff/classes/${classId}/teacher`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ teacherId: teacherId || null }),
        },
      )

      // Dùng luôn dữ liệu backend vừa trả về để select không bị quay lại
      // "Chưa phân giáo viên" vì state cũ.
      setClasses(updatedClasses)

      const changed = updatedClasses.find((item) => item.id === classId)
      setMessage(
        changed?.teacherName
          ? `Đã phân công ${changed.teacherName} phụ trách lớp ${changed.code}.`
          : 'Đã bỏ phân công giáo viên khỏi lớp.',
      )

      const overviewData = await apiJson<StaffOverview>('/staff/overview')
      setOverview(overviewData)
      onWarningCountChange(
        Number(overviewData.overdueTasks ?? 0) +
        Number(overviewData.unassignedClasses ?? 0),
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không phân được giáo viên')
    }
  }

  const openCreateTimesheet = () => {
    setEditingTimesheet(null)
    setTimesheetTeacherId(activeTeachers[0]?.teacher?.id ?? '')
    setTimesheetDate(localDate(new Date()))
    setTimesheetMinutes('')
    setTimesheetSessions('1')
    setTimesheetAmount('')
    setTimesheetNote('')
    setError('')
    setTimesheetModalOpen(true)
  }

  const openEditTimesheet = (item: StaffTimesheet) => {
    setEditingTimesheet(item)
    setTimesheetTeacherId(item.teacherId)
    setTimesheetDate(item.workDate.slice(0, 10))
    setTimesheetMinutes(String(item.minutes))
    setTimesheetSessions(String(item.sessionCount))
    setTimesheetAmount(String(item.amount))
    setTimesheetNote(item.note ?? '')
    setError('')
    setTimesheetModalOpen(true)
  }

  const saveTimesheet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!timesheetTeacherId || !timesheetDate) {
      setError('Vui lòng chọn giáo viên và ngày làm việc.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        teacherId: timesheetTeacherId,
        workDate: `${timesheetDate}T12:00:00+07:00`,
        minutes: Number(timesheetMinutes || 0),
        sessionCount: Number(timesheetSessions || 0),
        amount: timesheetAmount === '' ? undefined : Number(timesheetAmount),
        note: timesheetNote.trim() || null,
      }

      await apiJson(
        editingTimesheet ? `/staff/timesheets/${editingTimesheet.id}` : '/staff/timesheets',
        {
          method: editingTimesheet ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        },
      )

      setTimesheetModalOpen(false)
      setEditingTimesheet(null)
      setMessage('Đã lưu chấm công.')
      await Promise.all([loadTimeData(), loadCore()])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được chấm công')
    } finally {
      setSaving(false)
    }
  }

  const syncTimesheets = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const params = new URLSearchParams({ from, to })
      const result = await apiJson<{ created: number; skipped: number; totalSessions: number }>(
        `/staff/timesheets/sync?${params.toString()}`,
        { method: 'POST' },
      )
      setMessage(
        `Đồng bộ xong: tạo ${result.created} bản công, bỏ qua ${result.skipped} buổi đã có công/không hợp lệ.`,
      )
      await Promise.all([loadTimeData(), loadCore()])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không đồng bộ được chấm công')
    } finally {
      setSaving(false)
    }
  }

  const applyTimeFilter = async () => {
    setLoading(true)
    setError('')
    try {
      await loadTimeData(from, to)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được chấm công')
    } finally {
      setLoading(false)
    }
  }

  const openCreateTask = () => {
    setTaskTitle('')
    setTaskDescription('')
    setTaskOwnerId(activePeople[0]?.id ?? '')
    setTaskDueAt('')
    setTaskPriority('2')
    setError('')
    setTaskModalOpen(true)
  }

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const titleInput = event.currentTarget.elements.namedItem('taskTitle') as HTMLInputElement | null
    const title = (titleInput?.value ?? taskTitle).trim()
    if (!title) {
      setError('Vui lòng nhập tên công việc.')
      titleInput?.focus()
      return
    }

    setTaskTitle(title)
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await apiJson('/staff/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          title,
          description: taskDescription.trim() || undefined,
          ownerId: taskOwnerId || undefined,
          dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
          priority: Number(taskPriority),
        }),
      })
      setTaskModalOpen(false)
      setMessage('Đã giao công việc.')
      await loadCore()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được công việc')
    } finally {
      setSaving(false)
    }
  }

  const updateTaskStatus = async (task: StaffTask, status: StaffTask['status']) => {
    setError('')
    setMessage('')
    try {
      await apiJson(`/staff/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ status }),
      })
      setMessage('Đã cập nhật trạng thái công việc.')
      await loadCore()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được công việc')
    }
  }

  const userStatusText = (status: StaffPerson['status']) => ({
    ACTIVE: 'Đang hoạt động',
    INACTIVE: 'Ngừng hoạt động',
    LOCKED: 'Đã khóa',
  }[status])

  const taskStatusText = (status: StaffTask['status']) => ({
    TODO: 'Cần làm',
    IN_PROGRESS: 'Đang làm',
    DONE: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  }[status])

  const taskTone = (task: StaffTask) =>
    task.overdue ? 'danger' :
    task.status === 'DONE' ? 'good' :
    task.status === 'IN_PROGRESS' ? 'warning' :
    task.status === 'CANCELLED' ? 'muted' : 'muted'

  return (
    <>
      <div className="stat-grid staff-stat-grid">
        <Stat
          label="Nhân sự hoạt động"
          value={String(overview?.activePeople ?? 0)}
          note={`${overview?.activeTeachers ?? 0} giáo viên đang hoạt động`}
          icon="人"
        />
        <Stat
          label="Lớp chưa có giáo viên"
          value={String(overview?.unassignedClasses ?? 0)}
          note={`${overview?.activeClasses ?? 0} lớp đang hoạt động`}
          icon="!"
          warning={(overview?.unassignedClasses ?? 0) > 0}
        />
        <Stat
          label={isTeacherReadOnly ? "Lương của tôi tháng này" : "Lương dự kiến tháng"}
          value={money.format(overview?.monthPayroll ?? 0)}
          note={`${overview?.monthSessionCount ?? 0} buổi · ${Math.round((overview?.monthMinutes ?? 0) / 60)} giờ`}
          icon="₫"
        />
        <Stat
          label="Công việc cần xử lý"
          value={String(overview?.openTasks ?? 0)}
          note={`${overview?.overdueTasks ?? 0} việc đã trễ hạn`}
          icon="☑"
          warning={(overview?.overdueTasks ?? 0) > 0}
        />
      </div>

      <div className="staff-tabs">
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>Hồ sơ nhân sự</button>
        <button className={tab === 'classes' ? 'active' : ''} onClick={() => setTab('classes')}>
          Phân lớp giáo viên
          {(overview?.unassignedClasses ?? 0) > 0 && <span>{overview?.unassignedClasses}</span>}
        </button>
        <button className={tab === 'time' ? 'active' : ''} onClick={() => setTab('time')}>Chấm công & lương</button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
          Giao việc
          {(overview?.overdueTasks ?? 0) > 0 && <span>{overview?.overdueTasks}</span>}
        </button>
      </div>

      {isTeacherReadOnly && (
        <div className="info-strip staff-info-strip">
          Tài khoản Giáo viên đang ở chế độ <strong>chỉ xem</strong> trong Nhân sự & giáo viên. Phần Chấm công & lương chỉ hiển thị dữ liệu của chính bạn.
        </div>
      )}

      {error && <div className="form-error staff-page-message">{error}</div>}
      {message && <div className="attendance-success staff-page-message">{message}</div>}
      {loading && <div className="info-strip">Đang tải dữ liệu nhân sự...</div>}

      {!loading && tab === 'people' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">HỒ SƠ NHÂN SỰ & GIÁO VIÊN</span>
              <h3>{people.length} tài khoản nhân sự</h3>
            </div>
            {canManageStaff && <button className="primary-btn" onClick={openCreatePerson}>+ Thêm nhân sự</button>}
          </div>

          {roles.length === 0 && canManageStaff && (
            <div className="form-warning staff-role-warning">
              <span>Chưa có vai trò trong cơ sở dữ liệu. Bạn vẫn có thể tạo nhân sự, hoặc tạo nhanh bộ vai trò mặc định.</span>
              <button className="secondary-btn" type="button" disabled={saving} onClick={() => void bootstrapRoles()}>Tạo vai trò mặc định</button>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ảnh</th>
                  <th>Mã</th>
                  <th>Họ tên</th>
                  <th>Tài khoản / Liên hệ</th>
                  <th>Vai trò</th>
                  <th>Lớp phụ trách</th>
                  {canManageStaff && <th>Mức lương</th>}
                  <th>Trạng thái</th>
                  {canManageStaff && <th></th>}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="staff-avatar staff-avatar-small">
                        {person.avatarUrl
                          ? <img src={apiAssetUrl(person.avatarUrl)} alt={person.fullName} />
                          : <span>{person.fullName.trim().charAt(0).toUpperCase() || '?'}</span>}
                      </div>
                    </td>
                    <td className="mono">{person.teacher?.employeeCode ?? '—'}</td>
                    <td>
                      <strong>{person.fullName}</strong>
                      {person.teacher && <><br/><span className="subtle">Giáo viên</span></>}
                    </td>
                    <td>
                      <strong>{person.username}</strong><br/>
                      <span className="subtle">{person.phone || person.email || 'Chưa có liên hệ'}</span>
                    </td>
                    <td>{person.roles.length > 0 ? person.roles.map((role) => role.name).join(', ') : 'Chưa phân vai trò'}</td>
                    <td>
                      {person.teacher?.classes.length
                        ? person.teacher.classes.map((item) => `${item.code} · ${item.name}`).join(', ')
                        : '—'}
                    </td>
                    {canManageStaff && (
                      <td>
                        {person.teacher
                          ? person.teacher.payPerSession > 0
                            ? `${money.format(person.teacher.payPerSession)} / buổi`
                            : person.teacher.payPerHour > 0
                              ? `${money.format(person.teacher.payPerHour)} / giờ`
                              : 'Chưa đặt mức lương'
                          : '—'}
                      </td>
                    )}
                    <td>
                      <Status
                        value={userStatusText(person.status)}
                        tone={person.status === 'ACTIVE' ? 'good' : person.status === 'LOCKED' ? 'danger' : 'muted'}
                      />
                    </td>
                    {canManageStaff && (
                      <td>
                        <div className="staff-row-actions">
                          <button className="tiny-btn" onClick={() => openEditPerson(person)}>Sửa</button>
                          <button className="danger-link" disabled={saving} onClick={() => void deletePerson(person)}>Xóa</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {people.length === 0 && <tr><td colSpan={canManageStaff ? 9 : 7}>Chưa có hồ sơ nhân sự.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'classes' && (
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">PHÂN CÔNG GIẢNG DẠY</span>
              <h3>Gán giáo viên phụ trách từng lớp</h3>
            </div>
            <button className="secondary-btn" onClick={() => void loadCore()}>Làm mới</button>
          </div>

          <div className="info-strip staff-info-strip">
            {canManageStaff
              ? 'Việc gán giáo viên tại đây sẽ cập nhật trực tiếp vào lớp học. Các buổi học tạo sau đó có thể dùng giáo viên phụ trách để tự động chấm công.'
              : 'Bạn chỉ có quyền xem phân công giáo viên hiện tại. Việc thay đổi giáo viên phụ trách do Quản lý hoặc Chủ võ đường thực hiện.'}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Lớp</th><th>Chi nhánh</th><th>Lịch học</th><th>Học viên</th><th>Giáo viên phụ trách</th></tr></thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id} className={!item.teacherId ? 'staff-row-warning' : ''}>
                    <td><strong>{item.code} · {item.name}</strong></td>
                    <td>{item.branchName}</td>
                    <td>{item.scheduleText ?? 'Chưa có lịch'}</td>
                    <td>{item.enrollmentCount}</td>
                    <td>
                      {canManageStaff ? (
                        <select
                          className="staff-inline-select"
                          value={item.teacherId ?? ''}
                          onChange={(event) => void assignTeacher(item.id, event.target.value)}
                        >
                          <option value="">Chưa phân giáo viên</option>
                          {assignableTeachers.map((person) => (
                            <option key={person.teacher!.id} value={person.teacher!.id}>
                              {person.teacher!.employeeCode} · {person.fullName}
                              {person.teacher!.active === false ? ' · sẽ kích hoạt lại' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong className={!item.teacherId ? 'debt' : ''}>{item.teacherName ?? 'Chưa phân giáo viên'}</strong>
                      )}
                    </td>
                  </tr>
                ))}
                {classes.length === 0 && <tr><td colSpan={5}>Chưa có lớp đang hoạt động.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'time' && (
        <>
          <div className="panel staff-time-toolbar">
            <div className="staff-time-filter">
              <label className="form-field"><span>Từ ngày</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label className="form-field"><span>Đến ngày</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <button className="secondary-btn" onClick={() => void applyTimeFilter()}>Xem</button>
            </div>
            {canManagePayroll && (
              <div className="button-row">
                <button className="secondary-btn" onClick={() => void syncTimesheets()} disabled={saving}>↻ Đồng bộ từ buổi dạy</button>
                <button className="primary-btn" onClick={openCreateTimesheet}>+ Ghi công thủ công</button>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">
              <div><span className="eyebrow">{isTeacherReadOnly ? 'LƯƠNG CỦA TÔI' : 'BẢNG LƯƠNG TẠM TÍNH'}</span><h3>{formatDate(from)} → {formatDate(to)}</h3></div>
              <strong className="staff-payroll-total">{money.format(payroll.reduce((sum, item) => sum + item.amount, 0))}</strong>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mã GV</th><th>Giáo viên</th><th>Số buổi</th><th>Số giờ</th><th>Mức áp dụng</th><th>Lương tạm tính</th></tr></thead>
                <tbody>
                  {payroll.map((item) => (
                    <tr key={item.teacherId}>
                      <td className="mono">{item.employeeCode}</td>
                      <td><strong>{item.fullName}</strong></td>
                      <td>{item.sessionCount}</td>
                      <td>{(item.minutes / 60).toFixed(1)}</td>
                      <td>{item.payPerSession > 0 ? `${money.format(item.payPerSession)} / buổi` : item.payPerHour > 0 ? `${money.format(item.payPerHour)} / giờ` : 'Chưa cấu hình'}</td>
                      <td><strong>{money.format(item.amount)}</strong></td>
                    </tr>
                  ))}
                  {payroll.length === 0 && <tr><td colSpan={6}>Chưa có dữ liệu lương trong kỳ.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">CHI TIẾT CHẤM CÔNG</span><h3>{timesheets.length} bản ghi</h3></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ngày</th><th>Giáo viên</th><th>Nguồn</th><th>Phút</th><th>Buổi</th><th>Thành tiền</th><th>Ghi chú</th>{canManagePayroll && <th></th>}</tr></thead>
                <tbody>
                  {timesheets.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.workDate)}</td>
                      <td><strong>{item.teacherName}</strong><br/><span className="subtle">{item.employeeCode}</span></td>
                      <td>{item.session ? `${item.session.classCode} · ${item.session.className}` : 'Chấm công thủ công'}</td>
                      <td>{item.minutes}</td>
                      <td>{item.sessionCount}</td>
                      <td><strong>{money.format(item.amount)}</strong></td>
                      <td>{item.note ?? '—'}</td>
                      {canManagePayroll && <td><button className="tiny-btn" onClick={() => openEditTimesheet(item)}>Sửa</button></td>}
                    </tr>
                  ))}
                  {timesheets.length === 0 && <tr><td colSpan={canManagePayroll ? 8 : 7}>Chưa có dữ liệu chấm công trong khoảng thời gian này.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'tasks' && (
        <div className="panel">
          <div className="panel-title">
            <div><span className="eyebrow">GIAO VIỆC NHÂN SỰ</span><h3>{tasks.filter((item) => !['DONE', 'CANCELLED'].includes(item.status)).length} công việc đang mở</h3></div>
            {canManageStaff && <button className="primary-btn" onClick={openCreateTask}>+ Giao việc</button>}
          </div>

          <div className="staff-task-list">
            {tasks.map((task) => (
              <article className={`staff-task-card ${task.overdue ? 'overdue' : ''}`} key={task.id}>
                <div className="staff-task-main">
                  <div className="staff-task-title-row">
                    <Status value={taskStatusText(task.status)} tone={taskTone(task)} />
                    <span className={`staff-priority priority-${task.priority}`}>
                      {task.priority === 1 ? 'Ưu tiên cao' : task.priority === 2 ? 'Trung bình' : 'Thấp'}
                    </span>
                  </div>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <div className="staff-task-meta">
                    <span>Người phụ trách: <strong>{task.ownerName ?? 'Chưa giao'}</strong></span>
                    <span>Deadline: <strong className={task.overdue ? 'debt' : ''}>{task.dueAt ? formatDateTime(task.dueAt) : 'Không có'}</strong></span>
                    <span>Người tạo: {task.creatorName}</span>
                  </div>
                </div>
                {canManageStaff ? (
                  <select
                    className="staff-inline-select task-status-select"
                    value={task.status}
                    onChange={(event) => void updateTaskStatus(task, event.target.value as StaffTask['status'])}
                  >
                    <option value="TODO">Cần làm</option>
                    <option value="IN_PROGRESS">Đang làm</option>
                    <option value="DONE">Hoàn thành</option>
                    <option value="CANCELLED">Hủy</option>
                  </select>
                ) : (
                  <Status value={taskStatusText(task.status)} tone={taskTone(task)} />
                )}
              </article>
            ))}
            {tasks.length === 0 && <div className="info-strip">Chưa có công việc nào được giao.</div>}
          </div>
        </div>
      )}

      {canManageStaff && personModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPersonModalOpen(false) }}>
          <div className="modal-card staff-person-modal">
            <div className="modal-header">
              <div><span className="eyebrow">NHÂN SỰ</span><h2>{editingPerson ? 'Cập nhật hồ sơ' : 'Thêm nhân sự mới'}</h2></div>
              <button className="modal-close" type="button" disabled={saving} onClick={() => setPersonModalOpen(false)}>×</button>
            </div>

            <form onSubmit={savePerson}>
              <div className="staff-avatar-editor">
                <div className="staff-avatar staff-avatar-large">
                  {personAvatarDataUrl
                    ? <img src={personAvatarDataUrl} alt="Ảnh xem trước" />
                    : editingPerson?.avatarUrl && !personRemoveAvatar
                      ? <img src={apiAssetUrl(editingPerson.avatarUrl)} alt={editingPerson.fullName} />
                      : <span>{personForm.fullName.trim().charAt(0).toUpperCase() || '?'}</span>}
                </div>
                <div className="staff-avatar-controls">
                  <strong>Ảnh đại diện</strong>
                  <span>JPG/PNG/WEBP. Ảnh được tự thu nhỏ trước khi lưu.</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void choosePersonAvatar(event.target.files?.[0])}
                  />
                  {(personAvatarDataUrl || (editingPerson?.avatarUrl && !personRemoveAvatar)) && (
                    <button
                      className="danger-link"
                      type="button"
                      onClick={() => {
                        setPersonAvatarDataUrl(null)
                        setPersonRemoveAvatar(true)
                      }}
                    >
                      Xóa ảnh đại diện
                    </button>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Tên đăng nhập *</span>
                  <input
                    name="staffUsername"
                    autoComplete="off"
                    required
                    value={personForm.username}
                    onChange={(e) => {
                      setUsernameTouched(true)
                      setPersonForm((v) => ({ ...v, username: e.target.value }))
                    }}
                    placeholder="Tự điền theo họ tên, có thể chỉnh sửa"
                  />
                  <small className="field-help">Tự điền từ họ tên nhưng bạn vẫn có thể sửa trước khi lưu.</small>
                </label>
                <label className="form-field">
                  <span>Họ và tên *</span>
                  <input
                    name="staffFullName"
                    autoComplete="name"
                    required
                    value={personForm.fullName}
                    onChange={(e) => {
                      const fullName = e.target.value
                      setPersonForm((v) => ({
                        ...v,
                        fullName,
                        ...(!editingPerson && !usernameTouched
                          ? { username: usernameFromFullName(fullName) }
                          : {}),
                      }))
                    }}
                    placeholder="Nguyễn Văn A"
                  />
                </label>
                <label className="form-field"><span>Số điện thoại</span><input value={personForm.phone} onChange={(e) => setPersonForm((v) => ({ ...v, phone: e.target.value }))} /></label>
                <label className="form-field"><span>Email</span><input type="email" value={personForm.email} onChange={(e) => setPersonForm((v) => ({ ...v, email: e.target.value }))} /></label>
                <label className="form-field"><span>Vai trò</span><select value={personForm.roleId} onChange={(e) => setPersonForm((v) => ({ ...v, roleId: e.target.value }))}><option value="">Chưa phân vai trò</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                <label className="form-field"><span>Trạng thái</span><select value={personForm.status} onChange={(e) => setPersonForm((v) => ({ ...v, status: e.target.value as StaffPersonForm['status'] }))}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option><option value="LOCKED">Khóa tài khoản</option></select></label>
              </div>

              <label className="staff-teacher-toggle">
                <input type="checkbox" checked={personForm.isTeacher} onChange={(e) => setPersonForm((v) => ({ ...v, isTeacher: e.target.checked }))} />
                <div><strong>Đây là giáo viên</strong><span>Bật để quản lý mã giáo viên, phân lớp, chấm công và mức lương.</span></div>
              </label>

              {personForm.isTeacher && (
                <div className="form-grid staff-teacher-fields">
                  <label className="form-field">
                    <span>Mã giáo viên</span>
                    <input
                      value={editingPerson?.teacher?.employeeCode ?? 'Tự sinh khi lưu'}
                      readOnly
                      disabled
                    />
                    <small className="field-help">Giáo viên mới sẽ được cấp mã tự động theo dạng GV001, GV002, ...</small>
                  </label>
                  <label className="form-field"><span>Lương / buổi</span><input type="number" min="0" value={personForm.payPerSession} onChange={(e) => setPersonForm((v) => ({ ...v, payPerSession: e.target.value }))} placeholder="150000" /></label>
                  <label className="form-field"><span>Lương / giờ</span><input type="number" min="0" value={personForm.payPerHour} onChange={(e) => setPersonForm((v) => ({ ...v, payPerHour: e.target.value }))} placeholder="100000" /></label>
                  <div className="staff-pay-note">Nếu có cả hai mức, hệ thống ưu tiên <strong>lương/buổi</strong> với bản công có số buổi; lương/giờ dùng khi bản công chỉ có số phút.</div>
                </div>
              )}

              <div className="modal-actions">
                <button className="secondary-btn" type="button" onClick={() => setPersonModalOpen(false)} disabled={saving}>Hủy</button>
                <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editingPerson ? 'Lưu thay đổi' : 'Thêm nhân sự'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManagePayroll && timesheetModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTimesheetModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header">
              <div><span className="eyebrow">CHẤM CÔNG GIÁO VIÊN</span><h2>{editingTimesheet ? 'Điều chỉnh bản công' : 'Ghi công thủ công'}</h2></div>
              <button className="modal-close" type="button" onClick={() => setTimesheetModalOpen(false)} disabled={saving}>×</button>
            </div>
            <form onSubmit={saveTimesheet}>
              <div className="form-grid">
                <label className="form-field form-field-wide"><span>Giáo viên *</span><select required value={timesheetTeacherId} onChange={(e) => setTimesheetTeacherId(e.target.value)}><option value="">Chọn giáo viên</option>{activeTeachers.map((person) => <option key={person.teacher!.id} value={person.teacher!.id}>{person.teacher!.employeeCode} · {person.fullName}</option>)}</select></label>
                <label className="form-field"><span>Ngày làm việc *</span><input type="date" required value={timesheetDate} onChange={(e) => setTimesheetDate(e.target.value)} /></label>
                <label className="form-field"><span>Số buổi</span><input type="number" min="0" value={timesheetSessions} onChange={(e) => setTimesheetSessions(e.target.value)} /></label>
                <label className="form-field"><span>Số phút</span><input type="number" min="0" value={timesheetMinutes} onChange={(e) => setTimesheetMinutes(e.target.value)} /></label>
                <label className="form-field"><span>Thành tiền</span><input type="number" min="0" value={timesheetAmount} onChange={(e) => setTimesheetAmount(e.target.value)} placeholder="Để trống = tự tính" /></label>
                <label className="form-field form-field-wide"><span>Ghi chú</span><textarea rows={3} value={timesheetNote} onChange={(e) => setTimesheetNote(e.target.value)} placeholder="Dạy thay, họp chuyên môn, công việc khác..." /></label>
              </div>
              <div className="modal-actions"><button className="secondary-btn" type="button" onClick={() => setTimesheetModalOpen(false)} disabled={saving}>Hủy</button><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu chấm công'}</button></div>
            </form>
          </div>
        </div>
      )}

      {canManageStaff && taskModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTaskModalOpen(false) }}>
          <div className="modal-card">
            <div className="modal-header"><div><span className="eyebrow">GIAO VIỆC</span><h2>Tạo công việc mới</h2></div><button className="modal-close" type="button" onClick={() => setTaskModalOpen(false)} disabled={saving}>×</button></div>
            <form onSubmit={createTask}>
              <div className="form-grid">
                <label className="form-field form-field-wide"><span>Tên công việc *</span><input name="taskTitle" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ví dụ: Chuẩn bị danh sách thi lên đai" /></label>
                <label className="form-field"><span>Người phụ trách</span><select value={taskOwnerId} onChange={(e) => setTaskOwnerId(e.target.value)}><option value="">Chưa giao</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
                <label className="form-field"><span>Ưu tiên</span><select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}><option value="1">Cao</option><option value="2">Trung bình</option><option value="3">Thấp</option></select></label>
                <label className="form-field form-field-wide"><span>Deadline</span><input type="datetime-local" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} /></label>
                <label className="form-field form-field-wide"><span>Mô tả</span><textarea rows={4} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Nội dung cần thực hiện..." /></label>
              </div>
              <div className="modal-actions"><button className="secondary-btn" type="button" onClick={() => setTaskModalOpen(false)} disabled={saving}>Hủy</button><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Đang giao...' : 'Giao việc'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function SettingsPage({
  currentUser,
  onUserUpdated,
  onBrandUpdated,
  onAppearance,
}: {
  currentUser: AuthUser
  onUserUpdated: (user: AuthUser) => void
  onBrandUpdated: (brand: Partial<PublicBrand>) => void
  onAppearance: (theme: PublicBrand['defaultTheme'], accent: string) => void
}) {
  return (
    <SettingsPanel
      currentUser={currentUser}
      onUserUpdated={onUserUpdated}
      onBrandUpdated={onBrandUpdated}
      onAppearance={onAppearance}
    />
  )
}

function GuestAccessPage({ currentUser }: { currentUser: AuthUser }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">TÀI KHOẢN KHÁCH</span>
          <h3>Đăng ký thành công</h3>
        </div>
        <Status value="Khách" tone="muted" />
      </div>
      <div className="info-strip">
        Xin chào <strong>{currentUser.fullName}</strong>. Tài khoản <span className="mono">{currentUser.username}</span> hiện chưa được cấp quyền vận hành hệ thống.
      </div>
      <div className="student-detail-grid">
        <Detail label="Vai trò" value={currentUser.roles.map((role) => role.name).join(', ') || 'Khách'} />
        <Detail label="Trạng thái" value="Đang hoạt động" />
        <Detail label="Email" value={currentUser.email ?? '—'} />
        <Detail label="Quyền được cấp" value={`${currentUser.permissions.length} quyền`} />
      </div>
      <div className="info-strip">
        Hãy liên hệ Chủ võ đường hoặc người có quyền phân quyền để được chuyển sang Giáo viên, Thu ngân, Nhân viên, Quản lý hoặc vai trò phù hợp.
      </div>
    </div>
  )
}

function Stat({ label, value, note, icon, warning = false, onClick }: { label: string; value: string; note: string; icon: string; warning?: boolean; onClick?: () => void }) {
  return <div className={`stat-card ${warning ? 'warning' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}
function Alert({ tone, title, text, onClick }: { tone: string; title: string; text: string; onClick?: () => void }) {
  return <div className={`alert ${tone} ${onClick ? 'clickable' : ''}`} onClick={onClick}><span className="alert-dot"></span><div><strong>{title}</strong><p>{text}</p></div></div>
}
function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN').format(date)
}
function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}
function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`student-detail ${wide ? 'wide' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}
function Status({ value, tone }: { value: string; tone: string }) { return <span className={`status ${tone}`}>{value}</span> }

function Schedule({ time, name, teacher, meta, status, onClick }: { time: string; name: string; teacher: string; meta: string; status: string; onClick?: () => void }) {
  return <div className={`schedule-row ${onClick ? 'clickable' : ''}`} onClick={onClick}><strong className="time">{time}</strong><span className="schedule-line"></span><div><strong>{name}</strong><p>{teacher} · {meta}</p></div><Status value={status} tone="muted" /></div>
}
function MiniBars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  return <div className="mini-chart">{data.map((item) => <div className="bar-wrap" key={item.label}><div className="bar" style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 2)}%` }} title={money.format(item.value)}></div><span>{item.label}</span></div>)}</div>
}

function Progress({ label, value }: { label: string; value: number }) {
  return <div className="progress-row"><div><span>{label}</span><strong>{value}%</strong></div><div className="progress-track"><div style={{ width: `${value}%` }}></div></div></div>
}

function App() {
  return (
    <AuthGate>
      {({ user, brand, logout, updateUser, updateBrand, applyAppearance }) => (
        <AuthenticatedApp
          currentUser={user}
          brand={brand}
          onLogout={logout}
          onUserUpdated={updateUser}
          onBrandUpdated={updateBrand}
          onAppearance={applyAppearance}
        />
      )}
    </AuthGate>
  )
}

export default App
