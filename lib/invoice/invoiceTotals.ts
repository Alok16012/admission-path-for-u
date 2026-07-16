import type {
  InvoiceItem,
  TaxSettings,
  PaymentInfo,
  AirfareItem,
  ServiceItem,
  DiscountItem,
} from '@/app/invoice/page';

export interface InvoiceTotals {
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalAmount: number;
  grandTotal: number;
  balance: number;
}

// Mirrors InvoicePreview: airfare/discount are tax-free, service GST is
// INCLUSIVE (extracted out of the amount, not added on top).
export function computeTotals(
  items: InvoiceItem[],
  tax: TaxSettings,
  payment: PaymentInfo
): InvoiceTotals {
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalAmount = 0;

  for (const item of items) {
    if (item.type === 'airfare') {
      const ai = item as AirfareItem;
      totalAmount += ai.qty * ai.rate - ai.discount;
    } else if (item.type === 'service') {
      const si = item as ServiceItem;
      const net = si.qty * si.rate - si.discount;
      if (tax.gstType === 'cgst_sgst') {
        const base = net / (1 + (tax.cgstRate + tax.sgstRate) / 100);
        totalCGST += (base * tax.cgstRate) / 100;
        totalSGST += (base * tax.sgstRate) / 100;
      } else if (tax.gstType === 'igst') {
        const base = net / (1 + tax.igstRate / 100);
        totalIGST += net - base;
      }
      totalAmount += net; // GST already inside
    } else {
      const di = item as DiscountItem;
      totalAmount += -di.amount;
    }
  }

  const grandTotal = totalAmount + payment.previousDue;
  const balance = grandTotal - payment.paidAmount;
  return { totalCGST, totalSGST, totalIGST, totalAmount, grandTotal, balance };
}

// Internal profit = Σ(selling price − cost price) across items. These fields are
// never shown on the invoice/PDF — they exist only for dashboard reporting.
export function computeProfit(items: InvoiceItem[]): number {
  let profit = 0;
  for (const item of items) {
    if (item.type === 'airfare' || item.type === 'service') {
      const it = item as AirfareItem | ServiceItem;
      profit += (it.sell || 0) - (it.cost || 0);
    }
  }
  return profit;
}
