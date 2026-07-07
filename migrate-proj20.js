const { Client } = require('pg');

const client = new Client({
  host: 'db.supabase.gudel-werkzeuge.de',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_SERVICE_ROLE_KEY,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const migrationSQL = `
-- 1) Blocker-Tabelle erstellen
CREATE TABLE IF NOT EXISTS tms.blocked_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    von_datum DATE NOT NULL,
    bis_datum DATE NOT NULL,
    grund TEXT NOT NULL DEFAULT 'Urlaub',
    typ TEXT NOT NULL DEFAULT 'manuell' CHECK (typ IN ('feiertag', 'manuell')),
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    erstellt_von UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT check_vor_bis CHECK (von_datum <= bis_datum)
);

CREATE INDEX IF NOT EXISTS idx_blocked_days_von ON tms.blocked_days(von_datum);
CREATE INDEX IF NOT EXISTS idx_blocked_days_bis ON tms.blocked_days(bis_datum);

ALTER TABLE tms.blocked_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_days_select_policy ON tms.blocked_days;
DROP POLICY IF EXISTS blocked_days_admin_policy ON tms.blocked_days;

CREATE POLICY blocked_days_select_policy ON tms.blocked_days
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY blocked_days_admin_policy ON tms.blocked_days
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

GRANT ALL ON tms.blocked_days TO service_role;
GRANT ALL ON tms.blocked_days TO postgres;

COMMENT ON TABLE tms.blocked_days IS 'Blocker-Tage/Zeiträume: Feiertage NRW + manuelle Einträge (Urlaub, Betriebsferien). An diesen Tagen finden keine Abholungen statt.';
COMMENT ON COLUMN tms.blocked_days.von_datum IS 'Start-Tag (inclusive)';
COMMENT ON COLUMN tms.blocked_days.bis_datum IS 'End-Tag (inclusive)';
COMMENT ON COLUMN tms.blocked_days.typ IS 'feiertag = automatisch berechnet, manuell = Admin-Eintrag';

-- 2) pickup_day Kommentar (existiert bereits)
COMMENT ON COLUMN tms.partner_order_defaults.pickup_day IS 'Abholtag: 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr. Nur relevant bei Abholservice.';
`;

async function migrate() {
  try {
    await client.connect();
    console.log('✅ Verbunden mit DB');
    
    console.log('Führe Migration aus...');
    await client.query(migrationSQL);
    console.log('✅ Blocker-Tabelle erstellt');
    
    // Status-Enum umbenennen
    const checkResult = await client.query(`
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'tms.order_status'::regtype 
      AND enumlabel = 'abgeholt'
    `);
    
    if (checkResult.rows.length > 0) {
      await client.query(`
        CREATE TYPE tms.order_status_new AS ENUM (
          'geplan', 'erledigt', 'in_bearbeitung', 'abgeschlossen', 'archiviert'
        );
        
        ALTER TABLE tms.tours 
          ALTER COLUMN status TYPE tms.order_status_new 
          USING status::text::tms.order_status_new;
        
        DROP TYPE tms.order_status;
        ALTER TYPE tms.order_status_new RENAME TO order_status;
      `);
      console.log('✅ Status-Enum umbenannt: abgeholt → erledigt');
    } else {
      console.log('ℹ️ Status "abgeholt" nicht gefunden — überspringe Umbenennung');
    }
    
    // Verifizierung
    const verifyResult = await client.query(`
      SELECT enumlabel FROM pg_enum WHERE enumtypid = 'tms.order_status'::regtype ORDER BY enumsortorder
    `);
    console.log('\nStatus-Werte:', verifyResult.rows.map(r => r.enumlabel));
    
    const countResult = await client.query('SELECT COUNT(*) FROM tms.blocked_days');
    console.log('Blocked Days:', countResult.rows[0].count);
    
    console.log('\n🎉 Migration erfolgreich!');
  } catch (err) {
    console.error('❌ Fehler:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
