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

interface Data {
  company: CompanyInfo;
  billTo: BillTo;
  invoiceInfo: InvoiceInfo;
  items: InvoiceItem[];
  tax: TaxSettings;
  payment: PaymentInfo;
}

// ── Colors (RGB) ──
const COL = {
  brand: [91, 189, 224] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  dark: [31, 41, 55] as [number, number, number],   // gray-800
  ink: [17, 24, 39] as [number, number, number],     // gray-900
  gray700: [55, 65, 81] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray300: [209, 213, 219] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
};

const money = (n: number) => 'Rs. ' + n.toFixed(2);
const num = (n: number) => n.toFixed(2);

function fmtTravel(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)}${months[Number(m) - 1]}'${y.slice(2)}`;
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

const LOGO_MAX_PX = 512;
const LOGO_JPEG_QUALITY = 0.78;

/**
 * Converts any logo source into a small JPEG data URL for embedding. The source
 * logo can be huge, but the invoice only renders it at a small physical size.
 */
function loadLogoDataUrl(src: string): Promise<{ dataUrl: string; format: 'JPEG'; w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);

    const img = new Image();
    // Only set crossOrigin for non-data URLs (data URLs don't need it and it
    // causes a canvas taint on some browsers when combined with large data URIs).
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const sourceW = img.naturalWidth || img.width;
        const sourceH = img.naturalHeight || img.height;
        if (!sourceW || !sourceH) return resolve(null);

        const scale = Math.min(1, LOGO_MAX_PX / Math.max(sourceW, sourceH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceW * scale));
        canvas.height = Math.max(1, Math.round(sourceH * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', LOGO_JPEG_QUALITY),
          format: 'JPEG',
          w: canvas.width,
          h: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateInvoicePdf(data: Data) {
  const { company, billTo, invoiceInfo, items, tax, payment } = data;
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const PW = 210;
  const PH = 297;
  const M = 12;
  const right = PW - M;

  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // ── Build rows (mirrors InvoicePreview tax logic) ──
  const rows = items.map((item, idx) => {
    if (item.type === 'airfare') {
      const ai = item as AirfareItem;
      const amount = ai.qty * ai.rate - ai.discount;
      const desc = ai.description === 'Other' ? ai.customDesc : ai.description;
      const pnrs = ai.pnrs ? ai.pnrs.split(',').map((p) => p.trim()).filter(Boolean) : [];
      const sub = `Sector: ${ai.sector}${ai.travelDate ? ' | Date: ' + fmtTravel(ai.travelDate) : ''}`;
      return { sn: idx + 1, desc, sub, pnrs, hsn: ai.hsn, qty: ai.qty, rate: ai.rate, disc: ai.discount, cgst: 0, sgst: 0, igst: 0, amount };
    }
    if (item.type === 'service') {
      const si = item as ServiceItem;
      const net = si.qty * si.rate - si.discount;
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
      return { sn: idx + 1, desc: si.description, sub: '', pnrs: [] as string[], hsn: si.hsn, qty: si.qty, rate: si.rate, disc: si.discount, cgst, sgst, igst, amount: net };
    }
    const di = item as DiscountItem;
    return { sn: idx + 1, desc: di.description, sub: '', pnrs: [] as string[], hsn: '-', qty: null as number | null, rate: null as number | null, disc: di.amount, cgst: 0, sgst: 0, igst: 0, amount: -di.amount };
  });

  const totalCGST = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSGST = rows.reduce((s, r) => s + r.sgst, 0);
  const totalIGST = rows.reduce((s, r) => s + r.igst, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = totalAmount + payment.previousDue;
  const balance = grandTotal - payment.paidAmount;

  // ── HEADER ──
  let logoW = 0;
  const logoData = await loadLogoDataUrl(company.logoUrl);
  if (logoData) {
    const ratio = logoData.w / logoData.h;
    let h = 18;           // target height in mm — bigger so it shows clearly
    logoW = ratio * h;
    const maxW = 40;      // max width in mm
    if (logoW > maxW) { logoW = maxW; h = logoW / ratio; }
    try {
      doc.addImage(logoData.dataUrl, logoData.format, M, M, logoW, h, 'company-logo', 'MEDIUM');
    } catch {
      logoW = 0;
    }
  }

  const cx = M + (logoW ? logoW + 4 : 0);
  setText(COL.brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text((company.name || 'Explore My Trip').toUpperCase(), cx, M + 6);

  let cy = M + 11;
  if (company.tagline) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text(company.tagline, cx, cy);
    cy += 4.5;
  } else {
    cy += 1;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(COL.gray600);
  const contact: string[] = [];
  if (company.address) {
    const am = company.address.match(/,?\s*(Pin(?:code)?\b)/i);
    if (am && am.index && am.index > 0) {
      contact.push(`Address: ${company.address.slice(0, am.index).replace(/[,\s]+$/, '')}`);
      contact.push(company.address.slice(am.index).replace(/^[,\s]+/, ''));
    } else {
      contact.push(`Address: ${company.address}`);
    }
  }
  if (company.phone) contact.push(`Phone: ${company.phone}`);
  if (company.email) contact.push(`Email: ${company.email}`);
  if (company.website) contact.push(`Website: ${company.website}`);
  if (company.gstin) contact.push(`GSTIN: ${company.gstin}`);
  // Wrap so long lines (e.g. address) don't run under the TAX INVOICE block.
  const contactW = right - 46 - 4 - cx;
  contact.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contactW) as string[];
    wrapped.forEach((wl) => {
      doc.text(wl, cx, cy);
      cy += 4;
    });
  });

  // Right — TAX INVOICE badge
  const badgeW = 46;
  const badgeH = 9;
  const badgeX = right - badgeW;
  setFill(COL.brand);
  doc.roundedRect(badgeX, M, badgeW, badgeH, 1.2, 1.2, 'F');
  setText(COL.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TAX INVOICE', badgeX + badgeW / 2, M + 6, { align: 'center' });

  doc.setFontSize(9);
  let ry = M + badgeH + 6;
  setText(COL.gray500);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice No: ', right, ry, { align: 'right' });
  // value
  const invNo = invoiceInfo.invoiceNo || '-';
  doc.setFont('helvetica', 'bold');
  setText(COL.dark);
  doc.text(invNo, right, ry + 4, { align: 'right' });
  ry += 9;
  doc.setFont('helvetica', 'normal');
  setText(COL.gray500);
  doc.text('Date: ', right, ry, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  setText(COL.dark);
  doc.text(fmtDate(invoiceInfo.date), right, ry + 4, { align: 'right' });

  let y = Math.max(cy, ry + 6, M + 30) + 2;

  // Divider
  setDraw(COL.gray300);
  doc.setLineWidth(0.3);
  doc.line(M, y, right, y);
  y += 6;

  // ── BILL TO ──
  if (billTo.name) {
    const billLineW = 128;
    const addressLines = billTo.address
      ? (doc.splitTextToSize(`Address: ${billTo.address}`, billLineW) as string[])
      : [];
    const mobileGstin = [
      billTo.mobile ? `Mobile: ${billTo.mobile}` : '',
      billTo.gstin ? `GSTIN: ${billTo.gstin}` : '',
    ].filter(Boolean).join('    ');
    const boxH = Math.max(18, 16 + addressLines.length * 4 + (mobileGstin ? 4 : 0));
    setFill(COL.gray50);
    setDraw(COL.gray200);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, PW - 2 * M, boxH, 1, 1, 'FD');
    setText(COL.blue);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('BILL TO', M + 3, y + 4.5);
    setText(COL.ink);
    doc.setFontSize(11);
    doc.text(billTo.name, M + 3, y + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(COL.gray600);
    let billY = y + 14;
    addressLines.forEach((line) => {
      doc.text(line, M + 3, billY);
      billY += 4;
    });
    if (mobileGstin) doc.text(mobileGstin, M + 3, billY);
    y += boxH + 6;
  }

  // ── ITEMS TABLE ──
  const cols = [
    { key: 'sn', label: 'Sn', w: 9, align: 'center' as const },
    { key: 'desc', label: 'Description', w: 52, align: 'left' as const },
    { key: 'hsn', label: 'HSN', w: 15, align: 'center' as const },
    { key: 'qty', label: 'Qty', w: 10, align: 'center' as const },
    { key: 'rate', label: 'Rate', w: 17, align: 'right' as const },
    { key: 'disc', label: 'Disc.', w: 15, align: 'right' as const },
    { key: 'cgst', label: 'CGST', w: 15, align: 'right' as const },
    { key: 'sgst', label: 'SGST', w: 15, align: 'right' as const },
    { key: 'igst', label: 'IGST', w: 15, align: 'right' as const },
    { key: 'amount', label: 'Amount', w: 23, align: 'right' as const },
  ];
  const xAt: number[] = [];
  let acc = M;
  cols.forEach((c) => { xAt.push(acc); acc += c.w; });
  const tableRight = acc; // == right
  const tableTop = y;

  const PAD = 1.6;
  const cellText = (text: string, ci: number, ty: number, color: [number, number, number]) => {
    const c = cols[ci];
    setText(color);
    if (c.align === 'center') doc.text(text, xAt[ci] + c.w / 2, ty, { align: 'center' });
    else if (c.align === 'right') doc.text(text, xAt[ci] + c.w - PAD, ty, { align: 'right' });
    else doc.text(text, xAt[ci] + PAD, ty);
  };

  // Header row
  const headH = 7;
  setFill(COL.dark);
  doc.rect(M, y, tableRight - M, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  cols.forEach((c, ci) => cellText(c.label, ci, y + 4.7, COL.white));
  y += headH;

  // Body rows
  doc.setFontSize(7.5);
  rows.forEach((r) => {
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(r.desc || '', cols[1].w - 2 * PAD) as string[];
    let extra = 0;
    if (r.sub) extra += 1;
    if (r.pnrs.length) extra += 1;
    const lineCount = descLines.length + extra;
    const rowH = Math.max(8, lineCount * 3.4 + 3.2);

    let ty = y + 4.6;
    // Description (multi-line) + sub + pnrs
    setText(COL.ink);
    descLines.forEach((ln) => {
      doc.text(ln, xAt[1] + PAD, ty);
      ty += 3.4;
    });
    if (r.sub) {
      doc.setFontSize(6.8);
      setText(COL.gray500);
      doc.text(r.sub, xAt[1] + PAD, ty);
      ty += 3.4;
      doc.setFontSize(7.5);
    }
    if (r.pnrs.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      setText(COL.blue);
      doc.text(`PNR: ${r.pnrs.join(', ')}`, xAt[1] + PAD, ty);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    const midY = y + 4.6;
    cellText(String(r.sn), 0, midY, COL.ink);
    cellText(r.hsn, 2, midY, COL.ink);
    cellText(r.qty != null ? String(r.qty) : '-', 3, midY, COL.ink);
    cellText(r.rate != null ? num(r.rate) : '-', 4, midY, COL.ink);
    cellText(num(r.disc), 5, midY, COL.red);
    cellText(num(r.cgst), 6, midY, COL.ink);
    cellText(num(r.sgst), 7, midY, COL.ink);
    cellText(num(r.igst), 8, midY, COL.ink);
    doc.setFont('helvetica', 'bold');
    cellText(num(r.amount), 9, midY, COL.ink);
    doc.setFont('helvetica', 'normal');

    // bottom border
    setDraw(COL.gray200);
    doc.setLineWidth(0.2);
    doc.line(M, y + rowH, tableRight, y + rowH);
    y += rowH;
  });

  const tableBottom = y;
  // Vertical separators + outer border
  setDraw(COL.gray200);
  doc.setLineWidth(0.2);
  xAt.forEach((x, i) => { if (i > 0) doc.line(x, tableTop, x, tableBottom); });
  doc.line(tableRight, tableTop, tableRight, tableBottom);
  doc.setLineWidth(0.3);
  setDraw(COL.gray300);
  doc.rect(M, tableTop, tableRight - M, tableBottom - tableTop, 'S');

  // ── TOTALS (boxed, right aligned) ──
  type TLine = { label: string; val: string; bold?: boolean; color?: [number, number, number]; grand?: boolean };
  const tLines: TLine[] = [];
  if (totalCGST > 0) tLines.push({ label: 'Total CGST', val: money(totalCGST) });
  if (totalSGST > 0) tLines.push({ label: 'Total SGST', val: money(totalSGST) });
  if (totalIGST > 0) tLines.push({ label: 'Total IGST', val: money(totalIGST) });
  if (payment.previousDue > 0) tLines.push({ label: 'Previous Due', val: money(payment.previousDue) });
  tLines.push({ label: 'Grand Total', val: money(grandTotal), bold: true, color: COL.blue, grand: true });
  if (payment.paidAmount > 0) {
    tLines.push({ label: 'Paid Amount', val: money(payment.paidAmount), color: COL.green });
    tLines.push({ label: 'Balance Due', val: money(balance), bold: true, color: balance > 0 ? COL.red : COL.green });
  }

  const boxX = 116;
  const boxW = right - boxX;
  const padX = 4;
  const rowH = 6.5;
  const boxTop = tableBottom + 7;
  const boxH = tLines.length * rowH;

  // Outer border
  setDraw(COL.gray300);
  doc.setLineWidth(0.3);
  doc.rect(boxX, boxTop, boxW, boxH, 'S');

  let ty = boxTop;
  tLines.forEach((t) => {
    if (t.grand) {
      // highlight the Grand Total band
      setFill(COL.gray50);
      doc.rect(boxX, ty, boxW, rowH, 'F');
      setDraw(COL.gray300);
      doc.setLineWidth(0.3);
      doc.line(boxX, ty, boxX + boxW, ty);
    }
    const baseline = ty + rowH / 2 + 1.5;
    doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
    doc.setFontSize(t.grand ? 10 : 8.5);
    setText(t.bold ? COL.ink : COL.gray600);
    doc.text(t.label, boxX + padX, baseline);
    setText(t.color || COL.gray700);
    doc.text(t.val, right - padX, baseline, { align: 'right' });
    ty += rowH;
  });

  // ── FOOTER (pinned near bottom) ──
  // Disclaimer at very bottom
  if (payment.disclaimer) {
    setDraw(COL.gray200);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 16, right, PH - 16);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    setText(COL.gray500);
    const dl = doc.splitTextToSize(payment.disclaimer, PW - 2 * M) as string[];
    let dy = PH - 11;
    dl.forEach((ln) => { doc.text(ln, PW / 2, dy, { align: 'center' }); dy += 3.2; });
  }

  // Signature (right) + bank details (left)
  const sigLineY = PH - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(COL.gray500);
  doc.text(`For ${company.name || 'Explore My Trip'}`, right, sigLineY - 12, { align: 'right' });
  setDraw(COL.gray500);
  doc.setLineWidth(0.3);
  doc.line(right - 50, sigLineY, right, sigLineY);
  doc.setFont('helvetica', 'bold');
  setText(COL.gray700);
  doc.text('Authorised Signatory', right, sigLineY + 4, { align: 'right' });

  if (payment.includeBankDetails && (payment.bankName || payment.accountNo || payment.branch)) {
    let by = PH - 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(COL.dark);
    doc.text('Bank Details', M, by);
    by += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(COL.gray600);
    const bank: string[] = [];
    if (payment.accountHolderName) bank.push(`Account Holder: ${payment.accountHolderName}`);
    if (payment.bankName) bank.push(`Bank: ${payment.bankName}`);
    if (payment.accountNo) bank.push(`Account No: ${payment.accountNo}`);
    if (payment.ifsc) bank.push(`IFSC: ${payment.ifsc}`);
    if (payment.branch) bank.push(`Branch: ${payment.branch}`);
    bank.forEach((ln) => { doc.text(ln, M, by); by += 3.8; });
  }

  doc.save(`${invoiceInfo.invoiceNo || 'invoice'}.pdf`);
}
