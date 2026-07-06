#!/usr/bin/env python3
"""
Import-Script für Touren aus Excel-Datei
PROJ-19 - Tourenverwaltung (ehemals Auftragsverwaltung)
Tabelle umbenannt: orders → tours am 2026-07-06

Voraussetzungen:
    pip install openpyxl psycopg2-binary

Usage:
    python3 import_tours.py /path/to/abholung_export.xlsx
"""

import sys
import os
import openpyxl
import psycopg2
from datetime import datetime
from collections import Counter

# Datenbank-Verbindung
DB_HOST = 'localhost'
DB_PORT = 5432
DB_NAME = 'postgres'
DB_USER = 'postgres'
DB_PASS = 'db010d237b9052d3802e86ab46214049'

def get_db_connection():
    """Erstellt eine Datenbankverbindung"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def load_excel_data(filepath):
    """Liest die Excel-Datei und gibt die Daten zurück"""
    print(f"📖 Lese Excel-Datei: {filepath}")
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    
    data = []
    for row in ws.iter_rows(min_row=2, values_only=True):  # Header überspringen
        if row[0] is not None:  # Nur Zeilen mit Kundennummer
            data.append({
                'kundennummer': str(int(row[0])) if isinstance(row[0], (int, float)) else str(row[0]).strip(),
                'datum': row[1],
                'status': row[2]
            })
    
    print(f"✅ {len(data)} Datensätze gelesen")
    return data

def analyze_data(data):
    """Analysiert die Daten vor dem Import"""
    print("\n📊 Analyse der Daten:")
    
    # Status-Verteilung
    statuses = Counter(row['status'] for row in data)
    print(f"\nStatus-Verteilung:")
    for status, count in statuses.most_common():
        print(f"  {status}: {count}")
    
    # Einzigartige Kundennummern
    kundennummern = set(row['kundennummer'] for row in data)
    print(f"\nEinzigartige Kundennummern: {len(kundennummern)}")
    
    # Datumsbereich
    daten = [row['datum'] for row in data if row['datum']]
    if daten:
        print(f"Datumsbereich: {min(daten)} bis {max(daten)}")
    
    return kundennummern

def check_partner_mapping(conn, kundennummern):
    """Prüft, wie viele Kundennummern in der DB existieren"""
    print("\n🔍 Prüfe Kundennummern-Mapping...")
    
    cur = conn.cursor()
    
    # Hole alle easybill_customer_number
    cur.execute("""
        SELECT easybill_customer_number, id, company_name 
        FROM tms.partners 
        WHERE easybill_customer_number IS NOT NULL
    """)
    db_kunden = {row[0]: {'id': row[1], 'name': row[2]} for row in cur.fetchall()}
    
    found = 0
    not_found = []
    for kn in kundennummern:
        if kn in db_kunden:
            found += 1
        else:
            not_found.append(kn)
    
    print(f"✅ Gefunden: {found}/{len(kundennummern)} Kundennummern")
    if not_found:
        print(f"⚠️  Nicht gefunden: {len(not_found)} Kundennummern")
        print(f"   Beispiele: {not_found[:10]}")
    
    cur.close()
    return db_kunden, not_found

def get_partner_defaults(conn, partner_ids):
    """Holt die Auftrags-Defaults für die Partner"""
    print("\n📋 Hole Auftrags-Defaults...")
    
    cur = conn.cursor()
    cur.execute("""
        SELECT partner_id, inbound_type, outbound_type, driver_id, pickup_cycle_count, pickup_delivery_status
        FROM tms.partner_order_defaults
        WHERE partner_id = ANY(%s)
    """, (list(partner_ids),))
    
    defaults = {}
    for row in cur.fetchall():
        defaults[row[0]] = {
            'zugang': row[1] or 'Bringen',
            'ruecksendung': row[2] or 'Lieferung',
            'fahrer_id': row[3],
            'abholzyklus_wochen': row[4],
            'abholservice': row[5] == 'Automatisch' if row[5] else False
        }
    
    print(f"✅ Defaults für {len(defaults)} Partner geladen")
    cur.close()
    return defaults

def get_admin_user(conn):
    """Holt einen Admin-User für erstellt_von"""
    cur = conn.cursor()
    cur.execute("""
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
        LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None

def import_tours(conn, data, db_kunden, admin_user_id):
    """Importiert die Touren in die Datenbank"""
    print("\n📥 Starte Import...")
    
    cur = conn.cursor()
    
    # Hole Defaults
    partner_ids = [db_kunden[row['kundennummer']]['id'] for row in data if row['kundennummer'] in db_kunden]
    defaults = get_partner_defaults(conn, partner_ids)
    
    inserted = 0
    skipped = 0
    errors = []
    
    for row in data:
        kn = row['kundennummer']
        if kn not in db_kunden:
            skipped += 1
            continue
        
        partner_id = db_kunden[kn]['id']
        default = defaults.get(partner_id, {})
        
        # Status-Mapping
        csv_status = row['status']
        if csv_status == 'Werkzeuge abholen':
            db_status = 'geplant'
            geplantes = row['datum']
            tatsaechliches = None
        elif csv_status == 'Wareneingang':
            db_status = 'abgeholt'
            geplantes = None
            tatsaechliches = row['datum']
        elif csv_status == 'Archiv':
            db_status = 'archiviert'
            geplantes = None
            tatsaechliches = row['datum']
        else:
            db_status = 'geplant'
            geplantes = row['datum']
            tatsaechliches = None
        
        try:
            cur.execute("""
                INSERT INTO tms.tours (
                    partner_id, status, geplantes_abholdatum, tatsaechliches_abholdatum,
                    zugang, ruecksendung, fahrer_id, abholzyklus_wochen, abholservice,
                    erstellt_von, titel
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                partner_id,
                db_status,
                geplantes,
                tatsaechliches,
                default.get('zugang', 'Bringen'),
                default.get('ruecksendung', 'Lieferung'),
                default.get('fahrer_id'),
                default.get('abholzyklus_wochen'),
                default.get('abholservice', False),
                admin_user_id,
                'Migration aus Alt-System'
            ))
            inserted += 1
        except Exception as e:
            errors.append(f"Fehler bei Kunde {kn}: {e}")
    
    conn.commit()
    cur.close()
    
    print(f"\n✅ Import abgeschlossen:")
    print(f"   Eingefügt: {inserted}")
    print(f"   Übersprungen (kein Mapping): {skipped}")
    print(f"   Fehler: {len(errors)}")
    
    if errors:
        print(f"\n⚠️  Fehler:")
        for err in errors[:10]:
            print(f"   {err}")
    
    return inserted, skipped, errors

def verify_import(conn):
    """Verifiziert den Import"""
    print("\n🔍 Verifizierung:")
    
    cur = conn.cursor()
    
    # Status-Verteilung
    cur.execute("""
        SELECT status, COUNT(*) 
        FROM tms.tours 
        GROUP BY status 
        ORDER BY COUNT(*) DESC
    """)
    print("\nStatus-Verteilung in DB:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    # Beispiele
    cur.execute("""
        SELECT t.id, p.company_name, t.status, t.geplantes_abholdatum, t.tatsaechliches_abholdatum
        FROM tms.tours t
        JOIN tms.partners p ON p.id = t.partner_id
        LIMIT 5
    """)
    print("\nBeispiel-Datensätze:")
    for row in cur.fetchall():
        print(f"  {row[1]}: {row[2]} (geplant: {row[3]}, tatsächlich: {row[4]})")
    
    cur.close()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_tours.py <excel-file>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    
    if not os.path.exists(filepath):
        print(f"❌ Datei nicht gefunden: {filepath}")
        sys.exit(1)
    
    # Daten laden
    data = load_excel_data(filepath)
    kundennummern = analyze_data(data)
    
    # DB-Verbindung
    print("\n🔗 Verbinde zur Datenbank...")
    conn = get_db_connection()
    print("✅ Verbunden")
    
    try:
        # Kundennummern prüfen
        db_kunden, not_found = check_partner_mapping(conn, kundennummern)
        
        if not_found:
            print(f"\n⚠️  {len(not_found)} Kundennummern nicht in DB gefunden.")
            antwort = input("Trotzdem fortfahren? (j/n): ")
            if antwort.lower() != 'j':
                print("❌ Abgebrochen")
                return
        
        # Admin-User holen
        admin_user_id = get_admin_user(conn)
        if not admin_user_id:
            print("❌ Kein Admin-User gefunden!")
            return
        print(f"✅ Admin-User gefunden: {admin_user_id}")
        
        # Import durchführen
        inserted, skipped, errors = import_tours(conn, data, db_kunden, admin_user_id)
        
        # Verifizierung
        verify_import(conn)
        
        print(f"\n🎉 Import abgeschlossen!")
        print(f"   {inserted} Touren erfolgreich importiert")
        
    finally:
        conn.close()
        print("\n🔌 Verbindung geschlossen")

if __name__ == '__main__':
    main()
