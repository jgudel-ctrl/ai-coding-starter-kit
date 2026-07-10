#!/usr/bin/env python3
"""
PROJ-25: Initial-Import aus Easybill
Nutzt Python requests (fix für Node.js fetch Authorization-Header Bug)
"""

import os
import sys
import json
import time
import subprocess

WORKSPACE = "/home/botti/.openclaw/workspace"
SUPABASE_URL = "https://supabase.gudel-werkzeuge.de"

# API Keys holen
def get_env(key):
    with open(f"{WORKSPACE}/.env.production", "r") as f:
        for line in f:
            if line.startswith(f"{key}="):
                return line[len(key)+1:].strip()  # strip() entfernt \n
    return ""

EASYBILL_API_KEY = get_env("EASYBILL_API_KEY")
SUPABASE_KEY = get_env("SUPABASE_SERVICE_ROLE_KEY")

print(f"🚀 PROJ-25: Initial-Import aus Easybill")
print(f"========================================")
print(f"API Key: {EASYBILL_API_KEY[:10]}...")
print()

if not EASYBILL_API_KEY or not SUPABASE_KEY:
    print("❌ EASYBILL_API_KEY oder SUPABASE_SERVICE_ROLE_KEY fehlt")
    sys.exit(1)

# ============================================================
# Easybill API
# ============================================================

import requests

REQUEST_DELAY = 1.0

def easybill_fetch(endpoint):
    url = f"https://api.easybill.de/rest/v1{endpoint}"
    headers = {
        "Authorization": f"*** {EASYBILL_API_KEY}",
        "Content-Type": "application/json",
    }
    
    resp = requests.get(url, headers=headers, timeout=30)
    
    if resp.status_code == 429:
        print("   ⚠️  Rate limit, warte 3 Sek...")
        time.sleep(3)
        return easybill_fetch(endpoint)
    
    if resp.status_code != 200:
        raise Exception(f"Easybill {resp.status_code}: {resp.text[:200]}")
    
    return resp.json()

def delay():
    time.sleep(REQUEST_DELAY)

# ============================================================
# Supabase (Admin)
# ============================================================

def supabase_query(table, query):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"*** {SUPABASE_KEY}",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise Exception(f"Supabase query failed: {resp.status_code}")
    return resp.json()

def supabase_upsert(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"*** {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = requests.post(url, headers=headers, json=data, timeout=60)
    if resp.status_code not in (200, 201):
        raise Exception(f"Supabase upsert failed: {resp.status_code} - {resp.text[:200]}")
    return resp.json() if resp.text else []

# ============================================================
# Import-Funktionen
# ============================================================

def import_position_groups():
    print("📦 1. Produktgruppen importieren...")
    data = easybill_fetch("/position-groups?limit=1000")
    groups = data.get("items", [])
    print(f"   Gefunden: {len(groups)}")
    
    rows = [{
        "id": g["id"],
        "number": g.get("number"),
        "name": g.get("name"),
        "display_name": g.get("display_name"),
        "description": g.get("description"),
    } for g in groups]
    
    supabase_upsert("position_groups", rows)
    print(f"   ✅ {len(rows)} Produktgruppen gespeichert")
    return len(groups)

def import_customer_groups():
    print("\n👥 2. Kundengruppen importieren...")
    data = easybill_fetch("/customer-groups?limit=100")
    groups = data.get("items", [])
    print(f"   Gefunden: {len(groups)}")
    
    rows = [{
        "id": g["id"],
        "number": g.get("number"),
        "name": g.get("name"),
        "display_name": g.get("display_name"),
    } for g in groups]
    
    supabase_upsert("customer_groups", rows)
    print(f"   ✅ {len(rows)} Kundengruppen gespeichert")
    return len(groups)

def import_products():
    print("\n🔧 3. Artikel importieren (7.315, ~8 Seiten)...")
    
    page = 1
    total = 0
    imported = 0
    errors = 0
    
    while True:
        data = easybill_fetch(f"/positions?limit=1000&page={page}")
        items = data.get("items", [])
        
        if not items:
            break
        
        if page == 1:
            total = data.get("total", 0)
        
        rows = [{
            "id": p["id"],
            "number": p.get("number"),
            "description": p.get("description"),
            "type": p.get("type"),
            "group_id": p.get("group_id"),
            "cost_price": p.get("cost_price"),
            "sale_price": p.get("sale_price"),
            "vat_percent": p.get("vat_percent"),
            "unit": p.get("unit"),
            "archived": p.get("archived", False),
            "note": p.get("note"),
            "raw_easybill_payload": p,
        } for p in items]
        
        try:
            supabase_upsert("products", rows)
            imported += len(items)
        except Exception as err:
            print(f"   ❌ Batch-Fehler Seite {page}: {err}")
            errors += len(items)
        
        pct = (imported / total * 100) if total > 0 else 0
        print(f"   Seite {page}: {imported}/{total} ({pct:.1f}%)      ", end="\r")
        
        if page >= data.get("pages", 1):
            break
        
        page += 1
        delay()
    
    print()
    print(f"   ✅ {imported} Artikel importiert" + (f" ({errors} Fehler)" if errors > 0 else ""))
    return imported

def import_discounts():
    print("\n💰 4. Kunden-Rabatte importieren...")
    
    data = easybill_fetch("/discounts/position-group?limit=1000")
    discounts = data.get("items", [])
    
    print(f"   Gefunden: {len(discounts)}")
    
    rows = []
    skipped = 0
    
    for d in discounts:
        customer_id = d.get("customer_id")
        
        # Partner suchen
        partners = supabase_query("partners", f"easybill_id=eq.{customer_id}&select=id")
        
        if not partners:
            skipped += 1
            continue
        
        rows.append({
            "partner_id": partners[0]["id"],
            "easybill_discount_id": d["id"],
            "position_group_id": d.get("position_group_id"),
            "discount_percent": d.get("discount"),
            "discount_type": d.get("discount_type"),
            "raw_easybill_payload": d,
        })
    
    if rows:
        supabase_upsert("partner_discounts", rows)
    
    print(f"   ✅ {len(rows)} Rabatte gespeichert" + (f" ({skipped} ohne Partner)" if skipped > 0 else ""))
    return len(rows)

# ============================================================
# Hauptfunktion
# ============================================================

def main():
    import time
    start_time = time.time()
    
    try:
        total_groups = import_position_groups()
        delay()
        
        total_customers = import_customer_groups()
        delay()
        
        total_products = import_products()
        delay()
        
        total_discounts = import_discounts()
        
        duration = time.time() - start_time
        
        print()
        print("========================================")
        print("📋 ERGEBNIS")
        print("========================================")
        print(f"Dauer:              {duration:.1f}s")
        print(f"Produktgruppen:     {total_groups}")
        print(f"Kundengruppen:      {total_customers}")
        print(f"Artikel:            {total_products}")
        print(f"Rabatte:            {total_discounts}")
        print("========================================")
        
    except Exception as err:
        print(f"\n❌ Fataler Fehler: {err}")
        sys.exit(1)

if __name__ == "__main__":
    main()
