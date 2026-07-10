/**
 * Easybill REST API Client
 * Basis-URL: https://api.easybill.de/rest/v1
 *
 * Endpunkte:
 * - GET /documents — Alle Dokumente (Rechnungen, Gutschriften, etc.)
 * - GET /documents/{id} — Einzelnes Dokument (inkl. Positionen in doc.items)
 *
 * Auth: Bearer Token
 * Rate-Limit: 60 req/min (Premium 1000 = Business)
 */

// ============================================================
// Typen (aus Easybill API Swagger)
// ============================================================

export interface EasybillDocument {
  id: number;
  number: string;
  type: string;
  document_date: string;
  due_date: string | null;
  due_in_days: number | null;
  status: string | null;
  is_draft: boolean;
  is_archive: boolean;
  customer_id: number | null;
  contact_id: number | null;
  amount: number;
  amount_net: number;
  paid_amount: number;
  currency: string;
  paid_at: string | null;
  discount: string | null;
  discount_type: string | null;
  cash_allowance: number | null;
  cash_allowance_days: number | null;
  cash_allowance_text: string | null;
  calc_vat_from: number | null;
  vat_option: string | null;
  vat_country: string | null;
  vat_id: string | null;
  cancel_id: number | null;
  ref_id: number | null;
  root_id: number | null;
  order_number: string | null;
  buyer_reference: string | null;
  project_id: number | null;
  external_id: string | null;
  title: string | null;
  text: string | null;
  text_prefix: string | null;
  text_tax: string | null;
  billing_country: string | null;
  shipping_country: string | null;
  fulfillment_country: string | null;
  address: any | null;
  label_address: any | null;
  customer_snapshot: any | null;
  payment_link_enabled: boolean | null;
  payment_link_locale: string | null;
  use_shipping_address: boolean | null;
  bank_debit_form: string | null;
  is_oss: boolean;
  is_replica: boolean;
  replica_url: string | null;
  pdf_template: string | null;
  pdf_pages: number | null;
  login_id: number | null;
  last_postbox_id: number | null;
  contact_label: string | null;
  contact_text: string | null;
  anonymize_status: string | null;
  anonymize_due_date: string | null;
  anonymized_at: string | null;
  is_acceptable_on_public_domain: boolean | null;
  item_notes: any[] | null;
  items: EasybillDocumentPosition[] | null;
  attachment_ids: number[] | null;
  advanced_data_fields: any[] | null;
  file_format_config: any[] | null;
  service_date: any | null;
  recurring_options: any | null;
  created_at: string;
  edited_at: string | null;
}

export interface EasybillDocumentPosition {
  id: number;
  document_id: number;
  position: number;
  type: string | null;
  itemType: string | null;
  number: string | null;
  description: string;
  document_note: string | null;
  note: string | null;
  quantity: number;
  quantity_str: string | null;
  unit: string | null;
  single_price_net: number;
  single_price_gross: number;
  total_price_net: number;
  total_price_gross: number;
  total_vat: number;
  vat_percent: number;
  discount: number | null;
  discount_type: string | null;
  cost_price_net: number | null;
  cost_price_total: number | null;
  cost_price_charge: number | null;
  cost_price_charge_type: string | null;
  position_id: number | null;
  booking_account: string | null;
  export_cost_1: string | null;
  export_cost_2: string | null;
  serial_number: string | null;
  serial_number_id: string | null;
}

export interface EasybillDocumentPayment {
  id: number;
  document_id: number;
  amount: number;
  payment_at: string | null;
  type: string | null;
  provider: string | null;
  reference: string | null;
  notice: string | null;
  is_overdue_fee: boolean;
  login_id: number | null;
}

export interface EasybillPaginatedResponse<T> {
  items: T[];
  page: number;
  pages: number;
}

// ============================================================
// Konstanten
// ============================================================

const EASYBILL_BASE_URL = "https://api.easybill.de/rest/v1";
const REQUEST_DELAY_MS = 1000; // 1 Sekunde Pause zwischen Requests (60 req/min max)

// API-Key aus Umgebungsvariable
function getApiKey(): string {
  const key = process.env.EASYBILL_API_KEY;
  if (!key) {
    throw new Error(
      "EASYBILL_API_KEY ist nicht gesetzt. Bitte in .env hinzufügen."
    );
  }
  return key;
}

// ============================================================
// Hilfsfunktionen
// ============================================================

export async function easybillFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${EASYBILL_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // Rate-Limit: 429 → warten und retry
  if (response.status === 429) {
    console.warn(`[Easybill] Rate limit erreicht, warte 3 Sekunden...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return easybillFetch(endpoint, options);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Easybill API Fehler ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

/**
 * Pause zwischen Requests (Rate-Limit-Schutz)
 */
export async function delayBetweenRequests(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
}

// ============================================================
// API-Funktionen
// ============================================================

/**
 * Dokumente (Rechnungen, Gutschriften, etc.) abrufen.
 *
 * @param page Seite (1-basiert)
 * @param limit Max. pro Seite (max 1000)
 * @param editedAfter Nur Dokumente, die nach diesem Datum bearbeitet wurden (ISO-Format)
 */
export async function fetchDocumentsPage(
  page: number = 1,
  limit: number = 1000,
  editedAfter?: string
): Promise<EasybillPaginatedResponse<EasybillDocument>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  params.set("is_draft", "false");
  params.set("type", "INVOICE,CREDIT,STORNO,STORNO_CREDIT");

  if (editedAfter) {
    // Easybill Filter-Syntax: edited_at=YYYY-MM-DD,YYYY-MM-DD
    params.set("edited_at", `${editedAfter},9999-12-31`);
  }

  return easybillFetch<EasybillPaginatedResponse<EasybillDocument>>(
    `/documents?${params.toString()}`
  );
}

/**
 * Einzelnes Dokument abrufen (inkl. aller Felder)
 */
export async function fetchDocumentById(
  documentId: number
): Promise<EasybillDocument> {
  return easybillFetch<EasybillDocument>(`/documents/${documentId}`);
}

/**
 * Positionen eines Dokuments abrufen.
 * Die Positionen sind direkt im Dokument enthalten (GET /documents/{id} → doc.items).
 */
export async function fetchDocumentItems(
  documentId: number
): Promise<EasybillDocumentPosition[]> {
  const doc = await fetchDocumentById(documentId);
  return doc.items || [];
}

/**
 * Zahlungen eines Dokuments abrufen.
 * Easybill API v1 hat keinen separaten Payments-Endpoint.
 * Bezahl-Info kommt aus doc.paid_amount und doc.paid_at.
 */
export async function fetchDocumentPayments(
  documentId: number
): Promise<EasybillDocumentPayment[]> {
  // Kein separater Endpoint verfügbar — Payments werden aus Invoice bezogen
  return [];
}
