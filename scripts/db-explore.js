#!/usr/bin/env node
/**
 * Datenbank-Explorer — Alle Tabellen in Supabase finden
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_SERVICE_KEY = 'eyJhbG…F5-M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' }
});

async function getAllTables() {
  // PostgreSQL System-Query: Alle Tabellen in 'public' Schema
  const { data, error } = await supabase.rpc('exec_sql', { 
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  });
  
  if (error) {
    // Fallback: manuell bekannte Tabellen testen
    console.log('RPC exec_sql nicht verfügbar, teste bekannte Tabellen...');
    return null;
  }
  return data;
}

async function checkTable(name) {
  try {
    const { data, error } = await supabase.from(name).select('*').limit(1);
    if (error) return { exists: false, error: error.message };
    return { exists: true, name };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function getTableColumns(tableName) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', tableName);
  
  if (error) return null;
  return data;
}

async function main() {
  // Versuche exec_sql
  console.log('=== DATENBANK-EXPLORER ===\n');
  
  const tables = await getAllTables();
  
  if (tables) {
    console.log('Gefundene Tabellen:', tables.map(t => t.table_name).join(', '));
  } else {
    // Manuelle Prüfung bekannter Tabellen
    const knownTables = [
      'profiles', 'users', 'user_invites', 'kunden', 'kunden_history',
      'werkzeuge', 'stationen', 'auftraege', 'materialien',
      'customers', 'clients', 'firmen', 'contacts', 'adressen'
    ];
    
    console.log('Prüfe bekannte Tabellen...\n');
    const found = [];
    for (const table of knownTables) {
      const result = await checkTable(table);
      if (result.exists) {
        found.push(table);
      }
    }
    console.log('✅ Gefundene Tabellen:', found.join(', ') || 'KEINE');
    
    // Für jede gefundene Tabelle: Spalten anzeigen
    for (const table of found) {
      console.log(`\n--- Tabelle: ${table} ---`);
      const { data, error } = await supabase.from(table).select('*').limit(0);
      if (data !== undefined && !error) {
        console.log('  Status: Erreichbar');
      }
    }
  }
}

main().catch(console.error);
