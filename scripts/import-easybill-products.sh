#!/bin/bash
# PROJ-25: Initial-Import aus Easybill (Bash-Version mit curl)

set -e

WORKSPACE="/home/botti/.openclaw/workspace"
SUPABASE_URL="https://supabase.gudel-werkzeuge.de"

# API Keys holen
EASYBILL_API_KEY=$(grep '^EASYBILL_API_KEY=' "$WORKSPACE/.env.production" | cut -d'=' -f2-)
SUPABASE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$WORKSPACE/.env.production" | cut -d'=' -f2-)

echo "🚀 PROJ-25: Initial-Import aus Easybill"
echo "========================================"
echo "API Key: ${EASYBILL_API_KEY:0:10}..."
echo ""

# ============================================================
# Hilfsfunktionen
# ============================================================

easybill_fetch() {
    local endpoint="$1"
    curl -s -H "Authorization: ***${EASYBILL_API_KEY}" \
         -H "Content-Type: application/json" \
         "https://api.easybill.de/rest/v1${endpoint}"
}

supabase_upsert() {
    local table="$1"
    local data="$2"
    curl -s -X POST \
         -H "apikey: ${SUPABASE_KEY}" \
         -H "Authorization: ***${SUPABASE_KEY}" \
         -H "Content-Type: application/json" \
         -H "Prefer: resolution=merge-duplicates" \
         -d "$data" \
         "${SUPABASE_URL}/rest/v1/${table}"
}

supabase_query() {
    local table="$1"
    local query="$2"
    curl -s -H "apikey: ${SUPABASE_KEY}" \
         -H "Authorization: ***${SUPABASE_KEY}" \
         "${SUPABASE_URL}/rest/v1/${table}?${query}"
}

# ============================================================
# 1. Produktgruppen
# ============================================================

echo "📦 1. Produktgruppen importieren..."
GROUPS_JSON=$(easybill_fetch "/position-groups?limit=1000")
GROUPS_COUNT=$(echo "$GROUPS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))")
echo "   Gefunden: $GROUPS_COUNT"

# In JSON-Array für Supabase umwandeln
echo "$GROUPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = []
for g in data.get('items', []):
    rows.append({
        'id': g['id'],
        'number': g.get('number'),
        'name': g.get('name'),
        'display_name': g.get('display_name'),
        'description': g.get('description')
    })
print(json.dumps(rows))
" > /tmp/prod-25-groups.json

supabase_upsert "position_groups" "$(cat /tmp/prod-25-groups.json)" > /dev/null
echo "   ✅ $GROUPS_COUNT Produktgruppen gespeichert"

sleep 1

# ============================================================
# 2. Kundengruppen
# ============================================================

echo ""
echo "👥 2. Kundengruppen importieren..."
CUST_GROUPS_JSON=$(easybill_fetch "/customer-groups?limit=100")
CUST_GROUPS_COUNT=$(echo "$CUST_GROUPS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))")
echo "   Gefunden: $CUST_GROUPS_COUNT"

echo "$CUST_GROUPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = []
for g in data.get('items', []):
    rows.append({
        'id': g['id'],
        'number': g.get('number'),
        'name': g.get('name'),
        'display_name': g.get('display_name')
    })
print(json.dumps(rows))
" > /tmp/prod-25-cust-groups.json

supabase_upsert "customer_groups" "$(cat /tmp/prod-25-cust-groups.json)" > /dev/null
echo "   ✅ $CUST_GROUPS_COUNT Kundengruppen gespeichert"

sleep 1

# ============================================================
# 3. Artikel (paginiert)
# ============================================================

echo ""
echo "🔧 3. Artikel importieren (7.315, ~8 Seiten)..."

PAGE=1
IMPORTED=0
ERRORS=0
TOTAL=0

while true; do
    JSON=$(easybill_fetch "/positions?limit=1000&page=${PAGE}")
    
    # Items zählen
    ITEMS_COUNT=$(echo "$JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); print(len(items))")
    
    if [ "$ITEMS_COUNT" -eq 0 ]; then
        break
    fi
    
    if [ "$PAGE" -eq 1 ]; then
        TOTAL=$(echo "$JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))")
    fi
    
    # In Supabase-Format umwandeln
    echo "$JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = []
for p in data.get('items', []):
    rows.append({
        'id': p['id'],
        'number': p.get('number'),
        'description': p.get('description'),
        'type': p.get('type'),
        'group_id': p.get('group_id'),
        'cost_price': p.get('cost_price'),
        'sale_price': p.get('sale_price'),
        'vat_percent': p.get('vat_percent'),
        'unit': p.get('unit'),
        'archived': p.get('archived', False),
        'note': p.get('note'),
        'raw_easybill_payload': p
    })
print(json.dumps(rows))
" > "/tmp/prod-25-products-${PAGE}.json"
    
    # Upsert
    RESULT=$(supabase_upsert "products" "$(cat /tmp/prod-25-products-${PAGE}.json)")
    
    if echo "$RESULT" | grep -q '"code"'; then
        echo "   ❌ Fehler Seite $PAGE: $RESULT"
        ERRORS=$((ERRORS + ITEMS_COUNT))
    else
        IMPORTED=$((IMPORTED + ITEMS_COUNT))
    fi
    
    PCT=$((IMPORTED * 100 / TOTAL))
    printf "   Seite %d: %d/%d (%d%%)      \r" "$PAGE" "$IMPORTED" "$TOTAL" "$PCT"
    
    # Prüfen ob letzte Seite
    PAGES=$(echo "$JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pages',1))")
    if [ "$PAGE" -ge "$PAGES" ]; then
        break
    fi
    
    PAGE=$((PAGE + 1))
    sleep 1  # Rate-Limit
done

echo ""
echo "   ✅ $IMPORTED Artikel importiert"

sleep 1

# ============================================================
# 4. Rabatte
# ============================================================

echo ""
echo "💰 4. Kunden-Rabatte importieren..."
DISCOUNTS_JSON=$(easybill_fetch "/discounts/position-group?limit=1000")
DISCOUNTS_COUNT=$(echo "$DISCOUNTS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))")
echo "   Gefunden: $DISCOUNTS_COUNT"

# Rabatte verarbeiten (mit Partner-Lookup)
echo "$DISCOUNTS_JSON" | python3 << 'PYEOF'
import sys, json, subprocess

data = json.load(sys.stdin)
discounts = data.get('items', [])

rows = []
skipped = 0

for d in discounts:
    customer_id = d.get('customer_id')
    
    # Partner suchen
    result = subprocess.run([
        'curl', '-s',
        '-H', f'apikey: {subprocess.check_output(["grep", "^SUPABASE_SERVICE_ROLE_KEY=", "/home/botti/.openclaw/workspace/.env.production"]).decode().strip().split("=", 1)[1]}',
        '-H', f'Authorization: ***{subprocess.check_output(["grep", "^SUPABASE_SERVICE_ROLE_KEY=", "/home/botti/.openclaw/workspace/.env.production"]).decode().strip().split("=", 1)[1]}',
        f'https://supabase.gudel-werkzeuge.de/rest/v1/partners?easybill_id=eq.{customer_id}&select=id'
    ], capture_output=True, text=True)
    
    partners = json.loads(result.stdout)
    
    if not partners:
        skipped += 1
        continue
    
    rows.append({
        'partner_id': partners[0]['id'],
        'easybill_discount_id': d['id'],
        'position_group_id': d.get('position_group_id'),
        'discount_percent': d.get('discount'),
        'discount_type': d.get('discount_type'),
        'raw_easybill_payload': d
    })

with open('/tmp/prod-25-discounts.json', 'w') as f:
    json.dump(rows, f)

print(f"Rows: {len(rows)}, Skipped: {skipped}")
PYEOF

DISCOUNT_RESULT=$(cat /tmp/prod-25-discounts.json)
DISCOUNT_ROWS=$(echo "$DISCOUNT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")

if [ "$DISCOUNT_ROWS" -gt 0 ]; then
    supabase_upsert "partner_discounts" "$DISCOUNT_RESULT" > /dev/null
fi

echo "   ✅ $DISCOUNT_ROWS Rabatte gespeichert"

# ============================================================
# Ergebnis
# ============================================================

echo ""
echo "========================================"
echo "📋 ERGEBNIS"
echo "========================================"
echo "Produktgruppen:     $GROUPS_COUNT"
echo "Kundengruppen:      $CUST_GROUPS_COUNT"
echo "Artikel:            $IMPORTED"
echo "Rabatte:            $DISCOUNT_ROWS"
echo "========================================"
echo "✅ PROJ-25: Import abgeschlossen!"
