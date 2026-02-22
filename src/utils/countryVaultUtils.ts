// Utility functions for country vault operations
import { iso3ToIso2, iso2ToNumeric } from '../countryCodes';

export interface CountryInfo {
  name: string;
  iso2: string;  // ISO 3166-1 alpha-2 code (e.g., "US", "GB")
  iso3?: string; // ISO 3166-1 alpha-3 code (e.g., "USA", "GBR")
  numeric?: number; // ISO 3166-1 numeric code (e.g., 840, 826)
}

/**
 * Extract country information from GeoJSON feature
 */
export function extractCountryInfo(feature: any): CountryInfo | null {
  const name = feature.properties?.name || feature.properties?.NAME;
  if (!name) return null;

  // Try to get ISO2 code from properties
  let iso2 = feature.properties?.ISO2 || feature.properties?.iso_a2;
  
  // If not found, try to convert from ISO3 (feature.id is often ISO3)
  if (!iso2) {
    const iso3Raw = feature.id || feature.properties?.id || feature.properties?.ISO3 || feature.properties?.iso_a3;
    if (iso3Raw) {
      // Ensure iso3 is a string before converting (feature.id might be number or other type)
      const iso3Str = typeof iso3Raw === 'string' ? iso3Raw : String(iso3Raw);
      iso2 = iso3ToIso2(iso3Str);
    }
  }

  // If still no ISO2, try to get from name mapping (fallback)
  if (!iso2) {
    iso2 = getIso2FromName(name);
  }

  if (!iso2) return null;

  const numeric = iso2ToNumeric(iso2);
  const iso3Raw = feature.id || feature.properties?.id || feature.properties?.ISO3 || feature.properties?.iso_a3;
  const iso3 = iso3Raw ? (typeof iso3Raw === 'string' ? iso3Raw : String(iso3Raw)).toUpperCase() : undefined;

  return {
    name: String(name),
    iso2: iso2.toUpperCase(),
    iso3: iso3,
    numeric: numeric || undefined
  };
}

/**
 * Parse GeoJSON and extract all countries with ISO2 codes
 */
export async function parseCountriesFromGeoJSON(geoJsonUrl: string = '/countries.geojson'): Promise<CountryInfo[]> {
  try {
    const response = await fetch(geoJsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
    }

    const geojson = await response.json();
    if (!geojson.features || !Array.isArray(geojson.features)) {
      throw new Error('Invalid GeoJSON format');
    }

    const countries: CountryInfo[] = [];
    const seenIso2 = new Set<string>();

    for (const feature of geojson.features) {
      const countryInfo = extractCountryInfo(feature);
      if (countryInfo && countryInfo.iso2 && !seenIso2.has(countryInfo.iso2)) {
        countries.push(countryInfo);
        seenIso2.add(countryInfo.iso2);
      }
    }

    // Sort by name
    countries.sort((a, b) => a.name.localeCompare(b.name));

    return countries;
  } catch (error) {
    console.error('[parseCountriesFromGeoJSON] Error:', error);
    throw error;
  }
}

/**
 * Fallback: Get ISO2 code from country name (common countries)
 */
function getIso2FromName(name: string): string {
  const nameToIso2: Record<string, string> = {
    'United States': 'US',
    'United States of America': 'US',
    'USA': 'US',
    'United Kingdom': 'GB',
    'Great Britain': 'GB',
    'Canada': 'CA',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'Japan': 'JP',
    'China': 'CN',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Greece': 'GR',
    'Portugal': 'PT',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Poland': 'PL',
    'Czech Republic': 'CZ',
    'Hungary': 'HU',
    'Romania': 'RO',
    'Bulgaria': 'BG',
    'Croatia': 'HR',
    'Slovakia': 'SK',
    'Slovenia': 'SI',
    'Estonia': 'EE',
    'Latvia': 'LV',
    'Lithuania': 'LT',
    'Ireland': 'IE',
    'Iceland': 'IS',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Luxembourg': 'LU',
    'Malta': 'MT',
    'Cyprus': 'CY',
    'Mexico': 'MX',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Peru': 'PE',
    'Venezuela': 'VE',
    'Ecuador': 'EC',
    'Bolivia': 'BO',
    'Paraguay': 'PY',
    'Uruguay': 'UY',
    'India': 'IN',
    'Pakistan': 'PK',
    'Bangladesh': 'BD',
    'Indonesia': 'ID',
    'Philippines': 'PH',
    'Vietnam': 'VN',
    'Thailand': 'TH',
    'Malaysia': 'MY',
    'Singapore': 'SG',
    'South Korea': 'KR',
    'Taiwan': 'TW',
    'Hong Kong': 'HK',
    'New Zealand': 'NZ',
    'South Africa': 'ZA',
    'Egypt': 'EG',
    'Nigeria': 'NG',
    'Kenya': 'KE',
    'Ethiopia': 'ET',
    'Ghana': 'GH',
    'Tanzania': 'TZ',
    'Uganda': 'UG',
    'Morocco': 'MA',
    'Algeria': 'DZ',
    'Tunisia': 'TN',
    'Libya': 'LY',
    'Sudan': 'SD',
    'Angola': 'AO',
    'Mozambique': 'MZ',
    'Zambia': 'ZM',
    'Zimbabwe': 'ZW',
    'Botswana': 'BW',
    'Namibia': 'NA',
    'Madagascar': 'MG',
    'Russia': 'RU',
    'Ukraine': 'UA',
    'Belarus': 'BY',
    'Kazakhstan': 'KZ',
    'Uzbekistan': 'UZ',
    'Turkmenistan': 'TM',
    'Tajikistan': 'TJ',
    'Kyrgyzstan': 'KG',
    'Afghanistan': 'AF',
    'Iran': 'IR',
    'Iraq': 'IQ',
    'Saudi Arabia': 'SA',
    'United Arab Emirates': 'AE',
    'Israel': 'IL',
    'Jordan': 'JO',
    'Lebanon': 'LB',
    'Syria': 'SY',
    'Turkey': 'TR',
    'Georgia': 'GE',
    'Armenia': 'AM',
    'Azerbaijan': 'AZ',
    'Albania': 'AL',
    'Macedonia': 'MK',
    'Serbia': 'RS',
    'Bosnia and Herzegovina': 'BA',
    'Montenegro': 'ME',
    'Kosovo': 'XK',
    'Moldova': 'MD'
  };

  // Try exact match first
  if (nameToIso2[name]) {
    return nameToIso2[name];
  }
  
  // Try case-insensitive match
  const normalizedName = name.trim();
  for (const [key, value] of Object.entries(nameToIso2)) {
    if (key.toLowerCase() === normalizedName.toLowerCase()) {
      return value;
    }
  }
  
  return '';
}

/**
 * Validate ISO2 country code format
 */
export function validateCountryCode(countryCode: string): boolean {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  // Must be exactly 2 uppercase letters
  return /^[A-Z]{2}$/.test(countryCode);
}

/**
 * Get country name from ISO2 code (requires countries list)
 */
export function getCountryNameFromIso2(iso2: string, countries: CountryInfo[]): string | null {
  const country = countries.find(c => c.iso2 === iso2.toUpperCase());
  return country?.name || null;
}
