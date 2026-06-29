'use client'
import { useState, useTransition, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, IndianRupee, Search,
  Building2, Scale, CreditCard, History, Download,
  ChevronDown, ChevronRight, UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/types/app.types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dept { id: string; name: string; dept_fund: number | null }
interface SubSection { id: string; name: string; department_id: string }
interface Session { id: string; name: string }

interface Litigation {
  id: string
  record_type: 'litigation' | 'debt'
  department_id: string
  sub_section_id: string | null
  session_id: string | null
  student_id: string | null
  student_name: string
  father_name: string | null
  phone: string | null
  litigation_type: string | null
  reason: string | null
  litigation_amount: number
  amount_paid: number
  amount_refunded: number
  notes: string | null
  created_at: string
  department: { id: string; name: string } | null
  sub_section: { id: string; name: string } | null
  session: { id: string; name: string } | null
}

interface LitigationPayment {
  id: string
  litigation_id: string
  amount: number
  payment_date: string
  payment_mode: string | null
  receipt_no: string | null
  notes: string | null
  created_at: string
}

interface DroppedStudent {
  id: string
  full_name: string
  phone: string
  guardian_name: string | null
  drop_reason: string | null
  department: { id: string; name: string } | null
  sub_section: { id: string; name: string } | null
  session: { id: string; name: string } | null
}

interface FormState {
  record_type: 'litigation' | 'debt'
  department_id: string
  sub_section_id: string
  session_id: string
  student_name: string
  father_name: string
  phone: string
  litigation_type: string
  reason: string
  litigation_amount: string
  amount_refunded: string
  notes: string
}

interface PayForm {
  amount: string
  payment_date: string
  payment_mode: string
  receipt_no: string
  notes: string
}

const LITIGATION_TYPES = [
  { value: 'pre_process_cancellation', label: 'Pre-Process Cancellation' },
  { value: 'post_process_cancellation', label: 'Post-Process Cancellation' },
  { value: 'service_issue', label: 'Service Issue' },
  { value: 'price_issue', label: 'Price Issue' },
  { value: 'dropoff_no_interest', label: 'Drop-off / No Interest' },
  { value: 'adjusted', label: 'Adjusted' },
]

const DEBT_TYPES = [
  { value: 'pre_process_cancellation', label: 'Pre-Process Cancellation' },
  { value: 'post_process_cancellation', label: 'Post-Process Cancellation' },
  { value: 'service_issue', label: 'Service Issue' },
  { value: 'price_issue', label: 'Price Issue' },
  { value: 'dropoff_no_interest', label: 'Drop-off / No Interest' },
  { value: 'adjusted', label: 'Adjusted' },
]

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Demand Draft', 'Other']

const EMPTY_FORM: FormState = {
  record_type: 'litigation',
  department_id: '',
  sub_section_id: '',
  session_id: '',
  student_name: '',
  father_name: '',
  phone: '',
  litigation_type: '',
  reason: '',
  litigation_amount: '',
  amount_refunded: '',
  notes: '',
}

const EMPTY_PAY: PayForm = {
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_mode: '',
  receipt_no: '',
  notes: '',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'default' }: { label: string; value: string | number; color?: 'blue' | 'green' | 'amber' | 'red' | 'default' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    default: 'bg-gray-50 text-gray-700 border-gray-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

// ─── Receipt Generator ────────────────────────────────────────────────────────
function downloadReceipt(payment: LitigationPayment, litigation: Litigation) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Payment Receipt</title>
<style>
  @page { size: A4; margin: 0; }
  body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 4px 0; color: #555; font-size: 13px; }
  .receipt-no { text-align: right; font-size: 13px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { padding: 8px 12px; border: 1px solid #ddd; font-size: 14px; }
  td:first-child { font-weight: bold; background: #f9f9f9; width: 40%; }
  .total { font-size: 18px; font-weight: bold; }
  .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { button { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <h1>Payment Receipt</h1>
  <p>${litigation.record_type === 'debt' ? 'Debt Payment' : 'Litigation Payment'}</p>
</div>
${payment.receipt_no ? `<div class="receipt-no">Receipt No: <strong>${payment.receipt_no}</strong></div>` : ''}
<table>
  <tr><td>Student Name</td><td>${litigation.student_name}</td></tr>
  ${litigation.father_name ? `<tr><td>Father's Name</td><td>${litigation.father_name}</td></tr>` : ''}
  ${litigation.phone ? `<tr><td>Phone</td><td>${litigation.phone}</td></tr>` : ''}
  <tr><td>Department</td><td>${litigation.department?.name ?? '—'}</td></tr>
  ${litigation.sub_section ? `<tr><td>Board / University</td><td>${litigation.sub_section.name}</td></tr>` : ''}
  ${litigation.session ? `<tr><td>Session</td><td>${litigation.session.name}</td></tr>` : ''}
  <tr><td>Case Type</td><td>${litigation.litigation_type ?? '—'}</td></tr>
  ${litigation.reason ? `<tr><td>Reason</td><td>${litigation.reason}</td></tr>` : ''}
  <tr><td>Total Amount</td><td>₹${litigation.litigation_amount.toLocaleString('en-IN')}</td></tr>
  <tr><td>Payment Date</td><td>${new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
  <tr><td>Payment Mode</td><td>${payment.payment_mode ?? '—'}</td></tr>
  ${payment.notes ? `<tr><td>Notes</td><td>${payment.notes}</td></tr>` : ''}
  <tr><td class="total">Amount Paid (This Receipt)</td><td class="total">₹${payment.amount.toLocaleString('en-IN')}</td></tr>
</table>
<div class="footer">
  <p>This is a computer-generated receipt.</p>
  <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function LitigationClient({
  departments,
  subSections,
  sessions,
  initialLitigations,
  initialPayments,
  droppedStudents,
}: {
  departments: Dept[]
  subSections: SubSection[]
  sessions: Session[]
  initialLitigations: Litigation[]
  initialPayments: LitigationPayment[]
  droppedStudents: DroppedStudent[]
}) {
  const supabase = createClient()
  const [litigations, setLitigations] = useState<Litigation[]>(initialLitigations)
  const [payments, setPayments] = useState<LitigationPayment[]>(initialPayments)
  const [depts, setDepts] = useState<Dept[]>(departments)
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  // Dialogs
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'litigation' | 'debt'>('litigation')
  const [editRecord, setEditRecord] = useState<Litigation | null>(null)
  const [payTarget, setPayTarget] = useState<Litigation | null>(null)
  const [payForm, setPayForm] = useState<PayForm>(EMPTY_PAY)
  const [showHistory, setShowHistory] = useState<Litigation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Litigation | null>(null)

  const [expandedDropped, setExpandedDropped] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formBoards, setFormBoards] = useState<SubSection[]>([])

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filterList = (list: Litigation[]) => list.filter((l) => {
    if (deptFilter !== 'all' && l.department_id !== deptFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        l.student_name.toLowerCase().includes(q) ||
        (l.phone ?? '').includes(q) ||
        (l.father_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const litigationList = useMemo(() => filterList(litigations.filter((l) => l.record_type !== 'debt')), [litigations, deptFilter, search])
  const debtList = useMemo(() => filterList(litigations.filter((l) => l.record_type === 'debt')), [litigations, deptFilter, search])

  const totalLit = litigationList.reduce((s, l) => s + (l.litigation_amount ?? 0), 0)
  const paidLit = litigationList.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const totalDebt = debtList.reduce((s, l) => s + (l.litigation_amount ?? 0), 0)
  const paidDebt = debtList.reduce((s, l) => s + (l.amount_paid ?? 0), 0)

  function litTypeLabel(val: string | null, type: string) {
    const list = type === 'debt' ? DEBT_TYPES : LITIGATION_TYPES
    return list.find((t) => t.value === val)?.label ?? val ?? '—'
  }

  function paymentsFor(id: string) {
    return payments.filter((p) => p.litigation_id === id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────
  function handleDeptChange(deptId: string | null) {
    if (!deptId) return
    setForm((f) => ({ ...f, department_id: deptId, sub_section_id: '' }))
    setFormBoards(subSections.filter((s) => s.department_id === deptId))
  }

  function openAdd(type: 'litigation' | 'debt') {
    setForm({ ...EMPTY_FORM, record_type: type })
    setFormBoards([])
    setEditRecord(null)
    setFormType(type)
    setShowForm(true)
  }

  function openAddFromStudent(s: DroppedStudent, type: 'litigation' | 'debt') {
    setForm({
      ...EMPTY_FORM,
      record_type: type,
      student_name: s.full_name,
      father_name: s.guardian_name ?? '',
      phone: s.phone ?? '',
      department_id: s.department?.id ?? '',
      sub_section_id: s.sub_section?.id ?? '',
      session_id: s.session?.id ?? '',
      reason: s.drop_reason ?? '',
    })
    if (s.department?.id) {
      setFormBoards(subSections.filter((b) => b.department_id === s.department!.id))
    }
    setEditRecord(null)
    setFormType(type)
    setShowForm(true)
  }

  function openEdit(l: Litigation) {
    setForm({
      record_type: l.record_type ?? 'litigation',
      department_id: l.department_id,
      sub_section_id: l.sub_section_id ?? '',
      session_id: l.session_id ?? '',
      student_name: l.student_name,
      father_name: l.father_name ?? '',
      phone: l.phone ?? '',
      litigation_type: l.litigation_type ?? '',
      reason: l.reason ?? '',
      litigation_amount: String(l.litigation_amount),
      amount_refunded: String(l.amount_refunded ?? 0),
      notes: l.notes ?? '',
    })
    setFormBoards(subSections.filter((s) => s.department_id === l.department_id))
    setEditRecord(l)
    setFormType(l.record_type ?? 'litigation')
    setShowForm(true)
  }

  function saveRecord() {
    if (!form.student_name.trim()) { toast.error('Student name is required'); return }
    if (!form.department_id) { toast.error('Department is required'); return }
    const amt = parseFloat(form.litigation_amount) || 0
    const refund = parseFloat(form.amount_refunded) || 0

    startTransition(async () => {
      const selectQ = `*, department:departments(id,name), sub_section:department_sub_sections(id,name), session:sessions(id,name)`
      const payload = {
        record_type: form.record_type,
        department_id: form.department_id,
        sub_section_id: form.sub_section_id || null,
        session_id: form.session_id || null,
        student_name: form.student_name.trim(),
        father_name: form.father_name.trim() || null,
        phone: form.phone.trim() || null,
        litigation_type: form.litigation_type || null,
        reason: form.reason.trim() || null,
        litigation_amount: amt,
        amount_refunded: refund,
        notes: form.notes.trim() || null,
      }

      if (editRecord) {
        const { error } = await supabase.from('department_litigations').update(payload as never).eq('id', editRecord.id)
        if (error) { toast.error('Update failed: ' + error.message); return }
        const { data } = await supabase.from('department_litigations').select(selectQ).eq('id', editRecord.id).single()
        if (data) setLitigations((prev) => prev.map((l) => l.id === editRecord.id ? data as Litigation : l))
        toast.success('Record updated!')
      } else {
        const { data, error } = await supabase
          .from('department_litigations')
          .insert({ ...payload, amount_paid: 0 } as never)
          .select(selectQ)
          .single()
        if (error) { toast.error('Add failed: ' + error.message); return }
        setLitigations((prev) => [data as Litigation, ...prev])
        toast.success(`${form.record_type === 'debt' ? 'Debt' : 'Litigation'} case added!`)
      }
      setShowForm(false)
    })
  }

  function addPayment() {
    if (!payTarget) return
    const adding = parseFloat(payForm.amount) || 0
    if (adding <= 0) { toast.error('Enter a valid amount'); return }
    const newPaid = (payTarget.amount_paid ?? 0) + adding

    startTransition(async () => {
      // Insert payment record
      const { data: payData, error: payErr } = await supabase
        .from('litigation_payments')
        .insert({
          litigation_id: payTarget.id,
          amount: adding,
          payment_date: payForm.payment_date,
          payment_mode: payForm.payment_mode || null,
          receipt_no: payForm.receipt_no.trim() || null,
          notes: payForm.notes.trim() || null,
        } as never)
        .select('*')
        .single()
      if (payErr) { toast.error('Payment failed: ' + payErr.message); return }

      // Update amount_paid on litigation
      const { error: updateErr } = await supabase
        .from('department_litigations')
        .update({ amount_paid: newPaid } as never)
        .eq('id', payTarget.id)
      if (updateErr) { toast.error('Update failed: ' + updateErr.message); return }

      // Auto-create expense entry
      await supabase.from('expenses').insert({
        category: 'misc',
        description: `${payTarget.record_type === 'debt' ? 'Debt' : 'Litigation'} payment: ${payTarget.student_name}${payTarget.reason ? ' - ' + payTarget.reason : ''}`,
        amount: adding,
        expense_date: payForm.payment_date,
        payment_mode: payForm.payment_mode || null,
        notes: `Dept: ${payTarget.department?.name ?? ''} | Receipt: ${payForm.receipt_no || 'N/A'}`,
        status: 'approved',
      } as never)

      // Update local state
      setPayments((prev) => [payData as LitigationPayment, ...prev])
      setLitigations((prev) => prev.map((l) => l.id === payTarget.id ? { ...l, amount_paid: newPaid } : l))
      toast.success(`₹${adding.toLocaleString('en-IN')} payment recorded & added to expenses!`)

      // Download receipt
      downloadReceipt(payData as LitigationPayment, { ...payTarget, amount_paid: newPaid })

      setPayTarget(null)
      setPayForm(EMPTY_PAY)
    })
  }

  function deleteRecord() {
    if (!deleteTarget) return
    startTransition(async () => {
      const { error } = await supabase.from('department_litigations').delete().eq('id', deleteTarget.id)
      if (error) { toast.error('Delete failed'); return }
      setLitigations((prev) => prev.filter((l) => l.id !== deleteTarget.id))
      toast.success('Record deleted')
    })
    setDeleteTarget(null)
  }



  function statusBadge(l: Litigation) {
    const pending = l.litigation_amount - l.amount_paid
    if (pending <= 0) return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Cleared</Badge>
    if (l.amount_paid > 0) return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Partial</Badge>
    return <Badge className="bg-red-100 text-red-800 border-0 text-xs">Pending</Badge>
  }

  // ─── Cases Table ─────────────────────────────────────────────────────────────
  function CasesTable({ list, type }: { list: Litigation[]; type: 'litigation' | 'debt' }) {
    if (list.length === 0) return (
      <div className="text-center py-16">
        <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No {type} cases found</p>
        <Button className="mt-4 gap-1.5" onClick={() => openAdd(type)}>
          <Plus className="w-4 h-4" /> Add {type === 'debt' ? 'Debt' : 'Litigation'}
        </Button>
      </div>
    )
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Department / Board</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type / Session</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reason</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Total</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Paid</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Refund</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Pending</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((l) => {
              const pending = l.litigation_amount - l.amount_paid
              const pCount = paymentsFor(l.id).length
              return (
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{l.student_name}</p>
                    {l.father_name && <p className="text-xs text-gray-500">Father: {l.father_name}</p>}
                    {l.phone && <p className="text-xs text-gray-400">{l.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{l.department?.name ?? '—'}</p>
                    {l.sub_section && <p className="text-xs text-purple-600">{l.sub_section.name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {l.litigation_type && (
                      <p className="text-xs font-medium text-blue-700">{litTypeLabel(l.litigation_type, type)}</p>
                    )}
                    <p className="text-xs text-gray-500">{l.session?.name ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">{l.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(l.litigation_amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">{formatCurrency(l.amount_paid)}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-600">{formatCurrency(l.amount_refunded ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(pending)}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(l)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {pending > 0 && (
                        <button
                          onClick={() => { setPayTarget(l); setPayForm(EMPTY_PAY) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium"
                          title="Record Payment"
                        >
                          <IndianRupee className="w-3 h-3" /> Pay
                        </button>
                      )}
                      <button
                        onClick={() => setShowHistory(l)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium"
                        title="Payment History"
                      >
                        <History className="w-3 h-3" /> {pCount > 0 ? pCount : ''}
                      </button>
                      <button onClick={() => openEdit(l)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(l)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const typeList = form.record_type === 'debt' ? DEBT_TYPES : LITIGATION_TYPES

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" /> Litigation & Debt Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track litigation cases, debts & payments department-wise</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openAdd('litigation')} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Litigation
          </Button>
          <Button onClick={() => openAdd('debt')} variant="outline" className="gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50">
            <CreditCard className="w-4 h-4" /> Add Debt
          </Button>
        </div>
      </div>



      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Litigation Cases" value={litigationList.length} color="blue" />
        <StatCard label="Litigation Pending" value={formatCurrency(totalLit - paidLit)} color={totalLit - paidLit > 0 ? 'red' : 'default'} />
        <StatCard label="Debt Cases" value={debtList.length} color="amber" />
        <StatCard label="Debt Pending" value={formatCurrency(totalDebt - paidDebt)} color={totalDebt - paidDebt > 0 ? 'red' : 'default'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, father name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? 'all')}>
          <SelectTrigger className="w-52 h-9">
            <Building2 className="w-4 h-4 mr-2 text-gray-400" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="litigation">
        <TabsList>
          <TabsTrigger value="litigation" className="gap-2">
            <Scale className="w-4 h-4" /> Litigation ({litigationList.length})
          </TabsTrigger>
          <TabsTrigger value="debt" className="gap-2">
            <CreditCard className="w-4 h-4" /> Debt ({debtList.length})
          </TabsTrigger>
          {droppedStudents.length > 0 && (
            <TabsTrigger value="dropped" className="gap-2">
              <UserX className="w-4 h-4" /> Dropped Students ({droppedStudents.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="litigation" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <CasesTable list={litigationList} type="litigation" />
          </div>
        </TabsContent>

        <TabsContent value="debt" className="mt-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <CasesTable list={debtList} type="debt" />
          </div>
        </TabsContent>

        {droppedStudents.length > 0 && (
          <TabsContent value="dropped" className="mt-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Department</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Session</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Drop Reason</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {droppedStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.full_name}</p>
                          {s.guardian_name && <p className="text-xs text-gray-500">Father: {s.guardian_name}</p>}
                          <p className="text-xs text-gray-400">{s.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{s.department?.name ?? '—'}</p>
                          {s.sub_section && <p className="text-xs text-purple-600">{s.sub_section.name}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{s.session?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{s.drop_reason ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openAddFromStudent(s, 'litigation')}
                              className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium flex items-center gap-1"
                            >
                              <Scale className="w-3 h-3" /> Add to Litigation
                            </button>
                            <button
                              onClick={() => openAddFromStudent(s, 'debt')}
                              className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-medium flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" /> Add to Debt
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.record_type === 'debt'
                ? <><CreditCard className="w-5 h-5 text-orange-500" /> {editRecord ? 'Edit Debt' : 'Add New Debt'}</>
                : <><Scale className="w-5 h-5 text-indigo-600" /> {editRecord ? 'Edit Litigation' : 'Add New Litigation'}</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Student Name *</label>
              <Input placeholder="Student name" value={form.student_name} onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Father&apos;s Name</label>
                <Input placeholder="Father's name" value={form.father_name} onChange={(e) => setForm((f) => ({ ...f, father_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone Number</label>
                <Input placeholder="Mobile number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Department *</label>
              <Select value={form.department_id} onValueChange={handleDeptChange}>
                <SelectTrigger>
                  <span className="text-sm truncate">
                    {form.department_id ? departments.find((d) => d.id === form.department_id)?.name ?? 'Select department' : 'Select department'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Board / University</label>
              <Select
                value={form.sub_section_id}
                onValueChange={(v) => setForm((f) => ({ ...f, sub_section_id: v ?? '' }))}
                disabled={!form.department_id}
              >
                <SelectTrigger>
                  <span className="text-sm truncate">
                    {form.sub_section_id
                      ? formBoards.find((b) => b.id === form.sub_section_id)?.name ?? '— None —'
                      : form.department_id ? 'Select board' : 'Select department first'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {formBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Session</label>
              <Select value={form.session_id} onValueChange={(v) => setForm((f) => ({ ...f, session_id: v ?? '' }))}>
                <SelectTrigger>
                  <span className="text-sm truncate">
                    {form.session_id ? sessions.find((s) => s.id === form.session_id)?.name ?? 'Select session' : 'Select session'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                {form.record_type === 'debt' ? 'Debt Type' : 'Litigation Type'}
              </label>
              <Select value={form.litigation_type} onValueChange={(v) => setForm((f) => ({ ...f, litigation_type: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {typeList.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason</label>
              <Input
                placeholder="Brief reason or case description"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  {form.record_type === 'debt' ? 'Debt Amount (₹)' : 'Litigation Amount (₹)'}
                </label>
                <Input
                  type="number"
                  placeholder="Total amount"
                  value={form.litigation_amount}
                  onChange={(e) => setForm((f) => ({ ...f, litigation_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount to be Refunded (₹)</label>
                <Input
                  type="number"
                  placeholder="Refund amount"
                  value={form.amount_refunded}
                  onChange={(e) => setForm((f) => ({ ...f, amount_refunded: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
              <Input
                placeholder="Additional notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={saveRecord} disabled={isPending}>
                {isPending ? 'Saving...' : editRecord ? 'Update' : 'Add'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) { setPayTarget(null); setPayForm(EMPTY_PAY) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-green-600" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4 mt-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Student:</span> <span className="font-semibold">{payTarget.student_name}</span></p>
                <p><span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(payTarget.litigation_amount)}</span></p>
                <p><span className="text-gray-500">Already Paid:</span> <span className="font-semibold text-green-700">{formatCurrency(payTarget.amount_paid)}</span></p>
                <p><span className="text-gray-500">Pending:</span> <span className="font-semibold text-red-600">{formatCurrency(payTarget.litigation_amount - payTarget.amount_paid)}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (₹) *</label>
                  <Input
                    type="number"
                    autoFocus
                    placeholder="Amount"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Date</label>
                  <Input
                    type="date"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Mode</label>
                <Select value={payForm.payment_mode} onValueChange={(v) => setPayForm((f) => ({ ...f, payment_mode: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Select —</SelectItem>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Receipt No.</label>
                <Input
                  placeholder="Receipt number (optional)"
                  value={payForm.receipt_no}
                  onChange={(e) => setPayForm((f) => ({ ...f, receipt_no: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <Input
                  placeholder="Optional note"
                  value={payForm.notes}
                  onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={addPayment} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Record & Download Receipt'}
                </Button>
                <Button variant="outline" onClick={() => { setPayTarget(null); setPayForm(EMPTY_PAY) }}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={(o) => { if (!o) setShowHistory(null) }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Payment History
              {showHistory && <span className="text-sm font-normal text-gray-500">— {showHistory.student_name}</span>}
            </DialogTitle>
          </DialogHeader>
          {showHistory && (() => {
            const hist = paymentsFor(showHistory.id)
            return (
              <div className="mt-2 space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-gray-500">Total Amount:</span> <span className="font-semibold">{formatCurrency(showHistory.litigation_amount)}</span></p>
                  <p><span className="text-gray-500">Total Paid:</span> <span className="font-semibold text-green-700">{formatCurrency(showHistory.amount_paid)}</span></p>
                  <p><span className="text-gray-500">Pending:</span> <span className="font-semibold text-red-600">{formatCurrency(showHistory.litigation_amount - showHistory.amount_paid)}</span></p>
                </div>
                {hist.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">No payments recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {hist.map((p) => (
                      <div key={p.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                          <button
                            onClick={() => downloadReceipt(p, showHistory)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <Download className="w-3 h-3" /> Receipt
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {p.payment_mode && <span>· {p.payment_mode}</span>}
                          {p.receipt_no && <span>· #{p.receipt_no}</span>}
                        </div>
                        {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full" variant="outline" onClick={() => { setPayTarget(showHistory); setPayForm(EMPTY_PAY); setShowHistory(null) }}>
                  <IndianRupee className="w-4 h-4 mr-1" /> Add New Payment
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>




      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete Record"
          description={`"${deleteTarget.student_name}" ${deleteTarget.record_type} case will be permanently deleted.`}
          confirmLabel="Delete"
          destructive
          onConfirm={deleteRecord}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
