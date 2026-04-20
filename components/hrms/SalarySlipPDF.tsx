'use client'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'

const BRAND = '#1e3a5f'
const ACCENT = '#2563eb'
const LIGHT = '#f1f5f9'
const MUTED = '#64748b'

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    color: '#1e293b',
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  topBar: { backgroundColor: BRAND, height: 6 },
  content: { padding: 36 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  logoBlock: { flexDirection: 'column' },
  logo: { width: 80, height: 44, objectFit: 'contain', marginBottom: 6 },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 3 },
  companyDetail: { fontSize: 9, color: MUTED, marginBottom: 2, lineHeight: 1.4 },
  slipBlock: { alignItems: 'flex-end' },
  slipBadge: {
    backgroundColor: BRAND,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  slipTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 2 },
  slipMeta: { fontSize: 9, color: MUTED, marginBottom: 3, textAlign: 'right' },
  slipMonth: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'right' },

  // Employee info card
  empCard: {
    backgroundColor: LIGHT,
    borderRadius: 6,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    marginBottom: 20,
  },
  empCardTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  empField: { width: '33%', marginBottom: 6 },
  empLabel: { fontSize: 8, color: MUTED, marginBottom: 2 },
  empValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  // Two column layout for earnings/deductions
  twoCol: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  col: { flex: 1 },
  tableTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableLabel: { flex: 1, fontSize: 9, color: '#334155' },
  tableValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },
  tableTotalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: LIGHT,
    borderRadius: 3,
    marginTop: 2,
  },
  tableTotalLabel: { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND },
  tableTotalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'right' },
  deductValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#dc2626', textAlign: 'right' },

  // Net pay box
  netBox: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  netHeader: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 7 },
  netHeaderText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 },
  netBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#eff6ff' },
  netLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND },
  netValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#16a34a' },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  signatureLine: { width: 110, borderBottomWidth: 1, borderBottomColor: '#94a3b8', marginBottom: 3 },
  signatureLabel: { fontSize: 8, color: MUTED },
  bottomBar: { backgroundColor: BRAND, height: 4, marginTop: 20 },
})

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export interface SalarySlipProps {
  employeeName: string
  employeeCode?: string
  designation?: string
  department?: string
  bankAccount?: string
  month: number
  year: number
  basic: number
  hra: number
  allowances: number
  incentive: number
  gross: number
  pf: number
  tds: number
  leaveDeduction: number
  otherDeductions: number
  net: number
  paymentDate: string | null
  logoBase64?: string
}

export function SalarySlipPDF({
  employeeName, employeeCode, designation, department, bankAccount,
  month, year, basic, hra, allowances, incentive, gross,
  pf, tds, leaveDeduction, otherDeductions, net, paymentDate, logoBase64,
}: SalarySlipProps) {
  const monthName = format(new Date(year, month - 1), 'MMMM yyyy')
  const totalDeductions = pf + tds + leaveDeduction + otherDeductions

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />
        <View style={styles.content}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBlock}>
              {logoBase64 ? <Image src={logoBase64} style={styles.logo} /> : null}
              <Text style={styles.companyName}>ADMISSION PATH4U</Text>
              <Text style={styles.companyDetail}>Patna, Bihar</Text>
              <Text style={styles.companyDetail}>Email: info@admissionpath4u.com</Text>
            </View>
            <View style={styles.slipBlock}>
              <View style={styles.slipBadge}>
                <Text style={styles.slipTitle}>SALARY SLIP</Text>
              </View>
              <Text style={styles.slipMonth}>{monthName}</Text>
              <Text style={styles.slipMeta}>Generated: {format(new Date(), 'dd MMM yyyy')}</Text>
              {paymentDate && (
                <Text style={styles.slipMeta}>Paid On: {format(new Date(paymentDate), 'dd MMM yyyy')}</Text>
              )}
            </View>
          </View>

          {/* Employee Info */}
          <View style={styles.empCard}>
            <Text style={styles.empCardTitle}>Employee Information</Text>
            <View style={styles.empGrid}>
              <View style={styles.empField}>
                <Text style={styles.empLabel}>Employee Name</Text>
                <Text style={styles.empValue}>{employeeName}</Text>
              </View>
              {employeeCode ? (
                <View style={styles.empField}>
                  <Text style={styles.empLabel}>Employee Code</Text>
                  <Text style={styles.empValue}>{employeeCode}</Text>
                </View>
              ) : null}
              <View style={styles.empField}>
                <Text style={styles.empLabel}>Designation</Text>
                <Text style={styles.empValue}>{designation || '—'}</Text>
              </View>
              <View style={styles.empField}>
                <Text style={styles.empLabel}>Department</Text>
                <Text style={styles.empValue}>{department || '—'}</Text>
              </View>
              <View style={styles.empField}>
                <Text style={styles.empLabel}>Pay Period</Text>
                <Text style={styles.empValue}>{monthName}</Text>
              </View>
              {bankAccount ? (
                <View style={styles.empField}>
                  <Text style={styles.empLabel}>Bank Account</Text>
                  <Text style={styles.empValue}>{bankAccount}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Earnings + Deductions side by side */}
          <View style={styles.twoCol}>
            {/* Earnings */}
            <View style={styles.col}>
              <Text style={styles.tableTitle}>Earnings</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Component</Text>
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Amount</Text>
              </View>
              {[
                { label: 'Basic Salary', value: basic },
                { label: 'HRA', value: hra },
                { label: 'Allowances', value: allowances },
                { label: 'Incentive', value: incentive },
              ].map((item, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={styles.tableLabel}>{item.label}</Text>
                  <Text style={styles.tableValue}>{fmt(item.value)}</Text>
                </View>
              ))}
              <View style={styles.tableTotalRow}>
                <Text style={styles.tableTotalLabel}>Gross Earnings</Text>
                <Text style={styles.tableTotalValue}>{fmt(gross)}</Text>
              </View>
            </View>

            {/* Deductions */}
            <View style={styles.col}>
              <Text style={styles.tableTitle}>Deductions</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Component</Text>
                <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Amount</Text>
              </View>
              {[
                { label: 'PF Deduction', value: pf },
                { label: 'TDS', value: tds },
                { label: 'Leave Deduction', value: leaveDeduction },
                { label: 'Other Deductions', value: otherDeductions },
              ].map((item, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={styles.tableLabel}>{item.label}</Text>
                  <Text style={styles.deductValue}>- {fmt(item.value)}</Text>
                </View>
              ))}
              <View style={styles.tableTotalRow}>
                <Text style={styles.tableTotalLabel}>Total Deductions</Text>
                <Text style={[styles.tableTotalValue, { color: '#dc2626' }]}>{fmt(totalDeductions)}</Text>
              </View>
            </View>
          </View>

          {/* Net Pay */}
          <View style={styles.netBox}>
            <View style={styles.netHeader}>
              <Text style={styles.netHeaderText}>Net Pay</Text>
            </View>
            <View style={styles.netBody}>
              <Text style={styles.netLabel}>Amount Payable for {monthName}</Text>
              <Text style={styles.netValue}>{fmt(net)}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLeft}>This is a computer-generated salary slip and does not require a physical signature.</Text>
              <Text style={styles.footerLeft}>For queries: info@admissionpath4u.com</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
        <View style={styles.bottomBar} />
      </Page>
    </Document>
  )
}
