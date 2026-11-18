import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { creditNoteSplit } from "@/lib/billing/gst";
import { sellerTaxConfig } from "@/lib/billing/seller";

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

// Indian financial year runs 1 April to 31 March, judged in IST.
export function financialYearFor(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Gapless per-series numbering. One atomic upsert per number, so concurrent webhooks cannot reuse a number.
export async function nextDocumentNumber(series: "INV" | "CN", financialYear: string): Promise<string> {
  const rows = (await sql().query(
    `INSERT INTO app_billing_invoice_sequences (series, financial_year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, financial_year) DO UPDATE SET last_number = app_billing_invoice_sequences.last_number + 1
     RETURNING last_number AS "n"`,
    [series, financialYear]
  )) as Array<{ n: number }>;
  return `${series}/${financialYear}/${String(rows[0].n).padStart(6, "0")}`;
}

// Creates the tax invoice for a paid order. Idempotent: the order_id is unique, so a retry returns the same invoice.
export async function ensureInvoiceForOrder(orderId: string): Promise<{ invoiceNumber: string } | null> {
  const seller = sellerTaxConfig();
  if (!seller) throw new Error("Seller tax details are not configured");
  const database = sql();
  const existing = (await database.query(
    `SELECT invoice_number AS "invoiceNumber" FROM app_billing_invoices WHERE order_id = $1::uuid`,
    [orderId]
  )) as Array<{ invoiceNumber: string }>;
  if (existing[0]) return { invoiceNumber: existing[0].invoiceNumber };

  const orders = (await database.query(
    `SELECT o.workspace_id AS "workspaceId", o.plan_code AS "planCode", o.base_paise AS "basePaise",
            o.gst_paise AS "gstPaise", o.amount_paise AS "totalPaise", o.paid_at AS "paidAt",
            o.buyer_state_code AS "buyerStateCode", o.buyer_gstin AS "buyerGstin",
            p.legal_name AS "legalName", p.address AS "address"
     FROM app_billing_orders o
     JOIN app_billing_tax_profiles p ON p.workspace_id = o.workspace_id
     WHERE o.id = $1::uuid AND o.status = 'paid'`,
    [orderId]
  )) as Array<{
    workspaceId: string; planCode: string; basePaise: number; gstPaise: number; totalPaise: number;
    paidAt: string; buyerStateCode: string; buyerGstin: string | null; legalName: string; address: string;
  }>;
  const order = orders[0];
  if (!order) throw new Error("Paid order with a tax profile was not found");

  const financialYear = financialYearFor(new Date(order.paidAt));
  const invoiceNumber = await nextDocumentNumber("INV", financialYear);
  const intra = order.buyerStateCode === seller.stateCode;
  const cgst = intra ? Math.round(order.gstPaise / 2) : 0;
  const sgst = intra ? order.gstPaise - cgst : 0;
  const igst = intra ? 0 : order.gstPaise;
  await database.query(
    `INSERT INTO app_billing_invoices
       (id, workspace_id, order_id, invoice_number, financial_year, buyer_legal_name, buyer_gstin,
        buyer_state_code, buyer_address, seller_gstin, seller_state_code, sac_code, rate_percent,
        base_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     ON CONFLICT (order_id) DO NOTHING`,
    [
      crypto.randomUUID(), order.workspaceId, orderId, invoiceNumber, financialYear, order.legalName,
      order.buyerGstin, order.buyerStateCode, order.address, seller.gstin, seller.stateCode, seller.sacCode,
      seller.ratePercent, order.basePaise, cgst, sgst, igst, order.totalPaise,
    ]
  );
  const stored = (await database.query(
    `SELECT invoice_number AS "invoiceNumber" FROM app_billing_invoices WHERE order_id = $1::uuid`,
    [orderId]
  )) as Array<{ invoiceNumber: string }>;
  return stored[0] ? { invoiceNumber: stored[0].invoiceNumber } : null;
}

// Credit note against an invoice. Refuses amounts that would take the total credited above the invoice.
export async function issueCreditNote(input: {
  invoiceId: string;
  grossPaise: number;
  reason: string;
  issuedByAuthUserId: string;
}): Promise<{ creditNoteNumber: string; split: ReturnType<typeof creditNoteSplit> }> {
  const database = sql();
  const rows = (await database.query(
    `SELECT i.id, i.workspace_id AS "workspaceId", i.financial_year AS "financialYear",
            i.base_paise AS "baseInrPaise", i.cgst_paise AS "cgstPaise", i.sgst_paise AS "sgstPaise",
            i.igst_paise AS "igstPaise", i.total_paise AS "totalInrPaise",
            COALESCE((SELECT SUM(c.gross_paise) FROM app_billing_credit_notes c WHERE c.invoice_id = i.id), 0)::int AS "creditedPaise"
     FROM app_billing_invoices i WHERE i.id = $1::uuid`,
    [input.invoiceId]
  )) as Array<{
    id: string; workspaceId: string; financialYear: string; baseInrPaise: number; cgstPaise: number;
    sgstPaise: number; igstPaise: number; totalInrPaise: number; creditedPaise: number;
  }>;
  const invoice = rows[0];
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.creditedPaise + input.grossPaise > invoice.totalInrPaise) {
    throw new Error("Credit would exceed the invoice total");
  }
  const split = creditNoteSplit({ invoice, grossPaise: input.grossPaise });
  const creditNoteNumber = await nextDocumentNumber("CN", invoice.financialYear);
  await database.query(
    `INSERT INTO app_billing_credit_notes
       (id, invoice_id, workspace_id, credit_note_number, financial_year, reason,
        base_paise, cgst_paise, sgst_paise, igst_paise, gross_paise, issued_by_auth_user_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      crypto.randomUUID(), invoice.id, invoice.workspaceId, creditNoteNumber, invoice.financialYear,
      input.reason, split.basePaise, split.cgstPaise, split.sgstPaise, split.igstPaise, split.grossPaise,
      input.issuedByAuthUserId,
    ]
  );
  return { creditNoteNumber, split };
}
