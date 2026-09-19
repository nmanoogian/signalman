import { COUNTRIES, type Country } from "../data/countries";

function normalize(value: string): string {
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

function rank(entry: IndexedCountry, query: string): number {
  let best = NO_MATCH;
  for (const [termIndex, term] of entry.terms.entries()) {
    // An alias match never outranks a match on the country's own name.
    const penalty = termIndex === 0 ? 0 : 0.5;
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
