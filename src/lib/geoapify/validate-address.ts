/**
 * PROJ-24: Geoapify Adressvalidierung
 * 
 * Prüft eine Adresse gegen Geoapify API
 * und speichert das Ergebnis in partner_addresses.
 */

interface GeoapifyResult {
  status: 'valid' | 'suggestion' | 'invalid' | 'error';
  confidence: number | null;
  suggestedStreet: string | null;
  suggestedPostalCode: string | null;
  suggestedCity: string | null;
  suggestedCountry: string | null;
  errorMessage?: string;
}

export async function validateAddress(
  street: string | null,
  postalCode: string | null,
  city: string | null,
  country: string | null
): Promise<GeoapifyResult> {
  try {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    
    if (!apiKey) {
      return {
        status: 'error',
        confidence: null,
        suggestedStreet: null,
        suggestedPostalCode: null,
        suggestedCity: null,
        suggestedCountry: null,
        errorMessage: 'GEOAPIFY_API_KEY fehlt',
      };
    }
    
    // Adresse zusammenbauen
    const addressParts = [street, city, country]
      .filter(Boolean)
      .join(', ');
    
    if (!addressParts.trim()) {
      return {
        status: 'invalid',
        confidence: 0,
        suggestedStreet: null,
        suggestedPostalCode: null,
        suggestedCity: null,
        suggestedCountry: null,
      };
    }
    
    // Geoapify API call
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', addressParts);
    url.searchParams.set('limit', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('apiKey', apiKey);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return {
        status: 'error',
        confidence: null,
        suggestedStreet: null,
        suggestedPostalCode: null,
        suggestedCity: null,
        suggestedCountry: null,
        errorMessage: `Geoapify HTTP Error ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return {
        status: 'invalid',
        confidence: 0,
        suggestedStreet: null,
        suggestedPostalCode: null,
        suggestedCity: null,
        suggestedCountry: null,
      };
    }
    
    const result = data.results[0];
    const confidence = result.rank?.confidence || result.rank?.match_type ? 0.8 : null;
    
    // Adresse ist gültig
    if (result.rank?.confidence === 1 || result.rank?.match_type === 'full_match') {
      return {
        status: 'valid',
        confidence: confidence,
        suggestedStreet: result.street ? `${result.street} ${result.housenumber || ''}`.trim() : null,
        suggestedPostalCode: result.postcode || null,
        suggestedCity: result.city || result.county || null,
        suggestedCountry: result.country || null,
      };
    }
    
    // Vorschlag verfügbar
    return {
      status: 'suggestion',
      confidence: confidence,
      suggestedStreet: result.street ? `${result.street} ${result.housenumber || ''}`.trim() : null,
      suggestedPostalCode: result.postcode || null,
      suggestedCity: result.city || result.county || null,
      suggestedCountry: result.country || null,
    };
    
  } catch (error: any) {
    return {
      status: 'error',
      confidence: null,
      suggestedStreet: null,
      suggestedPostalCode: null,
      suggestedCity: null,
      suggestedCountry: null,
      errorMessage: error.message || 'Unbekannter Fehler',
    };
  }
}

/**
 * Speichert das Geoapify-Ergebnis in partner_addresses
 */
export async function saveValidationResult(
  supabase: any,
  addressId: string,
  result: GeoapifyResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('partner_addresses')
      .update({
        geoapify_status: result.status,
        geoapify_confidence: result.confidence,
        geoapify_suggested_street: result.suggestedStreet,
        geoapify_suggested_postal_code: result.suggestedPostalCode,
        geoapify_suggested_city: result.suggestedCity,
        geoapify_suggested_country: result.suggestedCountry,
        geoapify_validated_at: new Date().toISOString(),
      })
      .eq('id', addressId);
    
    if (error) {
      console.error('❌ Geoapify-Update fehlgeschlagen:', error);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ Geoapify-Update Exception:', error.message);
    return false;
  }
}
