const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/botti/.openclaw/workspace/.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'tms' } }
);

async function migrate() {
  const { data: existingColumns, error: colError } = await supabase
    .from('partner_addresses')
    .select('*')
    .limit(1);
    
  if (colError) {
    console.error('❌ Fehler:', colError.message);
    return;
  }
  
  const hasGeoapify = existingColumns[0] && 'geoapify_confidence' in existingColumns[0];
  
  if (hasGeoapify) {
    console.log('✅ Geoapify-Spalten existieren bereits');
    return;
  }
  
  const sql = [
    "ALTER TABLE tms.partner_addresses",
    "ADD COLUMN IF NOT EXISTS geoapify_confidence NUMERIC(3,2) DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_suggested_street TEXT DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_suggested_postal_code TEXT DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_suggested_city TEXT DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_suggested_country TEXT DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,",
    "ADD COLUMN IF NOT EXISTS geoapify_status TEXT DEFAULT NULL;",
    "",
    "CREATE INDEX IF NOT EXISTS idx_partner_addresses_geoapify_status",
    "ON tms.partner_addresses(geoapify_status)",
    "WHERE geoapify_status IS NULL;"
  ].join(' ');
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('❌ Migration fehlgeschlagen:', error.message);
  } else {
    console.log('✅ Migration erfolgreich!');
  }
}

migrate();
