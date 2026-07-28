import type { Locale } from '../lib/locale';

/**
 * Display names for every destination code that appears in
 * section3_diaspora.parquet.
 *
 * GENERATED, do not hand-edit: run
 *   .venv/bin/python -m pipeline.transform.diaspora_names
 * to regenerate from the boundaries file plus the parquet's distinct codes.
 *
 * The data mixes two code systems: UN M49 numeric (UN DESA rows) and ISO3 alpha
 * (OECD rows), so both appear as keys here. Malta and Liechtenstein are carried
 * explicitly because they have diaspora data but no polygon in the 110m
 * boundaries.
 *
 * Slovak exonyms are pending the single Slovak authoring pass; until then the
 * English names render for both locales.
 */
export const COUNTRY_NAMES: Record<string, string> = {
  '036': 'Australia',
  '040': 'Austria',
  '056': 'Belgium',
  '068': 'Bolivia',
  '070': 'Bosnia and Herzegovina',
  '076': 'Brazil',
  '100': 'Bulgaria',
  '112': 'Belarus',
  '124': 'Canada',
  '188': 'Costa Rica',
  '191': 'Croatia',
  '196': 'Cyprus',
  '203': 'Czechia',
  '208': 'Denmark',
  '218': 'Ecuador',
  '233': 'Estonia',
  '246': 'Finland',
  '250': 'France',
  '276': 'Germany',
  '300': 'Greece',
  '348': 'Hungary',
  '352': 'Iceland',
  '372': 'Ireland',
  '380': 'Italy',
  '400': 'Jordan',
  '428': 'Latvia',
  '438': 'Liechtenstein',
  '440': 'Lithuania',
  '442': 'Luxembourg',
  '470': 'Malta',
  '484': 'Mexico',
  '496': 'Mongolia',
  '499': 'Montenegro',
  '528': 'Netherlands',
  '578': 'Norway',
  '591': 'Panama',
  '616': 'Poland',
  '620': 'Portugal',
  '642': 'Romania',
  '643': 'Russia',
  '688': 'Serbia',
  '705': 'Slovenia',
  '710': 'South Africa',
  '724': 'Spain',
  '752': 'Sweden',
  '756': 'Switzerland',
  '792': 'Turkey',
  '807': 'North Macedonia',
  '818': 'Egypt',
  '826': 'United Kingdom',
  '862': 'Venezuela',
  'AUS': 'Australia',
  'AUT': 'Austria',
  'BEL': 'Belgium',
  'CAN': 'Canada',
  'CHE': 'Switzerland',
  'CHL': 'Chile',
  'CRI': 'Costa Rica',
  'CZE': 'Czechia',
  'DEU': 'Germany',
  'DNK': 'Denmark',
  'ESP': 'Spain',
  'EST': 'Estonia',
  'FIN': 'Finland',
  'FRA': 'France',
  'GBR': 'United Kingdom',
  'GRC': 'Greece',
  'HUN': 'Hungary',
  'IRL': 'Ireland',
  'ISL': 'Iceland',
  'ISR': 'Israel',
  'ITA': 'Italy',
  'JPN': 'Japan',
  'KOR': 'South Korea',
  'LTU': 'Lithuania',
  'LUX': 'Luxembourg',
  'LVA': 'Latvia',
  'MEX': 'Mexico',
  'NLD': 'Netherlands',
  'NOR': 'Norway',
  'NZL': 'New Zealand',
  'POL': 'Poland',
  'PRT': 'Portugal',
  'SVN': 'Slovenia',
  'SWE': 'Sweden',
  'TUR': 'Turkey',
  'USA': 'United States',
};

export function countryName(code: string, _locale: Locale = 'en'): string {
  return COUNTRY_NAMES[code] || code;
}
