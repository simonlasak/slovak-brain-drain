import type { Locale } from '../lib/locale';

/**
 * Display names for every destination code that appears in
 * section3_diaspora.parquet.
 *
 * GENERATED, do not hand-edit: run
 *   .venv/bin/python -m pipeline.transform.diaspora_names
 * to regenerate from the boundaries file plus the parquet's distinct codes.
 *
 * Keys follow whatever code system the parquet uses for destination_iso3. Malta and
 * Liechtenstein are carried explicitly because they have diaspora data but no
 * polygon in the 110m boundaries, so no feature supplies their name.
 *
 * Slovak exonyms are pending the single Slovak authoring pass; until then the
 * English names render for both locales.
 */
export const COUNTRY_NAMES: Record<string, string> = {
  'AUS': 'Australia',
  'AUT': 'Austria',
  'BEL': 'Belgium',
  'BGR': 'Bulgaria',
  'BIH': 'Bosnia and Herzegovina',
  'BLR': 'Belarus',
  'BOL': 'Bolivia',
  'BRA': 'Brazil',
  'CAN': 'Canada',
  'CHE': 'Switzerland',
  'CHL': 'Chile',
  'CRI': 'Costa Rica',
  'CYP': 'Cyprus',
  'CZE': 'Czechia',
  'DEU': 'Germany',
  'DNK': 'Denmark',
  'ECU': 'Ecuador',
  'EGY': 'Egypt',
  'ESP': 'Spain',
  'EST': 'Estonia',
  'FIN': 'Finland',
  'FRA': 'France',
  'GBR': 'United Kingdom',
  'GRC': 'Greece',
  'HRV': 'Croatia',
  'HUN': 'Hungary',
  'IRL': 'Ireland',
  'ISL': 'Iceland',
  'ISR': 'Israel',
  'ITA': 'Italy',
  'JOR': 'Jordan',
  'JPN': 'Japan',
  'KOR': 'South Korea',
  'LIE': 'Liechtenstein',
  'LTU': 'Lithuania',
  'LUX': 'Luxembourg',
  'LVA': 'Latvia',
  'MEX': 'Mexico',
  'MKD': 'North Macedonia',
  'MLT': 'Malta',
  'MNE': 'Montenegro',
  'MNG': 'Mongolia',
  'NLD': 'Netherlands',
  'NOR': 'Norway',
  'NZL': 'New Zealand',
  'PAN': 'Panama',
  'POL': 'Poland',
  'PRT': 'Portugal',
  'ROU': 'Romania',
  'RUS': 'Russia',
  'SRB': 'Serbia',
  'SVN': 'Slovenia',
  'SWE': 'Sweden',
  'TUR': 'Turkey',
  'USA': 'United States',
  'VEN': 'Venezuela',
  'ZAF': 'South Africa',
};

export function countryName(code: string, _locale: Locale = 'en'): string {
  return COUNTRY_NAMES[code] || code;
}
