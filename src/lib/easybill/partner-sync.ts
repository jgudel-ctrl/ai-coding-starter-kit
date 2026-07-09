/**
 * Easybill Partner Sync Logik
 * 
 * Sync von Easybill-Kunden (Neu + Update) in unsere TMS-Datenbank.
 * Wird aufgerufen von Webhook und Cronjob.
 * 
 * Regeln (von Jan Bernd):
 * Ü1: display_name = Firmenname (bevorzugt), sonst Vor-/Nachname
 * Ü2: Archivierte Easybill-Kunden → is_active = false
 * Ü3: Dubletten: gleicher Name + Adresse → umsatzschwächeren deaktivieren
 * Ü4: Immer Lieferadresse (sonst Rechnung kopieren) + Kontakt mit E-Mail
 * Ü5: Gelöschte Adressen/Kontakte nur deaktivieren, nie löschen
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Typen
// ============================================================

export interface SyncPartnerResult {
  success: boolean;
  partnerId?: string;
  actions: string[];
  errors: string[];
}

// Easybill Customer (vereinfacht)
export interface EasybillCustomer {
  id: number;
  number: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  emails: { email: string; label?: string }[] | null;
  phone: string | null;
  mobile: string | null;
  address: EasybillAddress | null;
  delivery_address: EasybillAddress | null;
  group_id: number | null;
  vat_identifier: string | null;
  tax_number: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface EasybillAddress {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  number: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  [key: string]: any;
}

// ============================================================
// Haupt-Funktion: Sync Easybill Customer
// ============================================================

export async function syncEasybillCustomer(
  customer: EasybillCustomer
): Promise<SyncPartnerResult> {
  const supabase = createAdminClient();
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Prüfen: Existiert schon?
    const { data: existing } = await supabase
      .from('partners')
      .select('id, easybill_customer_number')
      .eq('easybill_customer_number', customer.number)
      .single();

    let partnerId: string;

    if (existing) {
      // UPDATE
      const updateResult = await updatePartner(supabase, customer, existing.id);
      partnerId = updateResult.partnerId;
      actions.push('updated');
      if (updateResult.errors.length) errors.push(...updateResult.errors);
    } else {
      // CREATE
      const createResult = await createPartner(supabase, customer);
      partnerId = createResult.partnerId;
      actions.push('created');
      if (createResult.errors.length) errors.push(...createResult.errors);
    }

    // 2. Adressen sync
    const addressResult = await syncAddresses(supabase, partnerId, customer);
    actions.push(...addressResult.actions);
    errors.push(...addressResult.errors);

    // 3. Kontakte sync
    const contactResult = await syncContacts(supabase, partnerId, customer);
    actions.push(...contactResult.actions);
    errors.push(...contactResult.errors);

    // 4. Rabatte sync (Voll-Replace)
    const discountResult = await syncDiscounts(supabase, partnerId, customer.id);
    actions.push(...discountResult.actions);
    errors.push(...discountResult.errors);

    // 5. Nach-Sync: Rechnungen verknüpfen
    const linkResult = await linkOrphanedInvoices(supabase, partnerId, customer.number);
    if (linkResult.count > 0) {
      actions.push(`linked ${linkResult.count} invoices`);
    }

    return { success: true, partnerId, actions, errors };

  } catch (error: any) {
    return {
      success: false,
      actions,
      errors: [...errors, `Fatal error: ${error.message}`],
    };
  }
}

// ============================================================
// Create Partner
// ============================================================

async function createPartner(supabase: any, customer: EasybillCustomer) {
  const errors: string[] = [];

  // Regel Ü1: display_name = Firmenname (bevorzugt), sonst Name
  const displayName = customer.company_name?.trim()
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || 'Unbekannt';

  // Regel Ü4: Prüfen ob Adresse existiert
  if (!customer.address) {
    errors.push('Keine Rechnungsadresse in Easybill vorhanden');
  }

  // Regel Ü4: E-Mail muss vorhanden sein
  const primaryEmail = customer.emails?.[0]?.email || customer.address?.email;
  if (!primaryEmail) {
    errors.push('Keine E-Mail-Adresse für Kontakt vorhanden');
  }

  // Regel Ü2: Archivierte Kunden → is_active = false
  const isActive = !customer.archived;

  const { data: partner, error } = await supabase
    .from('partners')
    .insert({
      easybill_id: customer.id,
      easybill_customer_number: customer.number,
      partner_type: 'customer',
      entity_type: customer.company_name ? 'company' : 'person',
      company_name: customer.company_name,
      first_name: customer.first_name,
      last_name: customer.last_name,
      display_name: displayName,
      email: primaryEmail,
      phone: customer.phone,
      mobile: customer.mobile,
      vat_identifier: customer.vat_identifier,
      tax_number: customer.tax_number,
      easybill_group_id: customer.group_id,
      is_active: isActive,
      is_archived: false,
      source_system: 'easybill',
      raw_easybill_payload: customer,
      easybill_created_at: customer.created_at,
      easybill_updated_at: customer.updated_at,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Partner konnte nicht angelegt werden: ${error.message}`);
  }

  return { partnerId: partner.id, errors };
}

// ============================================================
// Update Partner
// ============================================================

async function updatePartner(supabase: any, customer: EasybillCustomer, partnerId: string) {
  const errors: string[] = [];

  const displayName = customer.company_name?.trim()
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || 'Unbekannt';

  const isActive = !customer.archived;

  const { error } = await supabase
    .from('partners')
    .update({
      company_name: customer.company_name,
      first_name: customer.first_name,
      last_name: customer.last_name,
      display_name: displayName,
      email: customer.emails?.[0]?.email || customer.address?.email,
      phone: customer.phone,
      mobile: customer.mobile,
      vat_identifier: customer.vat_identifier,
      tax_number: customer.tax_number,
      easybill_group_id: customer.group_id,
      is_active: isActive,
      raw_easybill_payload: customer,
      easybill_updated_at: customer.updated_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', partnerId);

  if (error) {
    errors.push(`Update fehlgeschlagen: ${error.message}`);
  }

  return { partnerId, errors };
}

// ============================================================
// Sync Adressen (Regel Ü4 + Ü5)
// ============================================================

async function syncAddresses(supabase: any, partnerId: string, customer: EasybillCustomer) {
  const actions: string[] = [];
  const errors: string[] = [];

  // Bestehende Adressen deaktivieren (Soft-Delete, Regel Ü5)
  await supabase
    .from('partner_addresses')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('partner_id', partnerId);

  // Rechnungsadresse
  if (customer.address) {
    const billingAddress = {
      partner_id: partnerId,
      address_type: 'billing',
      is_primary: true,
      is_active: true,
      company_name: customer.address.company_name,
      first_name: customer.address.first_name,
      last_name: customer.address.last_name,
      street: `${customer.address.street || ''} ${customer.address.number || ''}`.trim(),
      postal_code: customer.address.zip_code,
      city: customer.address.city,
      country: customer.address.country,
      raw_easybill_payload: customer.address,
    };

    const { error } = await supabase.from('partner_addresses').insert(billingAddress);
    if (error) errors.push(`Rechnungsadresse fehlgeschlagen: ${error.message}`);
    else actions.push('billing_address_inserted');
  }

  // Lieferadresse (Regel Ü4: falls nicht vorhanden, Rechnungsadresse kopieren)
  const deliveryAddr = customer.delivery_address || customer.address;
  if (deliveryAddr) {
    const shippingAddress = {
      partner_id: partnerId,
      address_type: 'shipping',
      is_primary: false,
      is_active: true,
      company_name: deliveryAddr.company_name,
      first_name: deliveryAddr.first_name,
      last_name: deliveryAddr.last_name,
      street: `${deliveryAddr.street || ''} ${deliveryAddr.number || ''}`.trim(),
      postal_code: deliveryAddr.zip_code,
      city: deliveryAddr.city,
      country: deliveryAddr.country,
      raw_easybill_payload: deliveryAddr,
    };

    const { error } = await supabase.from('partner_addresses').insert(shippingAddress);
    if (error) errors.push(`Lieferadresse fehlgeschlagen: ${error.message}`);
    else actions.push('shipping_address_inserted');
  }

  return { actions, errors };
}

// ============================================================
// Sync Kontakte (Regel Ü4 + Ü5)
// ============================================================

async function syncContacts(supabase: any, partnerId: string, customer: EasybillCustomer) {
  const actions: string[] = [];
  const errors: string[] = [];

  // Bestehende Kontakte deaktivieren (Soft-Delete, Regel Ü5)
  await supabase
    .from('partner_contacts')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('partner_id', partnerId);

  // Hauptkontakt aus Kunden-Daten
  const primaryEmail = customer.emails?.[0]?.email;
  
  if (primaryEmail) {
    const contact = {
      partner_id: partnerId,
      first_name: customer.first_name,
      last_name: customer.last_name,
      display_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unbekannt',
      email: primaryEmail,
      phone: customer.phone,
      mobile: customer.mobile,
      is_primary: true,
      is_invoice_recipient: true,
      is_active: true,
    };

    const { error } = await supabase.from('partner_contacts').insert(contact);
    if (error) errors.push(`Kontakt fehlgeschlagen: ${error.message}`);
    else actions.push('primary_contact_inserted');
  } else {
    errors.push('Regel Ü4 verletzt: Kein Kontakt mit E-Mail vorhanden');
  }

  return { actions, errors };
}

// ============================================================
// Sync Rabatte (Voll-Replace)
// ============================================================

async function syncDiscounts(supabase: any, partnerId: string, easybillCustomerId: number) {
  const actions: string[] = [];
  const errors: string[] = [];
  let pgData: any = null;

  try {
    // 1. Produktgruppen aktualisieren
    const pgResponse = await fetch(
      'https://api.easybill.de/rest/v1/position-groups',
      {
        headers: {
          Authorization: `Bearer ${process.env.EASYBILL_API_KEY}`,
        },
      }
    );
    
    if (pgResponse.ok) {
      pgData = await pgResponse.json();
      for (const group of pgData.items || []) {
        await supabase.from('position_groups').upsert({
          id: group.id,
          name: group.name,
          display_name: group.display_name,
          number: group.number,
          description: group.description,
          raw_easybill_payload: group,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 2. Alte Rabatte löschen
    await supabase.from('partner_discounts').delete().eq('partner_id', partnerId);

    // 3. Neue Rabatte importieren
    const discountResponse = await fetch(
      `https://api.easybill.de/rest/v1/discounts/position-group?customer_id=${easybillCustomerId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.EASYBILL_API_KEY}`,
        },
      }
    );

    if (discountResponse.ok) {
      const discountData = await discountResponse.json();
      const discounts = discountData.items || [];

      for (const discount of discounts) {
        const group = pgData?.items?.find((g: any) => g.id === discount.position_group_id);
        
        await supabase.from('partner_discounts').insert({
          partner_id: partnerId,
          easybill_discount_id: discount.id,
          position_group_id: discount.position_group_id,
          position_group_name: group?.name,
          position_group_number: group?.number,
          discount_percent: discount.discount,
          discount_type: discount.discount_type,
          raw_easybill_payload: discount,
        });
      }

      actions.push(`imported ${discounts.length} discounts`);
    }

  } catch (error: any) {
    errors.push(`Rabatt-Sync fehlgeschlagen: ${error.message}`);
  }

  return { actions, errors };
}

// ============================================================
// Dubletten-Prüfung (Regel Ü3)
// ============================================================

export async function checkForDuplicates(supabase: any, partnerId: string) {
  try {
    // Partner-Daten holen
    const { data: partner } = await supabase
      .from('partners')
      .select('display_name, company_name, first_name, last_name')
      .eq('id', partnerId)
      .single();

    if (!partner) return;

    // Adressen holen
    const { data: addresses } = await supabase
      .from('partner_addresses')
      .select('address_type, street, postal_code, city')
      .eq('partner_id', partnerId)
      .eq('is_active', true);

    const billingAddr = addresses?.find((a: any) => a.address_type === 'billing');
    const shippingAddr = addresses?.find((a: any) => a.address_type === 'shipping');

    // Kandidaten suchen: Gleicher Name
    const { data: candidates } = await supabase
      .from('partners')
      .select('id, display_name, company_name')
      .or(`display_name.eq.${partner.display_name},company_name.eq.${partner.company_name || ''}`)
      .neq('id', partnerId)
      .is('duplicate_of', null);

    if (!candidates?.length) return;

    for (const candidate of candidates) {
      // Adressen des Kandidaten holen
      const { data: candidateAddresses } = await supabase
        .from('partner_addresses')
        .select('address_type, street, postal_code, city')
        .eq('partner_id', candidate.id)
        .eq('is_active', true);

      const candBilling = candidateAddresses?.find((a: any) => a.address_type === 'billing');
      const candShipping = candidateAddresses?.find((a: any) => a.address_type === 'shipping');

      // Vergleichen: Gleiche Adresse?
      const sameBilling = billingAddr && candBilling &&
        billingAddr.street === candBilling.street &&
        billingAddr.postal_code === candBilling.postal_code;

      const sameShipping = shippingAddr && candShipping &&
        shippingAddr.street === candShipping.street &&
        shippingAddr.postal_code === candShipping.postal_code;

      if (sameBilling || sameShipping) {
        // Umsatz vergleichen
        const { data: partnerRevenue } = await supabase
          .from('invoices')
          .select('total_net')
          .eq('partner_id', partnerId)
          .eq('status', 'paid');

        const { data: candidateRevenue } = await supabase
          .from('invoices')
          .select('total_net')
          .eq('partner_id', candidate.id)
          .eq('status', 'paid');

        const pRevenue = partnerRevenue?.reduce((sum: number, inv: any) => sum + (inv.total_net || 0), 0) || 0;
        const cRevenue = candidateRevenue?.reduce((sum: number, inv: any) => sum + (inv.total_net || 0), 0) || 0;

        // Weniger Umsatz = Dublette
        if (pRevenue <= cRevenue) {
          await supabase.from('partners').update({
            is_active: false,
            duplicate_of: candidate.id,
            duplicate_reason: `Auto-detected: Same name/address. Revenue: ${pRevenue} vs ${cRevenue}`,
          }).eq('id', partnerId);
        } else {
          await supabase.from('partners').update({
            is_active: false,
            duplicate_of: partnerId,
            duplicate_reason: `Auto-detected: Same name/address. Revenue: ${cRevenue} vs ${pRevenue}`,
          }).eq('id', candidate.id);
        }
      }
    }

  } catch (error: any) {
    console.error('Dubletten-Prüfung fehlgeschlagen:', error.message);
  }
}

// ============================================================
// Nach-Sync: Rechnungen verknüpfen
// ============================================================

async function linkOrphanedInvoices(supabase: any, partnerId: string, customerNumber: string) {
  try {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .update({ partner_id: partnerId })
      .is('partner_id', null)
      .eq('customer_id', customerNumber)
      .select();

    if (error) {
      console.error('Rechnungs-Verknüpfung fehlgeschlagen:', error.message);
      return { count: 0 };
    }

    return { count: invoices?.length || 0 };
  } catch (error: any) {
    console.error('Rechnungs-Verknüpfung fehlgeschlagen:', error.message);
    return { count: 0 };
  }
}
