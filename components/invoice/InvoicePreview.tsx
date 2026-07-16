'use client';

import type {
  CompanyInfo,
  BillTo,
  InvoiceInfo,
  InvoiceItem,
  TaxSettings,
  PaymentInfo,
  AirfareItem,
  ServiceItem,
  DiscountItem,
} from '@/app/invoice/page';

interface Props {
  company: CompanyInfo;
  billTo: BillTo;
  invoiceInfo: InvoiceInfo;
  items: InvoiceItem[];
  tax: TaxSettings;
  payment: PaymentInfo;
}

// ── Color palette (explicit hex — html2canvas can't parse Tailwind's oklch) ──
const C = {
  brand: '#5BBDE0',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  red300: '#fca5a5',
  red500: '#ef4444',
  red600: '#dc2626',
  blue100: '#dbeafe',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  green600: '#16a34a',
} as const;

function fmt(n: number) {
  return n.toFixed(2);
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)}${months[Number(m) - 1]}'${y.slice(2)}`;
}

function fmtDisplayDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

// Break a long address into 2 lines (just before "Pincode" / "Pin").
function splitAddress(addr: string): string[] {
  const m = addr.match(/,?\s*(Pin(?:code)?\b)/i);
  if (m && m.index && m.index > 0) {
    const l1 = addr.slice(0, m.index).replace(/[,\s]+$/, '');
    const l2 = addr.slice(m.index).replace(/^[,\s]+/, '');
    return [l1, l2];
  }
  return [addr];
}

export default function InvoicePreview({ company, billTo, invoiceInfo, items, tax, payment }: Props) {
  // ── Per-row tax calculation ──
  // Tax ONLY on 'service' type items — airfare and discount have no tax
  const rows = items.map((item, idx) => {
    if (item.type === 'airfare') {
      const ai = item as AirfareItem;
      const subtotal = ai.qty * ai.rate;
      const amount = subtotal - ai.discount;
      const desc = ai.description === 'Other' ? ai.customDesc : ai.description;
      const pnrList = ai.pnrs
        ? ai.pnrs.split(',').map((p) => p.trim()).filter(Boolean)
        : [];
      return {
        sn: idx + 1,
        description: desc,
        subDesc: `Sector: ${ai.sector}${ai.travelDate ? ' | Date: ' + fmtDate(ai.travelDate) : ''}`,
        pnrs: pnrList,
        hsn: ai.hsn,
        qty: ai.qty,
        rate: ai.rate,
        disc: ai.discount,
        cgst: 0,
        sgst: 0,
        igst: 0,
        amount,
      };
    }
    if (item.type === 'service') {
      const si = item as ServiceItem;
      const subtotal = si.qty * si.rate;
      const net = subtotal - si.discount;
      // GST is INCLUSIVE — extracted out of `net`, not added on top.
      let cgst = 0, sgst = 0, igst = 0;
      if (tax.gstType === 'cgst_sgst') {
        const base = net / (1 + (tax.cgstRate + tax.sgstRate) / 100);
        cgst = (base * tax.cgstRate) / 100;
        sgst = (base * tax.sgstRate) / 100;
      } else if (tax.gstType === 'igst') {
        const base = net / (1 + tax.igstRate / 100);
        igst = net - base;
      }
      const amount = net; // GST already inside `net`
      return {
        sn: idx + 1,
        description: si.description,
        subDesc: '',
        pnrs: [],
        hsn: si.hsn,
        qty: si.qty,
        rate: si.rate,
        disc: si.discount,
        cgst,
        sgst,
        igst,
        amount,
      };
    }
    // discount
    const di = item as DiscountItem;
    return {
      sn: idx + 1,
      description: di.description,
      subDesc: '',
      pnrs: [],
      hsn: '–',
      qty: null,
      rate: null,
      disc: di.amount,
      cgst: 0,
      sgst: 0,
      igst: 0,
      amount: -di.amount,
    };
  });

  const totalCGST = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSGST = rows.reduce((s, r) => s + r.sgst, 0);
  const totalIGST = rows.reduce((s, r) => s + r.igst, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = totalAmount + payment.previousDue;
  const balance = grandTotal - payment.paidAmount;

  const cell: React.CSSProperties = {
    border: `1px solid ${C.gray200}`,
    padding: '8px',
    verticalAlign: 'top',
  };
  const headCell: React.CSSProperties = {
    border: `1px solid ${C.gray600}`,
    padding: '8px',
  };

  return (
    <div
      id="invoice-preview"
      className="shadow-2xl rounded-sm leading-relaxed"
      style={{
        fontFamily: 'Arial, sans-serif',
        background: C.white,
        color: C.gray900,
        fontSize: '12px',
        width: '794px',      // A4 width  @ 96dpi (210mm)
        minHeight: '1123px', // A4 height @ 96dpi (297mm)
        padding: '40px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── HEADER ── */}
      <div className="flex justify-between items-start">

        {/* LEFT — Logo + Company name + tagline + contact */}
        <div className="flex items-start gap-4">

          {/* Logo */}
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt="logo"
              className="object-contain flex-shrink-0"
              style={{ height: '80px', width: 'auto' }}
            />
          )}

          {/* Company info column */}
          <div className="flex flex-col justify-center" style={{ paddingTop: '4px' }}>
            <div
              className="font-black uppercase"
              style={{ fontSize: '20px', color: C.brand, letterSpacing: '2px', lineHeight: 1.1 }}
            >
              {company.name || 'EXPLORE MY TRIP'}
            </div>

            {company.tagline && (
              <div
                className="italic mt-0.5"
                style={{ fontSize: '10px', color: C.brand, letterSpacing: '1px' }}
              >
                {company.tagline}
              </div>
            )}

            {/* Contact details — each on its own line */}
            <div className="mt-2 flex flex-col gap-0.5" style={{ fontSize: '10px', color: C.gray600 }}>
              {company.address && splitAddress(company.address).map((ln, i) => (
                <div key={i}>
                  {i === 0 && <span className="font-semibold" style={{ color: C.gray500 }}>Address: </span>}
                  {ln}
                </div>
              ))}
              {company.phone && (
                <div><span className="font-semibold" style={{ color: C.gray500 }}>Phone: </span>{company.phone}</div>
              )}
              {company.email && (
                <div><span className="font-semibold" style={{ color: C.gray500 }}>Email: </span>{company.email}</div>
              )}
              {company.website && (
                <div><span className="font-semibold" style={{ color: C.gray500 }}>Website: </span>{company.website}</div>
              )}
              {company.gstin && (
                <div className="mt-0.5"><span className="font-semibold" style={{ color: C.gray500 }}>GSTIN: </span>{company.gstin}</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — TAX INVOICE + Invoice No + Date */}
        <div className="text-right flex-shrink-0" style={{ paddingTop: '4px' }}>
          <div
            className="font-black uppercase inline-block px-5 py-1.5"
            style={{ fontSize: '18px', color: C.white, background: C.brand, borderRadius: '4px', letterSpacing: '3px' }}
          >
            TAX INVOICE
          </div>
          <div className="mt-3 flex flex-col gap-1 text-right" style={{ fontSize: '11px' }}>
            <div>
              <span className="font-semibold" style={{ color: C.gray500 }}>Invoice No: </span>
              <span className="font-bold" style={{ color: C.gray800 }}>{invoiceInfo.invoiceNo || '—'}</span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: C.gray500 }}>Date: </span>
              <span className="font-bold" style={{ color: C.gray800 }}>{fmtDisplayDate(invoiceInfo.date)}</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="mt-4 mb-4" style={{ borderColor: C.gray300 }} />

      {/* Bill To */}
      {billTo.name && (
        <div className="rounded p-3 mb-4" style={{ border: `1px solid ${C.gray200}`, background: C.gray50 }}>
          <div className="font-semibold mb-1" style={{ fontSize: '12px', color: C.blue600 }}>BILL TO</div>
          <div className="font-bold" style={{ fontSize: '14px', color: C.gray900 }}>{billTo.name}</div>
          <div className="mt-1 flex flex-col gap-0.5" style={{ fontSize: '12px', color: C.gray600 }}>
            {billTo.address && (
              <div><strong>Address: </strong>{billTo.address}</div>
            )}
            <div className="flex justify-between gap-4">
              {billTo.mobile && <span><strong>Mobile: </strong>{billTo.mobile}</span>}
              {billTo.gstin && <span><strong>GSTIN: </strong>{billTo.gstin}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <table className="w-full mb-4" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: C.gray800, color: C.white }}>
            <th className="text-center w-8" style={headCell}>Sn</th>
            <th className="text-left" style={headCell}>Description</th>
            <th className="text-center w-16" style={headCell}>HSN</th>
            <th className="text-center w-10" style={headCell}>Qty</th>
            <th className="text-right w-18" style={headCell}>Rate</th>
            <th className="text-right w-14" style={{ ...headCell, color: C.red300 }}>Disc.</th>
            <th className="text-right w-16" style={headCell}>CGST</th>
            <th className="text-right w-16" style={headCell}>SGST</th>
            <th className="text-right w-16" style={headCell}>IGST</th>
            <th className="text-right w-20" style={headCell}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sn}>
              <td className="text-center" style={cell}>{row.sn}</td>
              <td style={cell}>
                <div className="font-medium">{row.description}</div>
                {row.subDesc && <div className="mt-0.5" style={{ fontSize: '11px', color: C.gray500 }}>{row.subDesc}</div>}
                {row.pnrs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {row.pnrs.map((p) => (
                      <span
                        key={p}
                        className="px-1 py-0.5 rounded font-mono"
                        style={{ fontSize: '11px', background: C.blue100, color: C.blue700 }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="text-center" style={cell}>{row.hsn}</td>
              <td className="text-center" style={cell}>
                {row.qty != null ? row.qty : '–'}
              </td>
              <td className="text-right" style={cell}>
                {row.rate != null ? fmt(row.rate) : '–'}
              </td>
              <td className="text-right" style={{ ...cell, color: C.red500 }}>
                {fmt(row.disc)}
              </td>
              <td className="text-right" style={cell}>
                {fmt(row.cgst)}
              </td>
              <td className="text-right" style={cell}>
                {fmt(row.sgst)}
              </td>
              <td className="text-right" style={cell}>
                {fmt(row.igst)}
              </td>
              <td className="text-right font-medium" style={cell}>
                {fmt(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <table className="w-64" style={{ fontSize: '12px' }}>
          <tbody>
            {totalCGST > 0 && (
              <tr>
                <td className="pr-4 py-0.5" style={{ color: C.gray600 }}>Total CGST</td>
                <td className="text-right font-medium">₹{fmt(totalCGST)}</td>
              </tr>
            )}
            {totalSGST > 0 && (
              <tr>
                <td className="pr-4 py-0.5" style={{ color: C.gray600 }}>Total SGST</td>
                <td className="text-right font-medium">₹{fmt(totalSGST)}</td>
              </tr>
            )}
            {totalIGST > 0 && (
              <tr>
                <td className="pr-4 py-0.5" style={{ color: C.gray600 }}>Total IGST</td>
                <td className="text-right font-medium">₹{fmt(totalIGST)}</td>
              </tr>
            )}
            {payment.previousDue > 0 && (
              <tr>
                <td className="pr-4 py-0.5" style={{ color: C.gray600 }}>Previous Due</td>
                <td className="text-right font-medium">₹{fmt(payment.previousDue)}</td>
              </tr>
            )}
            <tr style={{ borderTop: `1px solid ${C.gray300}` }}>
              <td className="pr-4 pt-1 font-bold" style={{ fontSize: '14px' }}>Grand Total</td>
              <td className="text-right font-bold" style={{ fontSize: '14px', color: C.blue600 }}>₹{fmt(grandTotal)}</td>
            </tr>
            {payment.paidAmount > 0 && (
              <>
                <tr>
                  <td className="pr-4 py-0.5" style={{ color: C.gray600 }}>Paid Amount</td>
                  <td className="text-right font-medium" style={{ color: C.green600 }}>₹{fmt(payment.paidAmount)}</td>
                </tr>
                <tr style={{ borderTop: `1px solid ${C.gray300}` }}>
                  <td className="pr-4 pt-1 font-bold">Balance Due</td>
                  <td className="text-right font-bold" style={{ color: balance > 0 ? C.red600 : C.green600 }}>
                    ₹{fmt(balance)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER (pinned to bottom of the A4 page) ── */}
      <div style={{ marginTop: 'auto' }}>

        {/* Bank details + Signature row */}
        <div
          className="flex justify-between items-end pt-4"
          style={{ borderTop: `1px solid ${C.gray200}`, gap: '24px' }}
        >
          <div style={{ fontSize: '11px', color: C.gray600 }}>
            {payment.includeBankDetails && (payment.bankName || payment.accountNo || payment.branch) && (
              <>
                <div className="font-bold mb-1.5" style={{ color: C.gray800 }}>Bank Details</div>
                {payment.accountHolderName && <div><strong>Account Holder:</strong> {payment.accountHolderName}</div>}
                {payment.bankName         && <div><strong>Bank:</strong> {payment.bankName}</div>}
                {payment.accountNo        && <div><strong>Account No:</strong> {payment.accountNo}</div>}
                {payment.ifsc             && <div><strong>IFSC:</strong> {payment.ifsc}</div>}
                {payment.branch           && <div><strong>Branch:</strong> {payment.branch}</div>}
              </>
            )}
          </div>

          {/* Authorised Signatory */}
          <div className="text-center" style={{ minWidth: '200px' }}>
            <div style={{ fontSize: '11px', color: C.gray500, marginBottom: '2px' }}>
              For {company.name || 'Explore My Trip'}
            </div>
            <div style={{ height: '44px' }} />
            <div style={{ borderTop: `1px solid ${C.gray400}`, paddingTop: '4px', fontSize: '11px', color: C.gray700, fontWeight: 600 }}>
              Authorised Signatory
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        {payment.disclaimer && (
          <div className="pt-3 mt-3 italic text-center" style={{ borderTop: `1px solid ${C.gray200}`, fontSize: '10px', color: C.gray500 }}>
            {payment.disclaimer}
          </div>
        )}
      </div>
    </div>
  );
}
