/**
 * Geoapify Adress-Validierung
 * 
 * Prüft Adressen auf Gültigkeit, korrigiert Schreibfehler,
 * gibt GPS-Koordinaten zurück.
 * 
 * Free-Tier Limits:
 * - 3.000 Credits/Tag
 * - Max. 5 Requests/Sekunde
 * - HTTPS erforderlich
 */

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1/geocode';

// Rate Limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms = max. 5 req/s

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

// ============================================================
// Haupt-Funktion: Adresse validieren
// ============================================================

export interface GeoapifyResult {
  status: 'valid' | 'invalid' | 'error';
  confidence?: number;
  formattedAddress?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  matchScore?: number;
  rawResponse?: any;
  errorMessage?: string;
}

export async function validateAddress(
  street: string,
  postalCode: string,
  city: string,
  country: string = 'DE'
): Promise<GeoapifyResult> {
  // API-Key prüfen
  if (!GEOAPIFY_API_KEY) {
    return {
      status: 'error',
      errorMessage: 'GEOAPIFY_API_KEY nicht konfiguriert',
    };
  }

  // Adresse zusammenbauen
  const addressText = `${street}, ${postalCode} ${city}, ${country}`;

  try {
    // Rate Limiting
    await rateLimit();

    // API Request
    const url = new URL(`${GEOAPIFY_BASE_URL}/search`);
    url.searchParams.append('text', addressText);
    url.searchParams.append('limit', '1');
    url.searchParams.append('lang', 'de');
    url.searchParams.append('format', 'json');
    url.searchParams.append('apiKey', GEOAPIFY_API_KEY);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: 'error',
        errorMessage: `Geoapify API Fehler: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    // Keine Ergebnisse
    if (!data.results || data.results.length === 0) {
      return {
        status: 'invalid',
        confidence: 0,
        errorMessage: 'Adresse nicht gefunden',
      };
    }

    const result = data.results[0];

    // Vertrauens-Score berechnen
    const confidence = result.rank?.confidence || 0;
    const matchScore = calculateMatchScore(addressText, result);

    // Ergebnis aufbereiten
    return {
      status: confidence > 0.5 ? 'valid' : 'invalid',
      confidence,
      formattedAddress: result.formatted,
      street: result.street,
      houseNumber: result.housenumber,
      postalCode: result.postcode,
      city: result.city,
      state: result.state,
      country: result.country,
      countryCode: result.country_code,
      lat: result.lat,
      lon: result.lon,
      matchScore,
      rawResponse: result,
    };

  } catch (error: any) {
    return {
      status: 'error',
      errorMessage: `Geoapify Request fehlgeschlagen: ${error.message}`,
    };
  }
}

// ============================================================
// Adresse in DB speichern (nach Validierung)
// ============================================================

export async function storeGeoapifyResult(
  supabase: any,
  addressId: string,
  result: GeoapifyResult
) {
  const { error } = await supabase
    .from('partner_addresses')
    .update({
      geoapify_validation_status: result.status,
      geoapify_validated_at: new Date().toISOString(),
      geoapify_formatted_address: result.formattedAddress,
      geoapify_street: result.street,
      geoapify_house_number: result.houseNumber,
      geoapify_postal_code: result.postalCode,
      geoapify_city: result.city,
      geoapify_state: result.state,
      geoapify_country: result.country,
      geoapify_country_code: result.countryCode,
      geoapify_lat: result.lat,
      geoapify_lon: result.lon,
      geoapify_rank_confidence: result.confidence,
      geoapify_match_score: result.matchScore,
      geoapify_result_raw: result.rawResponse,
      geoapify_is_valid: result.status === 'valid',
      geoapify_error: result.errorMessage,
      revalidate_address: result.status !== 'valid',
    })
    .eq('id', addressId);

  if (error) {
    console.error('Geoapify Ergebnis speichern fehlgeschlagen:', error.message);
  }
}

// ============================================================
// Hilfsfunktionen
// ============================================================

function calculateMatchScore(originalText: string, result: any): number {
  let score = 0;
  const original = originalText.toLowerCase();

  // PLZ Match
  if (result.postcode && original.includes(result.postcode.toLowerCase())) {
    score += 0.3;
  }

  // Stadt Match
  if (result.city && original.includes(result.city.toLowerCase())) {
    score += 0.3;
  }

  // Straße Match
  if (result.street && original.includes(result.street.toLowerCase())) {
    score += 0.2;
  }

  // Hausnummer Match
  if (result.housenumber && original.includes(result.housenumber.toLowerCase())) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

// ============================================================
// Batch-Validierung (für Cronjob)
// ============================================================

export async function validateUnvalidatedAddresses(supabase: any) {
  // Alle Adressen holen, die noch nicht validiert wurden
  const { data: addresses, error } = await supabase
    .from('partner_addresses')
    .select('id, street, postal_code, city, country')
    .is('geoapify_validation_status', null)
    .limit(50); // Max. 50 pro Durchlauf

  if (error || !addresses?.length) {
    return { validated: 0, errors: 0 };
  }

  let validated = 0;
  let errors = 0;

  for (const address of addresses) {
    const result = await validateAddress(
      address.street,
      address.postal_code,
      address.city,
      address.country || 'DE'
    );

    await storeGeoapifyResult(supabase, address.id, result);

    if (result.status === 'valid') validated++;
    else if (result.status === 'error') errors++;
  }

  return { validated, errors, total: addresses.length };
}
