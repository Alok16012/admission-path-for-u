'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Plus, Download, Plane, Upload, Pencil, Lock, Save, LayoutDashboard } from 'lucide-react';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import { supabase, isSupabaseConfigured } from '@/lib/invoice/supabaseClient';
import { computeTotals } from '@/lib/invoice/invoiceTotals';

// ── Types ──────────────────────────────────────────────────────────────────
export type GSTType = 'cgst_sgst' | 'igst' | 'none';

export interface CompanyInfo {
  logoUrl: string;
  name: string;
  tagline: string;
  gstin: string;
  phone: string;
  address: string;
  email: string;
  website: string;
}

export interface BillTo {
  name: string;
  gstin: string;
  address: string;
  mobile: string;
  placeOfSupply: string;
  stateCode: string;
}

export interface InvoiceInfo {
  invoiceNo: string;
  date: string;
}

export interface AirfareItem {
  id: string;
  type: 'airfare';
  description: string;
  customDesc: string;
  hsn: string;
  sector: string;
  travelDate: string;
  qty: number;
  rate: number;
  discount: number;
  pnrs: string;
  // Internal only — never shown on the invoice/PDF, used for profit tracking.
  cost: number;
  sell: number;
}

export interface ServiceItem {
  id: string;
  type: 'service';
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  discount: number;
  // Internal only — never shown on the invoice/PDF, used for profit tracking.
  cost: number;
  sell: number;
}

export interface DiscountItem {
  id: string;
  type: 'discount';
  description: string;
  amount: number;
}

export type InvoiceItem = AirfareItem | ServiceItem | DiscountItem;

export interface TaxSettings {
  gstType: GSTType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export interface PaymentInfo {
  previousDue: number;
  paidAmount: number;
  disclaimer: string;
  includeBankDetails: boolean;
  accountHolderName: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function initials(name: string, len = 2) {
  return name
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, len);
}

/** Auto-generate invoice number — format: EMT-DDMM-01 */
function generateInvoiceNo(companyName: string): string {
  const prefix = initials(companyName, 3) || 'EMT';
  const year = new Date().getFullYear();
  const storageKey = `inv_seq_${year}`;
  const seq = Number(localStorage.getItem(storageKey) || '0') + 1;
  localStorage.setItem(storageKey, String(seq));
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

function syncInvoiceSequence(invoiceNo: string) {
  const match = invoiceNo.trim().match(/(\d+)\s*$/);
  if (!match) return;

  const manualSeq = Number(match[1]);
  if (!Number.isFinite(manualSeq) || manualSeq < 1) return;

  const year = new Date().getFullYear();
  const storageKey = `inv_seq_${year}`;
  const currentSeq = Number(localStorage.getItem(storageKey) || '0');
  if (manualSeq > currentSeq) {
    localStorage.setItem(storageKey, String(manualSeq));
  }
}

function invoiceDraftKey() {
  return `inv_draft_${new Date().getFullYear()}`;
}

function getOrCreateDraftInvoiceNo(companyName: string): string {
  const draftKey = invoiceDraftKey();
  const saved = localStorage.getItem(draftKey);
  if (saved) return saved;

  const invoiceNo = generateInvoiceNo(companyName);
  localStorage.setItem(draftKey, invoiceNo);
  return invoiceNo;
}

function setDraftInvoiceNo(invoiceNo: string) {
  localStorage.setItem(invoiceDraftKey(), invoiceNo);
  syncInvoiceSequence(invoiceNo);
}

// ── Input component (reused across form) ──────────────────────────────────
function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full';

const selectCls =
  'bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full';

const ITEM_OPTIONS = [
  'Flight - Inventory / Blocks',
  'Service Charge',
  'Accommodation (Hotel)',
  'Package',
  'Visa',
  'Cabs / Bus / Transfers',
  'Activities / Tours / Sightseeing',
] as const;

type ItemOption = (typeof ITEM_OPTIONS)[number];

// ── IndexedDB helpers — no size limit, full-resolution logo persists across reloads ──
const IDB_NAME = 'emt_store';
const IDB_STORE = 'assets';
const LOGO_IDB_KEY = 'locked_logo';

function idbSet(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, LOGO_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbGet(): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx  = req.result.transaction(IDB_STORE, 'readonly');
      const get = tx.objectStore(IDB_STORE).get(LOGO_IDB_KEY);
      get.onsuccess = () => resolve(get.result as string | undefined);
      get.onerror   = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => {
      const tx = req.result.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(LOGO_IDB_KEY);
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

// ── Default values ─────────────────────────────────────────────────────────

const defaultCompany: CompanyInfo = {
  logoUrl: '/logo.png',
  name: 'Explore My Trip',
  tagline: "India's Leading Travel Agency",
  gstin: '09JAHPK7734R1ZL',
  phone: '+91 9650501173',
  address: 'G-090, Galleria Market, Noida Sector-27, Pincode-201301, UTTAR PRADESH',
  email: 'Info.exploremytrip@gmail.com',
  website: 'exploremytrip.com',
};

const defaultBillTo: BillTo = {
  name: '',
  gstin: '',
  address: '',
  mobile: '',
  placeOfSupply: '',
  stateCode: '',
};

const defaultTax: TaxSettings = {
  gstType: 'cgst_sgst',
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
};

const defaultPayment: PaymentInfo = {
  previousDue: 0,
  paidAmount: 0,
  disclaimer: 'PLEASE NOTE: THIS IS A SYSTEM GENERATED INVOICE. NO PHYSICAL SIGNATURE REQUIRED.',
  includeBankDetails: true,
  accountHolderName: 'Minan Ventures',
  bankName: 'Yes Bank',
  accountNo: '147461900001357',
  ifsc: 'YESB0001474',
  branch: 'ALPHA-2',
};

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Page() {
  const [company, setCompany] = useState<CompanyInfo>(defaultCompany);
  const [billTo, setBillTo] = useState<BillTo>(defaultBillTo);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({
    invoiceNo: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: uid(),
      type: 'airfare',
      description: ITEM_OPTIONS[0],
      customDesc: '',
      hsn: '996425',
      sector: '',
      travelDate: '',
      qty: 1,
      rate: 0,
      discount: 0,
      pnrs: '',
      cost: 0,
      sell: 0,
    } as AirfareItem,
    {
      id: uid(),
      type: 'service',
      description: 'Service Charge',
      hsn: '998559',
      qty: 1,
      rate: 0,
      discount: 0,
      cost: 0,
      sell: 0,
    } as ServiceItem,
    { id: uid(), type: 'discount', description: 'Extra Discount', amount: 0 } as DiscountItem,
  ]);
  const [tax, setTax] = useState<TaxSettings>(defaultTax);
  const [payment, setPayment] = useState<PaymentInfo>(defaultPayment);
  const [companyLocked, setCompanyLocked] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [gstMsg, setGstMsg] = useState('');

  // Restore the current draft invoice number + saved logo from IndexedDB.
  useEffect(() => {
    const no = getOrCreateDraftInvoiceNo(defaultCompany.name);
    setInvoiceInfo((prev) => ({ ...prev, invoiceNo: no }));
    // Restore full-resolution logo (stored in IndexedDB, no size limit).
    idbGet()
      .then((saved) => { if (saved) setCompany((c) => ({ ...c, logoUrl: saved })); })
      .catch(() => {/* ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Insert a new item, always keeping discount lines at the very end of the list.
  const insertItem = (item: InvoiceItem) => {
    setItems((p) => {
      if (item.type === 'discount') return [...p, item];
      const firstDiscount = p.findIndex((i) => i.type === 'discount');
      if (firstDiscount === -1) return [...p, item];
      return [...p.slice(0, firstDiscount), item, ...p.slice(firstDiscount)];
    });
  };

  const addItem = (type: InvoiceItem['type'], description?: string) => {
    if (type === 'airfare') {
      insertItem({
        id: uid(),
        type: 'airfare',
        description: description || ITEM_OPTIONS[0],
        customDesc: '',
        hsn: '996425',
        sector: '',
        travelDate: '',
        qty: 1,
        rate: 0,
        discount: 0,
        pnrs: '',
        cost: 0,
        sell: 0,
      } as AirfareItem);
    } else if (type === 'discount') {
      insertItem({ id: uid(), type: 'discount', description: 'Extra Discount', amount: 0 } as DiscountItem);
    } else {
      insertItem({
        id: uid(),
        type: 'service',
        description: description || 'Service Charge',
        hsn: '998559',
        qty: 1,
        rate: 0,
        discount: 0,
        cost: 0,
        sell: 0,
      } as ServiceItem);
    }
  };

  const addItemFromOption = (description: ItemOption) => {
    addItem(description === ITEM_OPTIONS[0] ? 'airfare' : 'service', description);
  };

  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const updateItem = useCallback((id: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? ({ ...item, ...patch } as InvoiceItem) : item))
    );
  }, []);

  const handleTicketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setExtracting(true);
    setExtractMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/invoice/extract-ticket', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) { setExtractMsg('Error: ' + data.error); return; }

      // Auto-fill bill-to with passenger name
      if (data.passengerName) {
        setBillTo((b) => ({ ...b, name: data.passengerName }));
      }

      // Auto-fill airfare item
      setItems((prev) => {
        const newItems = [...prev];
        const idx = newItems.findIndex((i) => i.type === 'airfare');
        const travelDate = data.travelDate || '';
        const sector = data.sector || `${data.fromCode || ''}-${data.toCode || ''}`;
        const pnr = data.pnr || '';
        const flight = data.flightNo || '';
        const desc = `${data.airline ? data.airline + ' ' : ''}${flight}`.trim() || 'Domestic Air Ticket';

        const patch = {
          description: 'Other' as const,
          customDesc: desc || 'Reimbursement of Airfare Charges',
          sector,
          travelDate,
          qty: 1,
          rate: data.baseFare || data.totalFare || 0,
          pnrs: pnr,
        };

        if (idx >= 0) {
          newItems[idx] = { ...newItems[idx], ...patch } as AirfareItem;
        } else {
          newItems.unshift({ id: uid(), type: 'airfare', hsn: '996425', discount: 0, cost: 0, sell: 0, ...patch } as AirfareItem);
        }
        return newItems;
      });

      setExtractMsg(`✓ Extracted: ${data.passengerName || ''} | ${data.sector || ''} | PNR: ${data.pnr || ''}`);
    } catch {
      setExtractMsg('Failed to extract. Check your API key.');
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  // Auto-fetch GST details when company GSTIN is 15 chars
  useEffect(() => {
    const g = company.gstin.trim().toUpperCase();
    if (g.length !== 15) return;
    setGstMsg('⏳ Fetching...');
    fetch(`/api/invoice/gst-lookup?gstin=${g}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setGstMsg(''); return; }
        setCompany((c) => ({
          ...c,
          name:    c.name    || data.tradeName || data.legalName || c.name,
          address: c.address || data.address   || c.address,
        }));
        setGstMsg(`✓ ${data.stateName} (${data.stateCode})`);
      })
      .catch(() => setGstMsg(''));
  }, [company.gstin]);

  // Auto-fetch GST details when Bill To GSTIN is 15 chars
  useEffect(() => {
    const g = billTo.gstin.trim().toUpperCase();
    if (g.length !== 15) return;
    fetch(`/api/invoice/gst-lookup?gstin=${g}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setBillTo((b) => ({
          ...b,
          address:       b.address || data.address || '',
          placeOfSupply: data.stateName || b.placeOfSupply,
          stateCode:     data.stateCode || b.stateCode,
          name:          b.name || data.tradeName || data.legalName,
        }));
      })
      .catch(() => {/* silent */});
  }, [billTo.gstin]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Show immediately at full resolution.
      setCompany((c) => ({ ...c, logoUrl: dataUrl }));
      // Persist in IndexedDB — no size limit, so large PNGs are fine.
      idbSet(dataUrl).catch(() => {/* ignore write errors */});
    };
    reader.readAsDataURL(f);
  };

  const resetLogo = () => {
    idbDelete().catch(() => {/* ignore */});
    setCompany((c) => ({ ...c, logoUrl: defaultCompany.logoUrl }));
  };

  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Save the current invoice snapshot to Supabase.
  const saveInvoice = async (): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      setSaveMsg('⚠ Database not configured');
      return false;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const totals = computeTotals(items, tax, payment);
      const { error } = await supabase.from('invoices').insert({
        invoice_no: invoiceInfo.invoiceNo || null,
        invoice_date: invoiceInfo.date || null,
        client_name: billTo.name || null,
        client_gstin: billTo.gstin || null,
        grand_total: totals.grandTotal,
        paid_amount: payment.paidAmount,
        balance_due: totals.balance,
        data: { company, billTo, invoiceInfo, items, tax, payment },
      });
      if (error) {
        setSaveMsg('Error: ' + error.message);
        return false;
      } else {
        setSaveMsg('✓ Saved to dashboard');
        return true;
      }
    } catch (e) {
      setSaveMsg('Failed to save: ' + (e as Error).message);
      return false;
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  // Native vector PDF — crisp standard fonts, tiny file size, no browser
  // header/footer. (Replaces the old html2canvas image approach.)
  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { generateInvoicePdf } = await import('@/components/invoice/invoicePdf');
      await generateInvoicePdf({ company, billTo, invoiceInfo, items, tax, payment });
    } finally {
      setDownloading(false);
    }
  };

  const saveAndDownload = async () => {
    const saved = await saveInvoice();
    if (!saved) return;
    await downloadPDF();
    // Advance to the next invoice number for the next invoice.
    const nextNo = generateInvoiceNo(company.name);
    setDraftInvoiceNo(nextNo);
    setInvoiceInfo((i) => ({ ...i, invoiceNo: nextNo }));
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 no-print">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Explore My Trip" className="h-10 w-auto object-contain" />
          <div>
            <div className="font-bold text-slate-100 text-sm">{company.name || 'Explore My Trip'}</div>
            <div className="text-xs text-slate-500">Invoice Generator</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className={`text-xs ${saveMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
          <a
            href="/invoice/dashboard"
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <LayoutDashboard size={15} /> Dashboard
          </a>
          <button
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            onClick={saveAndDownload}
            disabled={saving || downloading}
          >
            {saving ? <Save size={15} /> : <Download size={15} />}
            {saving ? 'Saving…' : downloading ? 'Downloading…' : 'Save & Download'}
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL (FORM) ── */}
        <div className="w-[560px] shrink-0 overflow-y-auto bg-slate-900 border-r border-slate-800 p-4 space-y-4 no-print">

          {/* Upload Ticket */}
          <section className="border-2 border-dashed border-blue-600 rounded-xl p-5 text-center bg-slate-800/40">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Upload size={18} className="text-slate-300" />
              </div>
            </div>
            <p className="font-semibold text-slate-200 text-sm">Upload Flight Ticket</p>
            <p className="text-xs text-slate-500 mb-3">AI automatically fills PNR, Date, Sector & Fare</p>
            <button
              onClick={() => ticketRef.current?.click()}
              disabled={extracting}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {extracting ? '⏳ Extracting...' : 'Select PDF or Image'}
            </button>
            <input
              ref={ticketRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleTicketUpload}
            />
            {extractMsg && (
              <p className={`mt-2 text-xs ${extractMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {extractMsg}
              </p>
            )}
          </section>

          {/* Company & Invoice Info */}
          <section className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-200 text-sm">Company &amp; Invoice Info</h2>
              <button
                onClick={() => setCompanyLocked((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  companyLocked
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {companyLocked ? (
                  <><Pencil size={12} /> Edit</>
                ) : (
                  <><Lock size={12} /> Lock</>
                )}
              </button>
            </div>

            {companyLocked ? (
              /* ── Locked / Display View ── */
              <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt="logo"
                    className="h-12 w-auto object-contain rounded shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-bold text-slate-100 truncate">{company.name}</p>
                  {company.tagline && <p className="text-xs text-blue-400">{company.tagline}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                    {company.gstin && <p className="text-xs text-slate-400"><span className="text-slate-500">GSTIN:</span> {company.gstin}</p>}
                    {company.phone && <p className="text-xs text-slate-400"><span className="text-slate-500">Ph:</span> {company.phone}</p>}
                    {company.email && <p className="text-xs text-slate-400 col-span-2 truncate"><span className="text-slate-500">Email:</span> {company.email}</p>}
                    {company.website && <p className="text-xs text-slate-400"><span className="text-slate-500">Web:</span> {company.website}</p>}
                    {company.address && <p className="text-xs text-slate-400 col-span-2 truncate"><span className="text-slate-500">Addr:</span> {company.address}</p>}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Editable Form ── */
              <>
                <Field label="Company Logo (Image)">
                  <div className="flex items-center gap-2 flex-wrap">
                    {company.logoUrl && (
                      <img
                        src={company.logoUrl}
                        alt="logo preview"
                        className="h-9 w-auto object-contain rounded bg-white/5 px-1 shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-2 rounded-md transition-colors"
                    >
                      Choose file
                    </button>
                    {company.logoUrl && company.logoUrl !== defaultCompany.logoUrl && (
                      <button
                        onClick={resetLogo}
                        className="text-xs text-slate-400 hover:text-red-400 px-2 py-2 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                  </div>
                  <span className="text-xs text-emerald-400 mt-1 inline-block">
                    {company.logoUrl && company.logoUrl !== defaultCompany.logoUrl
                      ? '🔒 Locked — this logo is saved & will show on every invoice'
                      : 'Upload a logo to lock it as your default'}
                  </span>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company Name">
                    <input className={inputCls} value={company.name}
                      onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} />
                  </Field>
                  <Field label="Tagline">
                    <input className={inputCls} value={company.tagline}
                      onChange={(e) => setCompany((c) => ({ ...c, tagline: e.target.value }))} />
                  </Field>
                  <Field label="GSTIN">
                    <input className={inputCls} value={company.gstin}
                      onChange={(e) => setCompany((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                      placeholder="09JAHPK7734R1ZL" maxLength={15} />
                    {gstMsg && (
                      <span className={`text-xs mt-0.5 ${gstMsg.startsWith('✓') ? 'text-green-400' : 'text-slate-400'}`}>
                        {gstMsg}
                      </span>
                    )}
                  </Field>
                  <Field label="Phone">
                    <input className={inputCls} value={company.phone}
                      onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Address">
                  <input className={inputCls} value={company.address}
                    onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input className={inputCls} type="email" value={company.email}
                      onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
                  </Field>
                  <Field label="Website">
                    <input className={inputCls} value={company.website}
                      onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))} />
                  </Field>
                </div>
              </>
            )}
          </section>

          {/* Bill To */}
          <Section title="Bill To">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client / Company Name">
                <input className={inputCls} value={billTo.name}
                  onChange={(e) => setBillTo((b) => ({ ...b, name: e.target.value }))} />
              </Field>
              <Field label="Client GSTIN">
                <input className={inputCls} value={billTo.gstin}
                  onChange={(e) => setBillTo((b) => ({ ...b, gstin: e.target.value.toUpperCase() }))}
                  placeholder="Auto-fills state & name"
                  maxLength={15} />
              </Field>
              <Field label="Address">
                <input className={inputCls} value={billTo.address}
                  onChange={(e) => setBillTo((b) => ({ ...b, address: e.target.value }))} />
              </Field>
              <Field label="Mobile Number">
                <input className={inputCls} value={billTo.mobile}
                  onChange={(e) => setBillTo((b) => ({ ...b, mobile: e.target.value }))}
                  placeholder="+91 98765 43210" />
              </Field>
              <Field label="State Code">
                <input className={inputCls} value={billTo.stateCode}
                  onChange={(e) => setBillTo((b) => ({ ...b, stateCode: e.target.value }))} />
              </Field>
            </div>
          </Section>

          {/* Invoice Meta */}
          <Section title="Invoice Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice No (Auto-Generated)">
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1 bg-slate-700 text-blue-300 font-mono text-xs`}
                    value={invoiceInfo.invoiceNo}
                    onChange={(e) => {
                      const invoiceNo = e.target.value;
                      setDraftInvoiceNo(invoiceNo);
                      setInvoiceInfo((i) => ({ ...i, invoiceNo }));
                    }}
                    placeholder="Fill Company & Client name first"
                  />
                  <button
                    title="Regenerate"
                    onClick={() => {
                      const invoiceNo = generateInvoiceNo(company.name);
                      setDraftInvoiceNo(invoiceNo);
                      setInvoiceInfo((i) => ({
                        ...i,
                        invoiceNo,
                      }));
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-2 rounded-md text-xs transition-colors"
                  >
                    ↺
                  </button>
                </div>
              </Field>
              <Field label="Date">
                <input className={inputCls} type="date" value={invoiceInfo.date}
                  onChange={(e) => setInvoiceInfo((i) => ({ ...i, date: e.target.value }))} />
              </Field>
            </div>
          </Section>

          {/* Items */}
          <Section title="Items">
            {items.map((item, idx) => (
              <ItemRow key={item.id} item={item} index={idx} onUpdate={updateItem} onRemove={removeItem} />
            ))}
            <div className="flex gap-2 pt-1">
              <div className="relative flex items-center">
                <Plus size={13} className="pointer-events-none absolute left-3 text-slate-300" />
                <select
                  className={`${selectCls} pl-8 text-xs text-slate-300`}
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value as ItemOption;
                    if (!value) return;
                    addItemFromOption(value);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>Add Item</option>
                  {ITEM_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => addItem('discount')}
                className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors">
                <Plus size={13} /> Add Discount
              </button>
            </div>
          </Section>

          {/* Tax Settings */}
          <TaxSection tax={tax} items={items} onTaxChange={setTax} />

          {/* Footer & Payments */}
          <Section title="Footer & Payments">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Previous Due (₹)">
                <input className={inputCls} type="number" value={payment.previousDue || ''}
                  placeholder="0"
                  onChange={(e) => setPayment((p) => ({ ...p, previousDue: +e.target.value }))} />
              </Field>
              <Field label="Paid Amount (₹)">
                <input className={inputCls} type="number" value={payment.paidAmount || ''}
                  placeholder="0"
                  onChange={(e) => setPayment((p) => ({ ...p, paidAmount: +e.target.value }))} />
              </Field>
            </div>
            <Field label="Disclaimer / Notes">
              <textarea className={`${inputCls} resize-y`} rows={3} value={payment.disclaimer}
                onChange={(e) => setPayment((p) => ({ ...p, disclaimer: e.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={payment.includeBankDetails}
                onChange={(e) => setPayment((p) => ({ ...p, includeBankDetails: e.target.checked }))}
                className="rounded" />
              Include Bank Details in Footer
            </label>
            {payment.includeBankDetails && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account Holder Name" className="col-span-2">
                  <input className={inputCls} value={payment.accountHolderName}
                    placeholder="e.g. Explore My Trip"
                    onChange={(e) => setPayment((p) => ({ ...p, accountHolderName: e.target.value }))} />
                </Field>
                <Field label="Bank Name">
                  <input className={inputCls} value={payment.bankName}
                    onChange={(e) => setPayment((p) => ({ ...p, bankName: e.target.value }))} />
                </Field>
                <Field label="Account No">
                  <input className={inputCls} value={payment.accountNo}
                    onChange={(e) => setPayment((p) => ({ ...p, accountNo: e.target.value }))} />
                </Field>
                <Field label="IFSC">
                  <input className={inputCls} value={payment.ifsc}
                    onChange={(e) => setPayment((p) => ({ ...p, ifsc: e.target.value }))} />
                </Field>
                <Field label="Branch">
                  <input className={inputCls} value={payment.branch}
                    onChange={(e) => setPayment((p) => ({ ...p, branch: e.target.value }))} />
                </Field>
              </div>
            )}
          </Section>
        </div>

        {/* ── RIGHT PANEL (PREVIEW) ── */}
        <div className="flex-1 overflow-y-auto bg-slate-800 p-6 flex justify-center">
          <InvoicePreview
            company={company}
            billTo={billTo}
            invoiceInfo={invoiceInfo}
            items={items}
            tax={tax}
            payment={payment}
          />
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-800 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-slate-200 text-sm">{title}</h2>
      {children}
    </section>
  );
}

// ── Per-item row ───────────────────────────────────────────────────────────
function ItemRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: InvoiceItem;
  index: number;
  onUpdate: (id: string, patch: Partial<InvoiceItem>) => void;
  onRemove: (id: string) => void;
}) {
  const label =
    item.type === 'airfare' ? 'FLIGHT' : item.type === 'discount' ? 'DISCOUNT' : 'ITEM';
  const color =
    item.type === 'airfare'
      ? 'text-blue-400'
      : item.type === 'discount'
      ? 'text-red-400'
      : 'text-green-400';

  return (
    <div className="border border-slate-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${color}`}>
          #{index + 1} — {label}
        </span>
        <button onClick={() => onRemove(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {item.type === 'airfare' && (
        <AirfareFields item={item} onUpdate={onUpdate} />
      )}
      {item.type === 'service' && (
        <ServiceFields item={item} onUpdate={onUpdate} />
      )}
      {item.type === 'discount' && (
        <DiscountFields item={item} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function AirfareFields({ item, onUpdate }: { item: AirfareItem; onUpdate: (id: string, p: Partial<AirfareItem>) => void }) {
  return (
    <>
      <Field label="Description">
        <select className={selectCls} value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })}>
          {ITEM_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
          <option>Other</option>
        </select>
      </Field>
      {item.description === 'Other' && (
        <Field label="Custom Description">
          <input className={inputCls} value={item.customDesc}
            onChange={(e) => onUpdate(item.id, { customDesc: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="HSN/SAC">
          <input className={inputCls} value={item.hsn}
            onChange={(e) => onUpdate(item.id, { hsn: e.target.value })} />
        </Field>
        <Field label="Sector">
          <input className={inputCls} value={item.sector} placeholder="e.g. IXR-BOM"
            onChange={(e) => onUpdate(item.id, { sector: e.target.value })} />
        </Field>
        <Field label="Travel Date">
          <input className={inputCls} type="date" value={item.travelDate}
            onChange={(e) => onUpdate(item.id, { travelDate: e.target.value })} />
        </Field>
        <Field label="Qty (Pax)">
          <input className={inputCls} type="number" min={1} value={item.qty}
            onChange={(e) => onUpdate(item.id, { qty: +e.target.value })} />
        </Field>
        <Field label="Rate (₹)">
          <input className={inputCls} type="number" min={0} value={item.rate || ''}
            placeholder="0"
            onChange={(e) => onUpdate(item.id, { rate: +e.target.value })} />
        </Field>
        <Field label="Discount (₹)">
          <input className={inputCls} type="number" min={0} value={item.discount || ''}
            placeholder="0"
            onChange={(e) => onUpdate(item.id, { discount: +e.target.value })} />
        </Field>
      </div>
      <Field label="PNRs (comma separated)">
        <input className={inputCls} value={item.pnrs} placeholder="WVF7MR, I6V6WJ, ..."
          onChange={(e) => onUpdate(item.id, { pnrs: e.target.value })} />
      </Field>
      <ProfitFields cost={item.cost} sell={item.sell}
        onChange={(patch) => onUpdate(item.id, patch)} />
    </>
  );
}

// Internal-only cost / selling price — never rendered on the invoice or PDF.
function ProfitFields({
  cost,
  sell,
  onChange,
}: {
  cost: number;
  sell: number;
  onChange: (patch: { cost?: number; sell?: number }) => void;
}) {
  const profit = (sell || 0) - (cost || 0);
  return (
    <div className="rounded-md border border-dashed border-amber-700/60 bg-amber-950/20 p-2 space-y-2">
      <div className="text-[11px] text-amber-400">🔒 Internal only — not shown on the invoice</div>
      <div className="grid grid-cols-3 gap-2 items-end">
        <Field label="Cost Price (₹)">
          <input className={inputCls} type="number" min={0} value={cost || ''} placeholder="0"
            onChange={(e) => onChange({ cost: +e.target.value })} />
        </Field>
        <Field label="Selling Price (₹)">
          <input className={inputCls} type="number" min={0} value={sell || ''} placeholder="0"
            onChange={(e) => onChange({ sell: +e.target.value })} />
        </Field>
        <Field label="Profit (₹)">
          <div className={`px-3 py-2 rounded-md text-sm font-medium ${profit >= 0 ? 'text-green-400' : 'text-red-400'} bg-slate-800 border border-slate-700`}>
            {profit.toFixed(2)}
          </div>
        </Field>
      </div>
    </div>
  );
}

function ServiceFields({ item, onUpdate }: { item: ServiceItem; onUpdate: (id: string, p: Partial<ServiceItem>) => void }) {
  return (
    <>
      <Field label="Description">
        <select className={selectCls} value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })}>
          {ITEM_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="HSN/SAC">
          <input className={inputCls} value={item.hsn}
            onChange={(e) => onUpdate(item.id, { hsn: e.target.value })} />
        </Field>
        <Field label="Qty">
          <input className={inputCls} type="number" min={1} value={item.qty}
            onChange={(e) => onUpdate(item.id, { qty: +e.target.value })} />
        </Field>
        <Field label="Rate (₹)">
          <input className={inputCls} type="number" min={0} value={item.rate || ''}
            placeholder="0"
            onChange={(e) => onUpdate(item.id, { rate: +e.target.value })} />
        </Field>
        <Field label="Discount (₹)">
          <input className={inputCls} type="number" min={0} value={item.discount || ''}
            placeholder="0"
            onChange={(e) => onUpdate(item.id, { discount: +e.target.value })} />
        </Field>
      </div>
      <p className="text-xs text-green-400">✓ GST is included within this amount (extracted, not added) as per Tax Settings</p>
      <ProfitFields cost={item.cost} sell={item.sell}
        onChange={(patch) => onUpdate(item.id, patch)} />
    </>
  );
}

function DiscountFields({ item, onUpdate }: { item: DiscountItem; onUpdate: (id: string, p: Partial<DiscountItem>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Description">
        <input className={inputCls} value={item.description}
          onChange={(e) => onUpdate(item.id, { description: e.target.value })} />
      </Field>
      <Field label="Discount Amount (₹)">
        <input className={inputCls} type="number" min={0} value={item.amount || ''}
          placeholder="0"
          onChange={(e) => onUpdate(item.id, { amount: +e.target.value })} />
      </Field>
    </div>
  );
}

// ── Tax Settings Section ───────────────────────────────────────────────────
function TaxSection({
  tax,
  items,
  onTaxChange,
}: {
  tax: TaxSettings;
  items: InvoiceItem[];
  onTaxChange: (t: TaxSettings) => void;
}) {
  // Tax ONLY on service charge items — GST is INCLUSIVE (extracted from amount)
  const taxableAmount = items
    .filter((i): i is ServiceItem => i.type === 'service')
    .reduce((sum, i) => sum + (i.qty * i.rate - i.discount), 0);

  const cgstBase = tax.gstType === 'cgst_sgst'
    ? taxableAmount / (1 + (tax.cgstRate + tax.sgstRate) / 100)
    : taxableAmount;
  const cgst = tax.gstType === 'cgst_sgst' ? (cgstBase * tax.cgstRate) / 100 : 0;
  const sgst = tax.gstType === 'cgst_sgst' ? (cgstBase * tax.sgstRate) / 100 : 0;
  const igst = tax.gstType === 'igst'
    ? taxableAmount - taxableAmount / (1 + tax.igstRate / 100)
    : 0;

  const airfareTotal = items
    .filter((i): i is AirfareItem => i.type === 'airfare')
    .reduce((sum, i) => sum + (i.qty * i.rate - i.discount), 0);

  const discountTotal = items
    .filter((i): i is DiscountItem => i.type === 'discount')
    .reduce((sum, i) => sum + i.amount, 0);

  // GST is already inside taxableAmount — do NOT add it again.
  const grandTotal = airfareTotal + taxableAmount - discountTotal;

  return (
    <section className="bg-slate-800 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-slate-200 text-sm">Tax Settings &amp; Summary</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="GST Type">
          <select className={selectCls} value={tax.gstType}
            onChange={(e) => onTaxChange({ ...tax, gstType: e.target.value as GSTType })}>
            <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
            <option value="igst">IGST (Inter-state)</option>
            <option value="none">No GST (Exempt)</option>
          </select>
        </Field>
        {tax.gstType === 'cgst_sgst' && (
          <>
            <Field label="CGST Rate (%)">
              <input className={inputCls} type="number" min={0} max={100} value={tax.cgstRate}
                onChange={(e) => onTaxChange({ ...tax, cgstRate: +e.target.value })} />
            </Field>
            <Field label="SGST Rate (%)">
              <input className={inputCls} type="number" min={0} max={100} value={tax.sgstRate}
                onChange={(e) => onTaxChange({ ...tax, sgstRate: +e.target.value })} />
            </Field>
          </>
        )}
        {tax.gstType === 'igst' && (
          <Field label="IGST Rate (%)">
            <input className={inputCls} type="number" min={0} max={100} value={tax.igstRate}
              onChange={(e) => onTaxChange({ ...tax, igstRate: +e.target.value })} />
          </Field>
        )}
      </div>
      <p className="text-xs text-green-400">✓ GST is extracted from Service Charges (inclusive — not added on top) — Airfare is tax-exempt</p>
      <div className="border-t border-slate-700 pt-3 space-y-1 text-sm">
        <Row label="Airfare Total" value={airfareTotal} />
        <Row label="Service Charges (Taxable)" value={taxableAmount} />
        {tax.gstType === 'cgst_sgst' && (
          <>
            <Row label={`Total CGST (${tax.cgstRate}%)`} value={cgst} />
            <Row label={`Total SGST (${tax.sgstRate}%)`} value={sgst} />
          </>
        )}
        {tax.gstType === 'igst' && <Row label={`Total IGST (${tax.igstRate}%)`} value={igst} />}
        {discountTotal > 0 && <Row label="Total Discount" value={-discountTotal} />}
        <div className="flex justify-between font-bold text-blue-400 pt-1 border-t border-slate-700">
          <span>Grand Total</span>
          <span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-300">
      <span>{label}</span>
      <span>₹{value.toFixed(2)}</span>
    </div>
  );
}
