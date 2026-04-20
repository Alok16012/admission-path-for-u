'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Phone, Mail, MapPin, Tag, BookOpen, UserCheck, Building2, Calendar, FileText, CalendarDays, Bell, MessageSquare, IndianRupee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { leadSchema, type LeadFormData } from '@/lib/validations/lead.schema'
import {
  LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  type Lead, type Course, type SubCourse, type Profile,
  type Department, type DepartmentSubSection, type Session
} from '@/types/app.types'

interface FormField {
  id: string
  field_key: string
  label: string
  field_type: string
  is_required: boolean
  is_active: boolean
  is_system: boolean
  options: string[] | null
  display_order: number
}

interface LeadFormProps {
  lead?: Lead
  onSuccess: () => void
  onCancel: () => void
}

const SYSTEM_FIELD_KEYS = ['full_name', 'phone', 'email', 'city', 'state', 'source', 'status', 'mode', 'course_id', 'sub_course_id', 'department_id', 'sub_section_id', 'session_id', 'assigned_to', 'next_followup_date', 'next_followup_time', 'enrollment_date', 'total_fee', 'amount_paid', 'notes']

// Map old/legacy status values to new ones
function sanitizeStatus(status: string): LeadFormData['status'] {
  const valid = ['new', 'contacted', 'interested', 'counselled', 'document_received', 'converted', 'lost', 'dnp', 'switch_off', 'not_reachable']
  if (valid.includes(status)) return status as LeadFormData['status']
  if (status === 'application_sent') return 'document_received'
  if (status === 'cold') return 'dnp'
  return 'new'
}

// Status colors for the status selector
const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  interested: 'bg-purple-500',
  counselled: 'bg-orange-500',
  document_received: 'bg-cyan-500',
  converted: 'bg-green-500',
  lost: 'bg-red-500',
  dnp: 'bg-slate-400',
  switch_off: 'bg-zinc-400',
  not_reachable: 'bg-gray-400',
}

// Source icons as emoji/text
const SOURCE_ICONS: Record<string, string> = {
  website: '🌐',
  walk_in: '🚶',
  referral: '🤝',
  whatsapp: '💬',
  phone: '📞',
  excel_import: '📊',
  social_media: '📱',
  other: '✨',
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 pb-2 mb-3 border-b ${color}`}>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color.replace('border-', 'bg-').replace('-200', '-100')}`}>
        <Icon className={`w-3.5 h-3.5 ${color.replace('border-', 'text-').replace('-200', '-600')}`} />
      </div>
      <span className={`text-xs font-bold uppercase tracking-wider ${color.replace('border-', 'text-').replace('-200', '-600')}`}>{title}</span>
    </div>
  )
}

function FieldWrapper({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
    </div>
  )
}

export function LeadForm({ lead, onSuccess, onCancel }: LeadFormProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [subCourses, setSubCourses] = useState<SubCourse[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subSections, setSubSections] = useState<DepartmentSubSection[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [telecallers, setTelecallers] = useState<Profile[]>([])
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [duplicateLead, setDuplicateLead] = useState<{ id: string; full_name: string; phone: string } | null>(null)
  const supabase = createClient()

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ? {
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email ?? '',
      city: lead.city ?? '',
      state: lead.state ?? '',
      course_id: lead.course_id ?? '',
      sub_course_id: lead.sub_course_id ?? '',
      department_id: lead.department_id ?? '',
      sub_section_id: lead.sub_section_id ?? '',
      session_id: lead.session_id ?? '',
      status: sanitizeStatus(lead.status),
      source: lead.source,
      assigned_to: lead.assigned_to ?? '',
      next_followup_date: lead.next_followup_date ?? '',
      next_followup_time: (lead as any).extra_data?.followup_time ?? '',
      enrollment_date: lead.enrollment_date ?? '',
      total_fee: lead.total_fee ?? undefined,
      amount_paid: lead.amount_paid ?? 0,
      mode: lead.mode ?? '',
    } : { status: 'new', source: 'phone', mode: '', enrollment_date: '', amount_paid: 0 },
  })

  const selectedCourseId = watch('course_id')
  const selectedDeptId = watch('department_id')

    useEffect(() => {
        let isMounted = true
        async function load() {
            setLoading(true)
            try {
                const [{ data: c }, { data: t }, { data: ff }, { data: d }, { data: s }] = await Promise.all([
                    supabase.from('courses').select('*').order('name'),
                    supabase.from('profiles').select('*').in('role', ['lead', 'telecaller']).eq('is_active', true).order('full_name'),
                    supabase.from('lead_form_fields').select('*').eq('is_active', true).order('display_order'),
                    supabase.from('departments').select('*').order('name'),
                    supabase.from('sessions').select('*').order('created_at', { ascending: false }),
                ])

                if (!isMounted) return
                setCourses((c ?? []) as any[])
                setTelecallers(t ?? [])
                setFormFields(ff ?? [])
                setDepartments((d ?? []) as any[])
                setSessions((s ?? []) as any[])

                if (lead?.id) {
                    reset({
                        full_name: lead.full_name,
                        phone: lead.phone,
                        email: lead.email ?? '',
                        city: lead.city ?? '',
                        state: lead.state ?? '',
                        course_id: lead.course_id ?? (lead as any).course?.id ?? '',
                        sub_course_id: lead.sub_course_id ?? (lead as any).sub_course?.id ?? '',
                        department_id: lead.department_id ?? (lead as any).department?.id ?? '',
                        sub_section_id: lead.sub_section_id ?? (lead as any).sub_section?.id ?? '',
                        session_id: lead.session_id ?? (lead as any).session?.id ?? '',
                        status: sanitizeStatus(lead.status),
                        source: lead.source,
                        assigned_to: lead.assigned_to ?? '',
                        next_followup_date: lead.next_followup_date ?? '',
                        next_followup_time: (lead as any).extra_data?.followup_time ?? '',
                        enrollment_date: lead.enrollment_date ?? '',
                        total_fee: lead.total_fee ?? undefined,
                        amount_paid: lead.amount_paid ?? 0,
                        mode: lead.mode ?? '',
                    } as any)
                }
            } catch (err) {
                console.error('Error loading lead form data:', err)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        load()
        return () => { isMounted = false }
    }, [lead?.id, reset])

    useEffect(() => {
        if (!selectedCourseId) { setSubCourses([]); return }
        const isEditingOriginalCourse = lead?.id && selectedCourseId === (lead.course_id || (lead as any).course?.id)
        
        supabase.from('sub_courses').select('*').eq('course_id', selectedCourseId)
            .then(({ data }) => {
                const subData = (data ?? []) as any[]
                if (isEditingOriginalCourse && (lead as any).sub_course) {
                    if (!subData.find((x: any) => x.id === (lead as any).sub_course.id)) subData.push((lead as any).sub_course)
                }
                setSubCourses([...subData])
                
                if (isEditingOriginalCourse) {
                    const originalSubId = lead.sub_course_id ?? (lead as any).sub_course?.id
                    if (originalSubId) setValue('sub_course_id', originalSubId as any)
                }
            })
    }, [selectedCourseId, lead?.id, setValue])

    useEffect(() => {
        if (!selectedDeptId) { setSubSections([]); return }
        const isEditingOriginalDept = lead?.id && selectedDeptId === (lead.department_id || (lead as any).department?.id)

        supabase.from('department_sub_sections').select('*').eq('department_id', selectedDeptId)
            .then(({ data }) => {
                const subSecData = (data ?? []) as any[]
                if (isEditingOriginalDept && (lead as any).sub_section) {
                    if (!subSecData.find((x: any) => x.id === (lead as any).sub_section.id)) subSecData.push((lead as any).sub_section)
                }
                setSubSections([...subSecData] as any)
                
                if (isEditingOriginalDept) {
                    const originalSubId = lead.sub_section_id ?? (lead as any).sub_section?.id
                    if (originalSubId) setValue('sub_section_id', originalSubId as any)
                }
            })
    }, [selectedDeptId, lead?.id, setValue])

  async function checkDuplicate(phone: string) {
    if (!phone || phone.length < 7) { setDuplicateLead(null); return }
    const q = supabase.from('leads').select('id, full_name, phone').eq('phone', phone.trim()).limit(1)
    if (lead?.id) q.neq('id', lead.id)
    const { data } = await q.maybeSingle()
    setDuplicateLead(data as any ?? null)
  }

  async function onSubmit(data: LeadFormData) {
    setLoading(true)
    try {
      // session_id column may not exist in DB — exclude from payload
      const { notes, next_followup_time, session_id: _sid, ...rest } = data
      const mergedExtra = {
        ...(Object.keys(customValues).length ? customValues : {}),
        ...(next_followup_time ? { followup_time: next_followup_time } : {}),
      }
      const payload = {
        ...rest,
        email: rest.email || null,
        city: rest.city || null,
        state: rest.state || null,
        mode: rest.mode || null,
        course_id: rest.course_id || null,
        sub_course_id: rest.sub_course_id || null,
        department_id: rest.department_id || null,
        sub_section_id: rest.sub_section_id || null,
        // session_id excluded — column not in DB yet
        assigned_to: rest.assigned_to || null,
        next_followup_date: rest.next_followup_date || null,
        enrollment_date: rest.enrollment_date || null,
        // amount_paid update removed as per user request — only total_fee (Discussed Amount) is managed here
        total_fee: rest.total_fee ?? null,
        extra_data: Object.keys(mergedExtra).length ? mergedExtra : null,
      }

      if (lead) {
        // Diffing to log changes
        const changes: string[] = []
        if (data.full_name !== lead.full_name) changes.push(`Name: ${lead.full_name} → ${data.full_name}`)
        if (data.phone !== lead.phone) changes.push(`Phone: ${lead.phone} → ${data.phone}`)
        if (data.email !== (lead.email ?? '')) changes.push(`Email: ${lead.email ?? 'None'} → ${data.email || 'None'}`)
        if (data.status !== lead.status) changes.push(`Status: ${lead.status} → ${data.status}`)
        if (data.mode !== (lead.mode ?? '')) changes.push(`Mode: ${lead.mode ?? 'None'} → ${data.mode || 'None'}`)
        if (data.course_id !== (lead.course_id ?? '')) {
          const newCourse = courses.find(c => c.id === data.course_id)?.name || 'None'
          changes.push(`Course: ${lead.course?.name ?? 'None'} → ${newCourse}`)
        }
        // session_id diff logging removed — column not in DB
        if (data.assigned_to !== (lead.assigned_to ?? '')) {
          const newUser = telecallers.find(t => t.id === data.assigned_to)?.full_name || 'Unassigned'
          changes.push(`Assigned: ${lead.assigned_user?.full_name ?? 'Unassigned'} → ${newUser}`)
        }
        if (data.next_followup_date !== (lead.next_followup_date ?? '')) {
          changes.push(`Follow-up: ${lead.next_followup_date ?? 'None'} → ${data.next_followup_date || 'Cleared'}`)
        }

        const { error } = await supabase.from('leads').update({ ...payload, updated_at: new Date().toISOString() } as never).eq('id', lead.id)
        if (error) throw new Error(error.message || error.details || error.hint || `DB error: ${error.code}`)

        const { data: { user } } = await supabase.auth.getUser()

        // Payment adjustment via LeadForm removed — use Finance section for payments.

        if (changes.length > 0) {
          await supabase.from('lead_activities').insert({
            lead_id: lead.id,
            activity_type: 'updated',
            note: changes.join(', '),
            performed_by: user?.id
          } as never)
        }

        if (data.notes) {
          await supabase.from('lead_activities').insert({
            lead_id: lead.id,
            activity_type: 'note_added',
            note: data.notes,
            performed_by: user?.id
          } as never)
        }

        // Log followup_set if date changed
        if (data.next_followup_date && data.next_followup_date !== (lead.next_followup_date ?? '')) {
          await supabase.from('lead_activities').insert({
            lead_id: lead.id,
            activity_type: 'followup_set',
            new_value: data.next_followup_date,
            old_value: lead.next_followup_date ?? null,
            performed_by: user?.id
          } as never)
        }

        toast.success('Lead updated successfully')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        // If telecaller didn't assign to someone else, auto-assign to themselves
        const assignedTo = payload.assigned_to || user?.id
        const { error } = await supabase.from('leads').insert({ ...payload, assigned_to: assignedTo, created_by: user?.id } as never)
        if (error) throw new Error(error.message || error.details || error.hint || `DB error: ${error.code}`)
        toast.success('Lead created successfully!')
      }
      onSuccess()
    } catch (err: unknown) {
      const e = err as any
      const msg = e?.message || e?.error_description || e?.details || e?.hint || JSON.stringify(e) || 'Failed to save lead'
      toast.error(msg)
      console.error('Lead save error:', e?.code, e?.message, e?.details, e?.hint)
    } finally {
      setLoading(false)
    }
  }

  const customFields = formFields.filter((f) => !f.is_system)

  function isVisible(key: string) {
    const found = formFields.find((f) => f.field_key === key)
    return found ? found.is_active : SYSTEM_FIELD_KEYS.includes(key)
  }

  function isRequired(key: string) {
    const found = formFields.find((f) => f.field_key === key)
    return found ? found.is_required : false
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Section 1: Contact Info ── */}
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
        <SectionHeader icon={User} title="Contact Information" color="border-blue-200" />
        <div className="grid grid-cols-2 gap-4">
          <FieldWrapper label="Full Name" required error={errors.full_name?.message}>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <Input
                {...register('full_name')}
                placeholder="e.g. Rahul Sharma"
                className="pl-9 bg-white border-blue-200 focus:border-blue-400"
              />
            </div>
          </FieldWrapper>

          <FieldWrapper label="Phone" required error={errors.phone?.message}>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <Input
                {...register('phone')}
                placeholder="e.g. 9876543210"
                className={`pl-9 bg-white focus:border-blue-400 ${duplicateLead ? 'border-orange-400 bg-orange-50' : 'border-blue-200'}`}
                onBlur={(e) => checkDuplicate(e.target.value)}
              />
            </div>
            {duplicateLead && (
              <div className="mt-1.5 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                <span className="text-orange-500 font-bold mt-0.5">⚠</span>
                <span>
                  Duplicate! <span className="font-semibold">{duplicateLead.full_name}</span> already has this number.{' '}
                  <button
                    type="button"
                    className="underline font-semibold text-blue-600 hover:text-blue-800"
                    onClick={() => window.open(`/leads/${duplicateLead.id}`, '_blank')}
                  >
                    View lead
                  </button>
                </span>
              </div>
            )}
          </FieldWrapper>

          {isVisible('email') && (
            <FieldWrapper label="Email" required={isRequired('email')}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="e.g. rahul@email.com"
                  className="pl-9 bg-white border-blue-200 focus:border-blue-400"
                />
              </div>
            </FieldWrapper>
          )}

          {(isVisible('city') || isVisible('state')) && (
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {isVisible('city') && (
                <FieldWrapper label="City" required={isRequired('city')}>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                    <Input {...register('city')} placeholder="City" className="pl-9 bg-white border-blue-200 focus:border-blue-400" />
                  </div>
                </FieldWrapper>
              )}
              {isVisible('state') && (
                <FieldWrapper label="State" required={isRequired('state')}>
                  <Input {...register('state')} placeholder="State" className="bg-white border-blue-200 focus:border-blue-400" />
                </FieldWrapper>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Lead Details ── */}
      <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
        <SectionHeader icon={Tag} title="Lead Details" color="border-purple-200" />
        <div className="grid grid-cols-2 gap-4">
          {isVisible('status') && (
            <FieldWrapper label="Status">
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v as LeadFormData['status'])}>
                <SelectTrigger className="bg-white border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LEAD_STATUS_LABELS) as [string, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[k] ?? 'bg-gray-400'}`} />
                        {v}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}

          {isVisible('source') && (
            <FieldWrapper label="Source">
              <Select value={watch('source')} onValueChange={(v) => setValue('source', v as LeadFormData['source'])}>
                <SelectTrigger className="bg-white border-purple-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LEAD_SOURCE_LABELS) as [string, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="mr-1">{SOURCE_ICONS[k]}</span> {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </div>

        {isVisible('mode') && (
          <div className="mt-4 pt-4 border-t border-purple-100">
            <FieldWrapper label="Mode">
              <Select value={watch('mode') || ''} onValueChange={(v) => setValue('mode', v as any)}>
                <SelectTrigger className="bg-white border-purple-200">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select mode</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="non-attending">Non-Attending</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrapper>
          </div>
        )}

        {isVisible('enrollment_date') && (
          <div className="mt-4 pt-4 border-t border-purple-100">
            <FieldWrapper label="Expected Enrollment Date">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input type="date" {...register('enrollment_date')} className="pl-9 bg-white border-purple-200" />
              </div>
            </FieldWrapper>
          </div>
        )}
      </div>

      {/* ── Section 3: Department & University ── */}
      {(isVisible('department_id') || isVisible('sub_section_id')) && (
        <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
          <SectionHeader icon={Building2} title="Department & University" color="border-amber-200" />
          <div className="grid grid-cols-2 gap-4">
            {isVisible('department_id') && (
              <FieldWrapper label="Department">
                <Select value={watch('department_id') || ''} onValueChange={(v) => { setValue('department_id', v || ''); setValue('sub_section_id', '' as any) }}>
                  <SelectTrigger className="bg-white border-amber-200">
                    <SelectValue placeholder="Select department">
                      {departments.find(d => d.id === watch('department_id'))?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No department</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldWrapper>
            )}

            {isVisible('sub_section_id') && (
              <FieldWrapper label="University/Board">
                <Select
                  value={watch('sub_section_id') || ''}
                  onValueChange={(v) => setValue('sub_section_id', v as any)}
                  disabled={!selectedDeptId}
                >
                  <SelectTrigger className="bg-white border-amber-200 disabled:opacity-50">
                    <SelectValue placeholder={selectedDeptId ? 'Select university/board' : 'Select department first'}>
                      {subSections.find(s => s.id === watch('sub_section_id'))?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No university/board</SelectItem>
                    {subSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldWrapper>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: Course Preference ── */}
      {(isVisible('course_id') || isVisible('sub_course_id')) && (
        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
          <SectionHeader icon={BookOpen} title="Course Preference" color="border-emerald-200" />
          <div className="grid grid-cols-2 gap-4">
            {isVisible('course_id') && (
              <FieldWrapper label="Course">
                <Select value={watch('course_id') || ''} onValueChange={(v) => { setValue('course_id', v || ''); setValue('sub_course_id', '' as any) }}>
                  <SelectTrigger className="bg-white border-emerald-200">
                    <SelectValue placeholder="Select course">
                      {courses.find(c => c.id === watch('course_id'))?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No course</SelectItem>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldWrapper>
            )}

            {isVisible('sub_course_id') && (
              <FieldWrapper label="Standard">
                <Select
                  value={watch('sub_course_id') || ''}
                  onValueChange={(v) => setValue('sub_course_id', v as any)}
                  disabled={!selectedCourseId}
                >
                  <SelectTrigger className="bg-white border-emerald-200 disabled:opacity-50">
                    <SelectValue placeholder={selectedCourseId ? 'Select standard' : 'Select course first'}>
                      {subCourses.find(s => s.id === watch('sub_course_id'))?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No standard</SelectItem>
                    {subCourses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldWrapper>
            )}
          </div>
        </div>
      )}

      {/* ── Section 5: Budget & Fees ── only shown when editing an existing lead */}
      {!!lead && (isVisible('total_fee')) && (
        <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
          <SectionHeader icon={IndianRupee} title="Budget & Fees" color="border-orange-200" />
          <div className="grid grid-cols-2 gap-4">
            {isVisible('total_fee') && (
              <FieldWrapper label="Discussed Amount (Negotiated Fee)">
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                  <Input 
                    type="number" 
                    {...register('total_fee', { valueAsNumber: true })} 
                    placeholder="e.g. 50000"
                    className="pl-9 bg-white border-orange-200 focus:border-orange-400" 
                  />
                </div>
              </FieldWrapper>
            )}
          </div>
        </div>
      )}

      {/* Academic Sessions section hidden — session_id column not in leads table yet */}

      {/* ── Section 6: Assigned To ── */}
      {isVisible('assigned_to') && telecallers.length > 0 && (
        <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
          <SectionHeader icon={UserCheck} title="Assign To" color="border-teal-200" />
          <FieldWrapper label="Assign to Telecaller">
            <Select
              value={watch('assigned_to') || ''}
              onValueChange={(v) => setValue('assigned_to', v || '')}
            >
              <SelectTrigger className="bg-white border-teal-200">
                <SelectValue placeholder="Select telecaller">
                  {telecallers.find(t => t.id === watch('assigned_to'))?.full_name || lead?.assigned_user?.full_name || 'Select telecaller'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {telecallers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWrapper>
        </div>
      )}

      {/* ── Section 7: Follow-up & Reminder ── */}
      {isVisible('next_followup_date') && (
        <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100">
          <SectionHeader icon={Bell} title="Follow-up & Reminder" color="border-rose-200" />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="Next Follow-up Date">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
                <Input
                  type="date"
                  {...register('next_followup_date')}
                  className="pl-9 bg-white border-rose-200 focus:border-rose-400"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </FieldWrapper>
            <FieldWrapper label="Follow-up Time">
              <div className="relative">
                <Bell className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
                <Input
                  type="time"
                  {...register('next_followup_time')}
                  className="pl-9 bg-white border-rose-200 focus:border-rose-400"
                />
              </div>
            </FieldWrapper>
          </div>
          {(watch('next_followup_date') || watch('next_followup_time')) && (
            <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              Reminder set for{' '}
              {watch('next_followup_date')
                ? new Date(watch('next_followup_date')!).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
              {watch('next_followup_time') ? ` at ${watch('next_followup_time')}` : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Section 8: Notes ── */}
      {isVisible('notes') && (
        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200">
          <SectionHeader icon={MessageSquare} title="Add a Note" color="border-slate-300" />
          <FieldWrapper label={lead ? 'Add note (will be saved to activity timeline)' : 'Notes'}>
            <Textarea
              {...register('notes')}
              placeholder="Add any remarks, follow-up notes, or important info..."
              rows={3}
              className="bg-white border-slate-200 focus:border-slate-400 resize-none"
            />
          </FieldWrapper>
        </div>
      )}

      {/* ── Footer Actions ── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Fields marked <span className="text-red-400 font-semibold">*</span> are required
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="px-5">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Saving...
              </span>
            ) : (lead ? 'Update Lead' : 'Create Lead')}
          </Button>
        </div>
      </div>
    </form>
  )
}
