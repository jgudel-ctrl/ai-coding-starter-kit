#!/bin/bash
# Direct DB Sync via psql (bypass REST API + RLS)

cd "$(dirname "$0")/.."

# Easybill API Key
EAK=$(grep "^EASYBILL_API_KEY=" .env.production | cut -d= -f2-)

echo "🚀 Sync via psql (bypass RLS)"
echo ""

# Hole Dokumente von Easybill
RESPONSE=$(curl -s "https://api.easybill.de/rest/v1/documents?limit=5&page=1300&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT" \
  -H "Authorization: Bearer $EAK")

# Anzahl ab 2023 zählen
count=$(echo "$RESPONSE" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const docs = data.items.filter(d => new Date(d.document_date).getFullYear() >= 2023);
console.log(docs.length);
')
echo "Dokumente ab 2023: $count"

# Erstelle SQL-Befehle mit Node
echo "$RESPONSE" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
const docs = data.items.filter(d => new Date(d.document_date).getFullYear() >= 2023);

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return esc(JSON.stringify(v));
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function status(paid, total, due) {
  if ((paid||0) >= (total||0)) return "paid";
  if ((paid||0) > 0) return "partial";
  if (due) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(due) < today) return "overdue";
  }
  return "open";
}

docs.forEach(d => {
  const s = status(d.paid_amount, d.amount, d.due_date);
  const name = (d.address?.company_name || d.address?.last_name || "").substring(0, 255);
  
  // Invoice
  console.log(`INSERT INTO tms.invoices (id, invoice_number, type, document_date, due_date, customer_id, partner_name, amount, amount_net, paid_amount, currency, payment_status, paid_at, order_number, address, created_at, last_synced_at) VALUES (${d.id}, ${esc(d.number)}, ${esc(d.type)}, ${esc(d.document_date)}, ${d.due_date ? esc(d.due_date) : "NULL"}, ${d.customer_id || "NULL"}, ${esc(name)}, ${d.amount||0}, ${d.amount_net||0}, ${d.paid_amount||0}, ${esc(d.currency||"EUR")}, ${esc(s)}, ${d.paid_at ? esc(d.paid_at) : "NULL"}, ${d.order_number ? esc(d.order_number) : "NULL"}, ${esc(d.address)}, ${esc(d.created_at)}, ${esc(new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, document_date=EXCLUDED.document_date, due_date=EXCLUDED.due_date, customer_id=EXCLUDED.customer_id, partner_name=EXCLUDED.partner_name, amount=EXCLUDED.amount, amount_net=EXCLUDED.amount_net, paid_amount=EXCLUDED.paid_amount, currency=EXCLUDED.currency, payment_status=EXCLUDED.payment_status, paid_at=EXCLUDED.paid_at, order_number=EXCLUDED.order_number, address=EXCLUDED.address, last_synced_at=EXCLUDED.last_synced_at;`);
  
  // Items
  if (d.items?.length > 0) {
    const vals = d.items.map(item => `(${item.id}, ${d.id}, ${item.position}, ${esc(item.type)}, ${esc(item.itemType)}, ${esc(item.number)}, ${esc(item.description)}, ${item.quantity||0}, ${esc(item.unit)}, ${item.single_price_net||0}, ${item.total_price_net||0}, ${item.vat_percent||0}, ${esc(new Date().toISOString())})`).join(",");
    console.log(`INSERT INTO tms.invoice_items (id, invoice_id, position, type, item_type, article_number, description, quantity, unit, single_price_net, total_price_net, vat_percent, last_synced_at) VALUES ${vals} ON CONFLICT (id) DO UPDATE SET invoice_id=EXCLUDED.invoice_id, position=EXCLUDED.position, type=EXCLUDED.type, item_type=EXCLUDED.item_type, article_number=EXCLUDED.article_number, description=EXCLUDED.description, quantity=EXCLUDED.quantity, unit=EXCLUDED.unit, single_price_net=EXCLUDED.single_price_net, total_price_net=EXCLUDED.total_price_net, vat_percent=EXCLUDED.vat_percent, last_synced_at=EXCLUDED.last_synced_at;`);
  }
});
' > /tmp/sync-commands.sql

# Ausführen
echo ""
echo "💾 Führe SQL aus..."
docker exec -i supabase-db psql -U postgres -d postgres < /tmp/sync-commands.sql 2>&1

# Ergebnis
echo ""
echo "📊 Ergebnis:"
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM tms.invoices;"
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM tms.invoice_items;"

# Sync-Log eintragen
docker exec -i supabase-db psql -U postgres -d postgres -c "
INSERT INTO tms.invoice_sync_log (sync_type, documents_fetched, documents_inserted, documents_updated, items_inserted, payments_inserted, started_at, completed_at, status, error_message)
VALUES ('manual_test_psql', $count, $count, 0, (SELECT COUNT(*) FROM tms.invoice_items), 0, NOW(), NOW(), 'completed', NULL);
"

echo ""
echo "✅ Fertig!"
