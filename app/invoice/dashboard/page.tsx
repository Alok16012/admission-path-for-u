'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Download, Trash2, Search, FileText, Wallet, AlertCircle, RefreshCw, TrendingUp,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, type InvoiceRow } from '@/lib/invoice/supabaseClient';
import { computeProfit } from '@/lib/invoice/invoiceTotals';
import type {
  AirfareItem,
  BillTo,
  DiscountItem,
  InvoiceItem,
  PaymentInfo,
  ServiceItem,
  TaxSettings,
} from '@/app/invoice/page';

type InvoiceSnapshot = {
  billTo?: Partial<BillTo>;
  items?: InvoiceItem[];
  tax?: Partial<TaxSettings>;
  payment?: Partial<PaymentInfo>;
};

type SaleRegisterRow = {
  invoiceDate: string | null;
  invoiceNo: string;
  travelDate: string | null;
  partyName: string;
  gstin: string;
  partyType: 'Registered' | 'Unregistered';
  state: string;
  airfare: number;
  serviceCharges: number;
  qty: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  invoiceValue: number;
  amountReceived: number;
  pendingBalance: number;
  modeOfPayment: string;
  hsn: string;
  remarks: string;
  profitLoss: number;
};

// The stored snapshot keeps the full item list (incl. internal cost/sell).
function rowProfit(r: InvoiceRow): number {
  const items = (r.data as { items?: InvoiceItem[] } | null)?.items;
  return Array.isArray(items) ? computeProfit(items) : 0;
}

function fmtMoney(n: number | null) {
  return 'Rs. ' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNumber(n: number | null) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d.slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

function getSnapshot(r: InvoiceRow): InvoiceSnapshot {
  return (r.data || {}) as InvoiceSnapshot;
}

function isValidGstin(gstin: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
}

function buildSaleRegisterRow(r: InvoiceRow): SaleRegisterRow {
  const snapshot = getSnapshot(r);
  const billTo = snapshot.billTo || {};
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const tax = snapshot.tax || {};
  const payment = snapshot.payment || {};

  let airfare = 0;
  let serviceCharges = 0;
  let qty = 0;
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let discount = 0;
  const hsns = new Set<string>();
  const remarks: string[] = [];
  const travelDates: string[] = [];

  for (const item of items) {
    if (item.type === 'airfare') {
      const ai = item as AirfareItem;
      const amount = ai.qty * ai.rate;
      const desc = ai.description === 'Other' ? ai.customDesc : ai.description;
      airfare += amount;
      qty += ai.qty || 0;
      discount += ai.discount || 0;
      if (ai.hsn) hsns.add(ai.hsn);
      if (ai.travelDate) travelDates.push(ai.travelDate);
      remarks.push([desc, ai.sector && `Sector: ${ai.sector}`, ai.pnrs && `PNR: ${ai.pnrs}`].filter(Boolean).join(' | '));
    } else if (item.type === 'service') {
      const si = item as ServiceItem;
      const gross = si.qty * si.rate;
      const net = gross - si.discount;
      serviceCharges += gross;
      qty += si.qty || 0;
      discount += si.discount || 0;
      if (si.hsn) hsns.add(si.hsn);
      if (si.description) remarks.push(si.description);

      if (tax.gstType === 'cgst_sgst') {
        const rate = ((tax.cgstRate || 0) + (tax.sgstRate || 0)) / 100;
        const base = rate ? net / (1 + rate) : net;
        taxableValue += base;
        cgst += (base * (tax.cgstRate || 0)) / 100;
        sgst += (base * (tax.sgstRate || 0)) / 100;
      } else if (tax.gstType === 'igst') {
        const rate = (tax.igstRate || 0) / 100;
        const base = rate ? net / (1 + rate) : net;
        taxableValue += base;
        igst += net - base;
      }
    } else {
      const di = item as DiscountItem;
      discount += di.amount || 0;
      if (di.description) remarks.push(di.description);
    }
  }

  const gstin = (r.client_gstin || billTo.gstin || '').trim().toUpperCase();
  const paymentAny = payment as PaymentInfo & { modeOfPayment?: string; paymentMode?: string };
  const invoiceValue = r.grand_total || airfare + serviceCharges - discount + (payment.previousDue || 0);
  const amountReceived = r.paid_amount || payment.paidAmount || 0;
  const pendingBalance = r.balance_due ?? invoiceValue - amountReceived;
  const gstRate =
    tax.gstType === 'cgst_sgst'
      ? ((tax.cgstRate || 0) + (tax.sgstRate || 0)) / 100
      : tax.gstType === 'igst'
      ? (tax.igstRate || 0) / 100
      : 0;

  return {
    invoiceDate: r.invoice_date,
    invoiceNo: r.invoice_no || '',
    travelDate: travelDates[0] || null,
    partyName: r.client_name || billTo.name || '',
    gstin: gstin || 'NA',
    partyType: isValidGstin(gstin) ? 'Registered' : 'Unregistered',
    state: billTo.placeOfSupply || billTo.stateCode || '',
    airfare,
    serviceCharges,
    qty,
    taxableValue,
    gstRate,
    cgst,
    sgst,
    igst,
    discount,
    invoiceValue,
    amountReceived,
    pendingBalance,
    modeOfPayment: paymentAny.modeOfPayment || paymentAny.paymentMode || 'Cash/UPI/BANK',
    hsn: Array.from(hsns).join(', '),
    remarks: Array.from(new Set(remarks.filter(Boolean))).join(' | '),
    profitLoss: rowProfit(r),
  };
}

function excelDate(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB');
}

function downloadExcel(rows: SaleRegisterRow[]) {
  const headers = [
    'Invoice Date',
    'Invoice No',
    'Travel/Ticket Date',
    'Party Name',
    'GSTIN',
    'Party Type',
    'State',
    'Reimbursement of Airfare Charges',
    'Service Charges',
    'PP (Per Person) (QTY)',
    'Taxable Value',
    'GST Rate',
    'CGST',
    'SGST',
    'IGST',
    'Discount',
    'Invoice Value',
    'Amount Received',
    'Pending Balance',
    'Mode of Payment',
    'HSN',
    'Remarks / Description',
    'Profit / Loss',
  ];
  const escape = (value: string | number) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const num = (value: number) => Number(value || 0).toFixed(2);
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1">
    <thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr>
          <td>${escape(excelDate(r.invoiceDate))}</td>
          <td>${escape(r.invoiceNo)}</td>
          <td>${escape(excelDate(r.travelDate))}</td>
          <td>${escape(r.partyName)}</td>
          <td>${escape(r.gstin)}</td>
          <td>${escape(r.partyType)}</td>
          <td>${escape(r.state)}</td>
          <td>${num(r.airfare)}</td>
          <td>${num(r.serviceCharges)}</td>
          <td>${num(r.qty)}</td>
          <td>${num(r.taxableValue)}</td>
          <td>${num(r.gstRate)}</td>
          <td>${num(r.cgst)}</td>
          <td>${num(r.sgst)}</td>
          <td>${num(r.igst)}</td>
          <td>${num(r.discount)}</td>
          <td>${num(r.invoiceValue)}</td>
          <td>${num(r.amountReceived)}</td>
          <td>${num(r.pendingBalance)}</td>
          <td>${escape(r.modeOfPayment)}</td>
          <td>${escape(r.hsn)}</td>
          <td>${escape(r.remarks)}</td>
          <td>${num(r.profitLoss)}</td>
        </tr>`
      )
      .join('')}</tbody>
  </table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GST_Sale_Register_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyType, setPartyType] = useState<'all' | 'Registered' | 'Unregistered'>('all');
  const [stateFilter, setStateFilter] = useState('all');

  const load = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErr('Database not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    else setRows((data as InvoiceRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const registerRows = useMemo(() => rows.map(buildSaleRegisterRow), [rows]);

  const states = useMemo(
    () => Array.from(new Set(registerRows.map((r) => r.state).filter(Boolean))).sort(),
    [registerRows]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const register = buildSaleRegisterRow(r);
      const invoiceDate = toDateInput(r.invoice_date);
      const matchesSearch =
        !s ||
        (r.invoice_no || '').toLowerCase().includes(s) ||
        (r.client_name || '').toLowerCase().includes(s) ||
        (r.client_gstin || '').toLowerCase().includes(s) ||
        register.state.toLowerCase().includes(s) ||
        register.remarks.toLowerCase().includes(s);
      const matchesFrom = !fromDate || invoiceDate >= fromDate;
      const matchesTo = !toDate || invoiceDate <= toDate;
      const matchesParty = partyType === 'all' || register.partyType === partyType;
      const matchesState = stateFilter === 'all' || register.state === stateFilter;
      return matchesSearch && matchesFrom && matchesTo && matchesParty && matchesState;
    });
  }, [rows, q, fromDate, toDate, partyType, stateFilter]);

  const filteredRegisterRows = useMemo(() => filtered.map(buildSaleRegisterRow), [filtered]);

  const stats = useMemo(() => {
    const total = filteredRegisterRows.reduce((s, r) => s + r.invoiceValue, 0);
    const paid = filteredRegisterRows.reduce((s, r) => s + r.amountReceived, 0);
    const due = filteredRegisterRows.reduce((s, r) => s + r.pendingBalance, 0);
    const profit = filteredRegisterRows.reduce((s, r) => s + r.profitLoss, 0);
    return { count: filteredRegisterRows.length, total, paid, due, profit };
  }, [filteredRegisterRows]);

  const downloadRow = async (r: InvoiceRow) => {
    try {
      const { generateInvoicePdf } = await import('@/components/invoice/invoicePdf');
      // The stored snapshot already matches the generator's input shape.
      await generateInvoicePdf(r.data as Parameters<typeof generateInvoicePdf>[0]);
    } catch (e) {
      alert('Could not generate PDF: ' + (e as Error).message);
    }
  };

  const deleteRow = async (r: InvoiceRow) => {
    if (!supabase) return;
    if (!confirm(`Delete invoice ${r.invoice_no || ''}? This cannot be undone.`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', r.id);
    if (error) alert('Delete failed: ' + error.message);
    else setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-auto object-contain" />
          <div>
            <div className="font-bold text-sm">Invoice Dashboard</div>
            <div className="text-xs text-slate-500">All saved invoices</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => downloadExcel(filteredRegisterRows)}
            disabled={filteredRegisterRows.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={15} /> Download Excel
          </button>
          <Link
            href="/invoice"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <ArrowLeft size={15} /> New Invoice
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={<FileText size={18} />} label="Invoices" value={String(stats.count)} accent="text-blue-400" />
          <StatCard icon={<Wallet size={18} />} label="Total Billed" value={fmtMoney(stats.total)} accent="text-emerald-400" />
          <StatCard icon={<Wallet size={18} />} label="Total Paid" value={fmtMoney(stats.paid)} accent="text-green-400" />
          <StatCard icon={<AlertCircle size={18} />} label="Outstanding" value={fmtMoney(stats.due)} accent="text-red-400" />
          <StatCard icon={<TrendingUp size={18} />} label="Total Profit" value={fmtMoney(stats.profit)} accent="text-amber-400" />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.9fr_auto] gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice, client, GSTIN, state or remarks…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <select
            value={partyType}
            onChange={(e) => setPartyType(e.target.value as typeof partyType)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Parties</option>
            <option value="Registered">Registered</option>
            <option value="Unregistered">Unregistered</option>
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All States</option>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setQ('');
              setFromDate('');
              setToDate('');
              setPartyType('all');
              setStateFilter('all');
            }}
            className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2.5 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {err && (
            <div className="p-4 text-sm text-red-400 bg-red-950/30 border-b border-red-900">{err}</div>
          )}
          {loading ? (
            <div className="p-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">
              {rows.length === 0 ? 'No invoices saved yet. Create one and hit Save.' : 'No matches.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2200px] text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                    <th className="text-left font-semibold px-3 py-3">Invoice Date</th>
                    <th className="text-left font-semibold px-3 py-3">Invoice No</th>
                    <th className="text-left font-semibold px-3 py-3">Travel Date</th>
                    <th className="text-left font-semibold px-3 py-3">Party Name</th>
                    <th className="text-left font-semibold px-3 py-3">GSTIN</th>
                    <th className="text-left font-semibold px-3 py-3">Party Type</th>
                    <th className="text-left font-semibold px-3 py-3">State</th>
                    <th className="text-right font-semibold px-3 py-3">Airfare</th>
                    <th className="text-right font-semibold px-3 py-3">Service</th>
                    <th className="text-right font-semibold px-3 py-3">Qty</th>
                    <th className="text-right font-semibold px-3 py-3">Taxable</th>
                    <th className="text-right font-semibold px-3 py-3">GST Rate</th>
                    <th className="text-right font-semibold px-3 py-3">CGST</th>
                    <th className="text-right font-semibold px-3 py-3">SGST</th>
                    <th className="text-right font-semibold px-3 py-3">IGST</th>
                    <th className="text-right font-semibold px-3 py-3">Discount</th>
                    <th className="text-right font-semibold px-3 py-3">Invoice Value</th>
                    <th className="text-right font-semibold px-3 py-3">Received</th>
                    <th className="text-right font-semibold px-3 py-3">Pending</th>
                    <th className="text-left font-semibold px-3 py-3">Mode</th>
                    <th className="text-left font-semibold px-3 py-3">HSN</th>
                    <th className="text-left font-semibold px-3 py-3">Remarks</th>
                    <th className="text-right font-semibold px-3 py-3">Profit / Loss</th>
                    <th className="text-right font-semibold px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const register = buildSaleRegisterRow(r);
                    return (
                      <tr key={r.id} className="border-t border-slate-700/70 hover:bg-slate-700/30">
                        <td className="px-3 py-3 text-slate-300">{fmtDate(register.invoiceDate)}</td>
                        <td className="px-3 py-3 font-mono text-blue-300">{register.invoiceNo || '—'}</td>
                        <td className="px-3 py-3 text-slate-300">{fmtDate(register.travelDate)}</td>
                        <td className="px-3 py-3 text-slate-200">{register.partyName || '—'}</td>
                        <td className="px-3 py-3 text-slate-300">{register.gstin}</td>
                        <td className="px-3 py-3 text-slate-300">{register.partyType}</td>
                        <td className="px-3 py-3 text-slate-300">{register.state || '—'}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.airfare)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.serviceCharges)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.qty)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.taxableValue)}</td>
                        <td className="px-3 py-3 text-right">{fmtPercent(register.gstRate)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.cgst)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.sgst)}</td>
                        <td className="px-3 py-3 text-right">{fmtNumber(register.igst)}</td>
                        <td className="px-3 py-3 text-right text-red-300">{fmtNumber(register.discount)}</td>
                        <td className="px-3 py-3 text-right font-medium">{fmtNumber(register.invoiceValue)}</td>
                        <td className="px-3 py-3 text-right text-green-400">{fmtNumber(register.amountReceived)}</td>
                        <td className={`px-3 py-3 text-right font-medium ${register.pendingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {fmtNumber(register.pendingBalance)}
                        </td>
                        <td className="px-3 py-3 text-slate-300">{register.modeOfPayment}</td>
                        <td className="px-3 py-3 text-slate-300">{register.hsn || '—'}</td>
                        <td className="px-3 py-3 text-slate-300 max-w-[260px] truncate" title={register.remarks}>{register.remarks || '—'}</td>
                        <td className={`px-3 py-3 text-right font-medium ${register.profitLoss >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {fmtNumber(register.profitLoss)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => downloadRow(r)}
                              title="Download PDF"
                              className="p-1.5 rounded-md bg-slate-700 hover:bg-blue-600 transition-colors"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => deleteRow(r)}
                              title="Delete"
                              className="p-1.5 rounded-md bg-slate-700 hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className={`flex items-center gap-2 ${accent}`}>
        {icon}
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-slate-100">{value}</div>
    </div>
  );
}
