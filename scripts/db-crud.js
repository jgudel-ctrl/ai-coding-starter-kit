#!/usr/bin/env node
/**
 * DB-CRUD Tool für TMS 2.0
 * Direkte PostgreSQL-Verbindung über den Pooler
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzg2ODEwMTYsImV4cCI6MTkzNjM2MTAxNn0.OKObADZ0LYZS9dKS4El1ShwbBA6-BQH1a4hHKB9F5-M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' }
});

async function main() {
  const cmd = process.argv[2];
  const table = process.argv[3];
  
  if (!cmd) {
    console.log(`
Usage: node db-crud.js <command> <table> [args]

Commands:
  list <table>              → Alle Datensätze anzeigen
  get <table> <id>          → Einzelnen Datensatz anzeigen
  create <table> '{json}'   → Neuen Datensatz erstellen
  update <table> <id> '{json}' → Datensatz aktualisieren
  delete <table> <id>       → Datensatz löschen
  sql "<query>"             → Beliebige SQL-Query ausführen

Examples:
  node db-crud.js list kunden
  node db-crud.js create kunden '{"firmenname":"Test GmbH","status":"aktiv"}'
  node db-crud.js update kunden <uuid> '{"firmenname":"Neuer Name"}'
  node db-crud.js sql "SELECT * FROM kunden WHERE status='aktiv'"
`);
    return;
  }

  try {
    switch (cmd) {
      case 'list': {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case 'get': {
        const id = process.argv[4];
        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error) throw error;
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      case 'create': {
        const jsonCreate = JSON.parse(process.argv[4]);
        const { data, error } = await supabase.from(table).insert(jsonCreate).select();
        if (error) throw error;
        console.log('Created:', JSON.stringify(data, null, 2));
        break;
      }
      case 'update': {
        const updateId = process.argv[4];
        const jsonUpdate = JSON.parse(process.argv[5]);
        const { data, error } = await supabase.from(table).update(jsonUpdate).eq('id', updateId).select();
        if (error) throw error;
        console.log('Updated:', JSON.stringify(data, null, 2));
        break;
      }
      case 'delete': {
        const deleteId = process.argv[4];
        const { data, error } = await supabase.from(table).delete().eq('id', deleteId).select();
        if (error) throw error;
        console.log('Deleted:', JSON.stringify(data, null, 2));
        break;
      }
      case 'sql': {
        const query = process.argv[3];
        const { data, error } = await supabase.rpc('exec_sql', { query });
        if (error) throw error;
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      default:
        console.log('Unbekannter Befehl. Nutze ohne Argumente für Hilfe.');
    }
  } catch (err) {
    console.error('Fehler:', err.message || err);
    process.exit(1);
  }
}

main();
