#!/bin/bash
# Direct DB Sync via psql (bypass REST API + RLS)

cd "$(dirname "$0")/.."

# Easybill API Key
EAK=$(grep "^EASYBILL_API_KEY=" .env.production | cut -d= -f2-)

echo "🚀 Echter Sync via psql (bypass RLS)"
echo ""

# Hole 5 Dokumente von Easybill
RESPONSE=$(curl -s "https://api.easybill.de/rest/v1/documents?limit=5&page=1300&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT" \
  -H "Authorization: Bearer $EAK")

# Parse JSON mit Node
echo "$RESPONSE" | node -e '
const data = require("fs").readFileSync(0, "utf8");
const docs = JSON.parse(data).items.filter(d => new Date(d.document_date).getFullYear() >= 2023);
console.log("Dokumente ab 2023:", docs.length);
docs.forEach(d => {
  console.log(d.id, d.number, d.type, d.document_date, "net="+d.amount_net, "paid="+d.paid_amount, "items="+(d.items?.length||0));
});
'

# Für jedes Dokument: Invoice + Items in DB einfügen
echo ""
echo "💾 Füge in DB ein..."

# Invoice INSERT (bypass RLS via psql)
for row in $(echo "$RESPONSE" | node -e '
const data = require("fs").readFileSync(0, "utf8");
const docs = JSON.parse(data).items.filter(d => new Date(d.document_date).getFullYear() >= 2023);
docs.forEach(d => {
  const status = (d.paid_amount || 0) >= (d.amount || 0) ? "paid" : (d.paid_amount > 0 ? "partial" : "open");
  const partnerName = d.address?.company_name || d.address?.last_name || "";
  const sql = `INSERT INTO tms.invoices (id, invoice_number, type, document_date, due_date, customer_id, partner_name, amount, amount_net, paid_amount, currency, payment_status, paid_at, order_number, address, created_at, last_synced_at) VALUES (${d.id}, ${escape(d.number)}, ${escape(d.type)}, ${escape(d.document_date)}, ${d.due_date ? escape(d.due_date) : "NULL"}, ${d.customer_id || "NULL"}, ${escape(partnerName)}, ${d.amount || 0}, ${d.amount_net || 0}, ${d.paid_amount || 0}, ${escape(d.currency || "EUR")}, ${escape(status)}, ${d.paid_at ? escape(d.paid_at) : "NULL"}, ${d.order_number ? escape(d.order_number) : "NULL"}, ${escape(JSON.stringify(d.address))}, ${escape(d.created_at)}, ${escape(new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, document_date=EXCLUDED.document_date, due_date=EXCLUDED.due_date, customer_id=EXCLUDED.customer_id, partner_name=EXCLUDED.partner_name, amount=EXCLUDED.amount, amount_net=EXCLUDED.amount_net, paid_amount=EXCLUDED.paid_amount, currency=EXCLUDED.currency, payment_status=EXCLUDED.payment_status, paid_at=EXCLUDED.paid_at, order_number=EXCLUDED.order_number, address=EXCLUDED.address, last_synced_at=EXCLUDED.last_synced_at;`;
  console.log(sql);
});
function escape(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
'); do
  echo "Executing SQL..."
  docker exec -i supabase-db psql -U postgres -d postgres -c "$row" 2>&1 | grep -v "^INSERT" | head -5
  sleep 0.1
done

# Check
echo ""
echo "📊 Ergebnis:"
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM tms.invoices;"
