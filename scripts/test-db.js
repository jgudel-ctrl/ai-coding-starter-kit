const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url);
console.log('KEY (first 20):', key?.slice(0, 20));

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'tms' },
});

async function test() {
  // Test 1: Count
  const { count, error: e1 } = await client
    .from('invoices')
    .select('*', { count: 'exact', head: true });
  console.log('Count:', count, 'Error:', e1);

  // Test 2: Insert
  const { data, error: e2 } = await client
    .from('invoices')
    .insert({
      id: 9999999999,
      invoice_number: 'TEST-999',
      type: 'INVOICE',
      document_date: '2024-01-01',
      amount: 1000,
      amount_net: 840,
      paid_amount: 1000,
      currency: 'EUR',
      payment_status: 'paid',
      created_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .select();

  console.log('Insert data:', data);
  console.log('Insert error:', JSON.stringify(e2));
}

test().catch(console.error);
