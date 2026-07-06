import openpyxl
import psycopg2
from collections import Counter

# Datenbank-Verbindung (innerhalb des Docker-Containers)
DB_HOST = 'localhost'
DB_PORT = 5432
DB_NAME = 'postgres'
DB_USER = 'postgres'
DB_PASS = 'db010d237b9052d3802e86ab46214049'

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )

def load_excel_data(filepath):
    print(f"📖 Lese Excel-Datei: {filepath}")
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    data = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is not None:
            data.append({
                'kundennummer': str(int(row[0])) if isinstance(row[0], (int, float)) else str(row[0]).strip(),
                'datum': row[1],
                'status': row[2]
            })
    print(f"✅ {len(data)} Datensätze gelesen")
    return data

def analyze_data(data):
    print("\n📊 Analyse:")
    statuses = Counter(row['status'] for row in data)
    for status, count in statuses.most_common():
        print(f"  {status}: {count}")
    kundennummern = set(row['kundennummer'] for row in data)
    print(f"\nEinzigartige Kundennummern: {len(kundennummern)}")
    daten = [row['datum'] for row in data if row['datum']]
    if daten:
        print(f"Datumsbereich: {min(daten)} bis {max(daten)}")
    return kundennummern

def check_partner_mapping(conn, kundennummern):
    print("\n🔍 Prüfe Kundennummern-Mapping...")
    cur = conn.cursor()
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
    print(f"✅ Gefunden: {found}/{len(kundennummern)}")
    if not_found:
        print(f"⚠️  Nicht gefunden: {len(not_found)} (Beispiele: {not_found[:10]})")
    cur.close()
    return db_kunden, not_found

def get_partner_defaults(conn, partner_ids):
    print("\n📋 Hole Defaults...")
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
    print(f"✅ Defaults für {len(defaults)} Partner")
    cur.close()
    return defaults

def get_admin_user(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
        LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None

def import_orders(conn, data, db_kunden, admin_user_id):
    print("\n📥 Starte Import...")
    cur = conn.cursor()
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
                INSERT INTO tms.orders (
                    partner_id, status, geplantes_abholdatum, tatsaechliches_abholdatum,
                    zugang, ruecksendung, fahrer_id, abholzyklus_wochen, abholservice,
                    erstellt_von, titel
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                partner_id, db_status, geplantes, tatsaechliches,
                default.get('zugang', 'Bringen'), default.get('ruecksendung', 'Lieferung'),
                default.get('fahrer_id'), default.get('abholzyklus_wochen'),
                default.get('abholservice', False), admin_user_id, 'Migration aus Alt-System'
            ))
            inserted += 1
        except Exception as e:
            errors.append(f"Kunde {kn}: {e}")
    
    conn.commit()
    cur.close()
    
    print(f"\n✅ Import abgeschlossen:")
    print(f"   Eingefügt: {inserted}")
    print(f"   Übersprungen: {skipped}")
    print(f"   Fehler: {len(errors)}")
    if errors:
        for err in errors[:10]:
            print(f"   {err}")
    return inserted, skipped, errors

def verify_import(conn):
    print("\n🔍 Verifizierung:")
    cur = conn.cursor()
    cur.execute("SELECT status, COUNT(*) FROM tms.orders GROUP BY status ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")
    cur.execute("""
        SELECT p.company_name, o.status, o.geplantes_abholdatum, o.tatsaechliches_abholdatum
        FROM tms.orders o JOIN tms.partners p ON p.id = o.partner_id LIMIT 5
    """)
    print("\nBeispiele:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} (geplant: {row[2]}, tatsächlich: {row[3]})")
    cur.close()

def main():
    filepath = '/tmp/abholung_export---59c6dc23-50f0-4787-b873-6cdacb5cca78.xlsx'
    data = load_excel_data(filepath)
    kundennummern = analyze_data(data)
    
    print("\n🔗 Verbinde zur Datenbank...")
    conn = get_db_connection()
    print("✅ Verbunden")
    
    try:
        db_kunden, not_found = check_partner_mapping(conn, kundennummern)
        admin_user_id = get_admin_user(conn)
        print(f"✅ Admin-User: {admin_user_id}")
        
        inserted, skipped, errors = import_orders(conn, data, db_kunden, admin_user_id)
        verify_import(conn)
        
        print(f"\n🎉 {inserted} Aufträge importiert!")
    finally:
        conn.close()
        print("\n🔌 Verbindung geschlossen")

if __name__ == '__main__':
    main()
