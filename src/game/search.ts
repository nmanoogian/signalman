import { COUNTRIES, type Country } from "../data/countries";

// Shared with voice matching so typed and spoken guesses fold the same way.
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

interface IndexedCountry {
  country: Country;
  terms: string[];
}

const INDEX: readonly IndexedCountry[] = COUNTRIES.map((country) => ({
  country,
  terms: [country.name, ...(country.aliases ?? [])].map(normalize),
}));

const EXACT_CODE = -1;
const PREFIX = 0;
const WORD_START = 1;
const SUBSTRING = 2;
const NO_MATCH = 3;

function rankTerm(term: string, query: string): number {
  if (term.startsWith(query)) return PREFIX;
  const at = term.indexOf(query);
  if (at < 0) return NO_MATCH;
  return term[at - 1] === " " ? WORD_START : SUBSTRING;
}

// An alias match never outranks a match on the country's own name.
const ALIAS_PENALTY = 0.5;

function rank(entry: IndexedCountry, query: string): number {
  // Codes match only in full, so a single letter doesn't pull in every code that starts with it.
  if (query === entry.country.code) return EXACT_CODE;
  let best = NO_MATCH;
  for (const [termIndex, term] of entry.terms.entries()) {
    const penalty = termIndex === 0 ? 0 : ALIAS_PENALTY;
    best = Math.min(best, rankTerm(term, query) + penalty);
  }
  return best;
}

export function searchCountries(query: string, limit: number): Country[] {
  const normalized = normalize(query);
  if (normalized === "") return [];
  return INDEX.map((entry) => ({ entry, score: rank(entry, normalized) }))
    .filter(({ score }) => score < NO_MATCH)
    .toSorted(
      (a, b) => a.score - b.score || a.entry.country.name.localeCompare(b.entry.country.name, "en"),
    )
    .slice(0, limit)
    .map(({ entry }) => entry.country);
}
