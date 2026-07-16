import type { Metadata } from 'next';
import './invoice.css';

export const metadata: Metadata = {
  title: 'Explore My Trip – Invoice',
  description: 'Explore My Trip – Tour & Travel Tax Invoice Generator',
};

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return <div className="invoice-app min-h-screen bg-slate-900">{children}</div>;
}
