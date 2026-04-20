export type UserRole = 'admin' | 'lead' | 'backend' | 'housekeeping'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  lead: 'Counselor',
  backend: 'Backend',
  housekeeping: 'Housekeeping',
}

export type LeadStatus =
  | 'new' | 'contacted' | 'interested' | 'counselled'
  | 'document_received' | 'converted' | 'lost'
  | 'dnp' | 'switch_off' | 'not_reachable'

export type LeadSource =
  | 'website' | 'walk_in' | 'referral' | 'whatsapp'
  | 'phone' | 'excel_import' | 'social_media' | 'other'

export type ActivityType =
  | 'created' | 'status_changed' | 'assigned' | 'transferred'
  | 'note_added' | 'followup_set' | 'payment_received'
  | 'converted' | 'document_uploaded' | 'call_made' | 'updated'

export type PaymentMode =
  | 'cash' | 'upi' | 'card' | 'neft' | 'rtgs' | 'cheque' | 'other'

export type DocType =
  | '10th_marksheet' | '12th_marksheet' | 'graduation' | 'passport'
  | 'sop' | 'lor' | 'ielts_scorecard' | 'pte_scorecard'
  | 'offer_letter' | 'visa' | 'other'

export type ExamType =
  | 'ielts' | 'pte' | 'toefl' | 'practical' | 'final_exam' | 'mock_test' | 'other'

export type AttendanceStatus =
  | 'present' | 'absent' | 'half_day' | 'late' | 'leave' | 'holiday'

export type ExpenseCategory =
  | 'rent' | 'utilities' | 'marketing' | 'travel' | 'salary' | 'vendor' | 'misc' | 'other'

export const LEAD_COLUMNS = [
  { key: 'full_name', label: 'Student name', default: true },
  { key: 'phone', label: 'Phone', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'course', label: 'Course', default: true },
  { key: 'sub_course', label: 'Standard', default: false },
  { key: 'department', label: 'Department', default: false },
  { key: 'sub_section', label: 'University/Board', default: false },
  { key: 'source', label: 'Source', default: true },
  { key: 'assigned_to', label: 'Assigned to', default: true },
  { key: 'mode', label: 'Mode', default: true },
  { key: 'created_at', label: 'Created on', default: true },
  { key: 'assigned_at', label: 'Assigned date', default: false },
  { key: 'next_followup_date', label: 'Next followup', default: false },
  { key: 'last_activity', label: 'Last followup', default: false },
  { key: 'amount_paid', label: 'Payment received', default: false },
  { key: 'pending_amount', label: 'Pending amount', default: false },
  { key: 'city', label: 'City', default: false },
  { key: 'email', label: 'Email', default: false },
  { key: 'transferred_from', label: 'Transferred from', default: false },
  { key: 'converted_at', label: 'Converted date', default: false },
  { key: 'last_note', label: 'Last note', default: false },
  { key: 'import_batch_id', label: 'Import batch', default: false },
] as const

export interface LeadFilters {
  search?: string
  status?: LeadStatus[]
  source?: LeadSource[]
  assigned_to?: string[]
  course_id?: string[]
  sub_course_id?: string[]
  department_id?: string[]
  sub_section_id?: string[]
  city?: string
  created_from?: string
  created_to?: string
  followup_from?: string
  followup_to?: string
  payment_status?: 'paid' | 'partial' | 'unpaid'
  import_batch_id?: string
  mode?: 'attending' | 'non-attending' | 'regular' | 'online'
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  is_active: boolean
  created_at: string
}

export interface Course {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface SubCourse {
  id: string
  course_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface DepartmentSubSection {
  id: string
  department_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Session {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Lead {
  id: string
  full_name: string
  phone: string
  email?: string
  city?: string
  state?: string
  course_id?: string
  sub_course_id?: string
  department_id?: string
  sub_section_id?: string
  session_id?: string
  status: LeadStatus
  source: LeadSource
  assigned_to?: string
  assigned_at?: string
  next_followup_date?: string
  total_fee?: number
  amount_paid?: number
  converted_at?: string
  created_by?: string
  mode?: 'attending' | 'non-attending' | 'regular' | 'online'
  enrollment_date?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  // joins
  course?: Course
  sub_course?: SubCourse
  department?: Department
  sub_section?: DepartmentSubSection
  session?: Session
  assigned_user?: Profile
  created_by_user?: Profile
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: ActivityType
  old_value?: string
  new_value?: string
  note?: string
  performed_by?: string
  created_at: string
  performer?: Profile
}

export interface Payment {
  id: string
  lead_id?: string
  student_id?: string
  amount: number
  payment_mode: PaymentMode
  payment_date: string
  receipt_number?: string
  notes?: string
  recorded_by?: string
  created_at: string
  recorder?: Profile
}

export interface Student {
  id: string
  lead_id?: string
  enrollment_number: string
  full_name: string
  guardian_name?: string
  guardian_phone?: string
  guardian_relationship?: string
  phone: string
  email?: string
  city?: string
  course_id?: string
  sub_course_id?: string
  assigned_counsellor?: string
  total_fee?: number
  amount_paid?: number
  incentive_amount?: number
  enrollment_date?: string
  mode?: 'attending' | 'non-attending' | 'regular' | 'online'
  department_id?: string
  sub_section_id?: string
  session_id?: string
  status: string
  created_at: string
  updated_at: string
  course?: Course
  sub_course?: SubCourse
  department?: Department
  sub_section?: DepartmentSubSection
  session?: Session
  counsellor?: Profile
}

export interface Employee {
  id: string
  profile_id: string
  employee_code: string
  department?: string
  designation?: string
  joining_date?: string
  basic_salary?: number
  hra?: number
  allowances?: number
  bank_account?: string
  bank_ifsc?: string
  bank_name?: string
  salary_cycle_start_day?: number
  is_active: boolean
  created_at: string
  profile?: Profile
}

export interface Payroll {
  id: string
  employee_id: string
  month: number
  year: number
  basic: number
  hra: number
  allowances: number
  incentive: number
  gross: number
  pf: number
  tds: number
  other_deductions: number
  leave_deduction: number
  net: number
  status: 'draft' | 'processed' | 'paid'
  payment_date?: string
  created_at: string
}

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  expense_date: string
  payment_mode?: string
  bill_url?: string
  notes?: string
  submitted_by?: string
  approved_by?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  submitter?: Profile
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  counselled: 'Counselled',
  document_received: 'Document Received',
  converted: 'Converted',
  lost: 'Lost',
  dnp: 'DNP',
  switch_off: 'Switch Off',
  not_reachable: 'Not Reachable',
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-purple-100 text-purple-800',
  interested: 'bg-yellow-100 text-yellow-800',
  counselled: 'bg-orange-100 text-orange-800',
  document_received: 'bg-indigo-100 text-indigo-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  dnp: 'bg-slate-100 text-slate-700',
  switch_off: 'bg-zinc-100 text-zinc-700',
  not_reachable: 'bg-gray-100 text-gray-700',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  walk_in: 'Walk-in',
  referral: 'Referral',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  excel_import: 'Excel Import',
  social_media: 'Social Media',
  other: 'Other',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  neft: 'NEFT',
  rtgs: 'RTGS',
  cheque: 'Cheque',
  other: 'Other',
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  '10th_marksheet': '10th Marksheet',
  '12th_marksheet': '12th Marksheet',
  graduation: 'Graduation Certificate',
  passport: 'Passport',
  sop: 'SOP',
  lor: 'LOR',
  ielts_scorecard: 'IELTS Scorecard',
  pte_scorecard: 'PTE Scorecard',
  offer_letter: 'Offer Letter',
  visa: 'Visa',
  other: 'Other',
}

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  ielts: 'IELTS',
  pte: 'PTE',
  toefl: 'TOEFL',
  practical: 'Practical',
  final_exam: 'Final Exam',
  mock_test: 'Mock Test',
  other: 'Other',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  marketing: 'Marketing',
  travel: 'Travel',
  salary: 'Salary',
  vendor: 'Vendor',
  misc: 'Miscellaneous',
  other: 'Other',
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  late: 'Late',
  leave: 'Leave',
  holiday: 'Holiday',
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
