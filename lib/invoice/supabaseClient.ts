import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Invoice app uses its own Supabase project, separate from the CRM database
const url = process.env.NEXT_PUBLIC_INVOICE_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_INVOICE_SUPABASE_ANON_KEY || '';

// `null` when env vars are missing so the UI can show a friendly message
// instead of crashing.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(url && anonKey);

// ── Shape of a row in the `invoices` table ──
export interface InvoiceRow {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  client_name: string | null;
  client_gstin: string | null;
  grand_total: number | null;
  paid_amount: number | null;
  balance_due: number | null;
  data: unknown; // full invoice snapshot (jsonb)
  created_at: string;
}
