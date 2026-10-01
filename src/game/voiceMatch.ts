import { COUNTRIES, type Country } from "../data/countries";
import { metaphone, similarity } from "./phonetics";
import { normalize } from "./search";

// Words a speaker wraps around the answer. Trimmed from both ends so "um, I think it's Germany"
// scores like "Germany". Only the ends are touched, which leaves "Isle of Man" intact.
const FILLER = new Set([
  "a",
  "ah",
  "and",
  "answer",
  "er",
  "erm",
  "flag",
  "guess",
  "hmm",
  "i",
  "is",
  "it",
  "its",
  "like",
  "maybe",
  "my",
  "of",
  "ok",
  "okay",
  "please",
  "probably",
  "right",
  "s",
  "say",
  "so",
  "that",
  "thats",
  "the",
  "then",
  "think",
  "this",
  "uh",
  "um",
  "well",
]);

// A phonetic hit is strong evidence but not proof, so it sits just under the accept line's
// reach for a one-letter spelling slip.
const PHONETIC_SCORE = 0.9;
// A phonetic hit only counts when the spelling is already in the neighbourhood. Without this
// "Kenia" lands on Ghana, which shares Kenya's metaphone key.
const PHONETIC_FLOOR = 0.35;
// Aliases this short are typed abbreviations ("UK", "ROK"); sounding them out is pure noise,
// so they match only when the transcript spells them exactly.
const SHORT_ALIAS = 3;
// Breaks ties towards a country's own name when an alias scores the same.
const ALIAS_PENALTY = 0.01;
// Two candidates this close are not worth guessing between.
const RUNNER_UP_MARGIN = 0.05;

export const ACCEPT_SCORE = 0.84;
export const CONFIRM_SCORE = 0.6;

export type VoiceMatch =
  | { kind: "accept"; country: Country; score: number; heard: string }
  | { kind: "confirm"; country: Country; score: number; heard: string; runnerUp: Country | null }
  | { kind: "none"; heard: string };

interface VoiceTerm {
  country: Country;
  spaced: string;
  // Spaces dropped, so a transcript that split or joined words still lines up: "to go" / "Togo".
  tight: string;
  key: string;
  isAlias: boolean;
}

const TERMS: readonly VoiceTerm[] = COUNTRIES.flatMap((country) =>
  [country.name, ...(country.aliases ?? [])].map((term, index) => {
    const spaced = normalize(term);
    const tight = spaced.replaceAll(" ", "");
    return { country, spaced, tight, key: metaphone(tight), isAlias: index > 0 };
  }),
);

function trimFiller(words: readonly string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && FILLER.has(words[start] ?? "")) start++;
  while (end > start && FILLER.has(words[end - 1] ?? "")) end--;
  const trimmed = words.slice(start, end);
  // An all-filler utterance keeps its words rather than collapsing to nothing.
  return trimmed.length > 0 ? trimmed : [...words];
}

// Both the trimmed and untrimmed readings are scored: trimming rescues "it's Germany", and
// keeping the original rescues "I rock", where the filler word is really part of "Iraq".
export function speechVariants(transcript: string): string[] {
  const words = normalize(transcript)
    .split(" ")
    .filter((word) => word !== "")
    // Speech engines write the abbreviation; the country list spells it out.
    .map((word) => (word === "st" ? "saint" : word));
  if (words.length === 0) return [];
  const variants = [trimFiller(words).join(" "), words.join(" ")];
  return [...new Set(variants)];
}

function scoreTerm(term: VoiceTerm, spaced: string, tight: string, key: string): number {
  if (term.spaced === spaced || term.tight === tight) return 1;

  if (term.isAlias && term.tight.length <= SHORT_ALIAS) return 0;

  let score = similarity(term.tight, tight);
  if (key !== "" && term.key === key && score >= PHONETIC_FLOOR) {
    score = Math.max(score, PHONETIC_SCORE);
  }
  return term.isAlias && score > 0 ? score - ALIAS_PENALTY : score;
}

interface Variant {
  spaced: string;
  tight: string;
}

function isExact(country: Country, variants: readonly Variant[]): boolean {
  return variants.some(({ spaced, tight }) =>
    TERMS.some(
      (term) => term.country === country && (term.spaced === spaced || term.tight === tight),
    ),
  );
}

// The country, if any, whose name merely *extends* what was heard — "Dominican" against
// "Dominican Republic". Naming it makes the follow-up question worth asking.
function extendedBy(country: Country, variants: readonly Variant[]): Country | null {
  for (const { tight } of variants) {
    const longer = TERMS.find(
      (term) =>
        term.country !== country &&
        term.tight.length > tight.length &&
        term.tight.startsWith(tight),
    );
    if (longer !== undefined) return longer.country;
  }
  return null;
}

export function matchSpeech(transcript: string): VoiceMatch {
  const variants: Variant[] = speechVariants(transcript)
    .map((spaced) => ({ spaced, tight: spaced.replaceAll(" ", "") }))
    .filter(({ tight }) => tight !== "");
  const heard = variants[0]?.spaced ?? normalize(transcript);
  if (variants.length === 0) return { kind: "none", heard };

  const scores = new Map<Country, number>();
  for (const { spaced, tight } of variants) {
    const key = metaphone(tight);
    for (const term of TERMS) {
      const score = scoreTerm(term, spaced, tight, key);
      if (score > (scores.get(term.country) ?? 0)) scores.set(term.country, score);
    }
  }

  const ranked = [...scores].toSorted(
    ([aCountry, aScore], [bCountry, bScore]) =>
      bScore - aScore || aCountry.name.localeCompare(bCountry.name, "en"),
  );
  const top = ranked[0];
  if (top === undefined || top[1] < CONFIRM_SCORE) return { kind: "none", heard };

  const [country, score] = top;
  const second = ranked[1] ?? null;

  // An exact hit is never second-guessed, so saying "Niger" is taken at its word even though
  // "Nigeria" exists.
  if (isExact(country, variants)) return { kind: "accept", country, score, heard };

  const extension = extendedBy(country, variants);
  const tooClose = second !== null && score - second[1] < RUNNER_UP_MARGIN;
  const runnerUp = extension ?? (second === null ? null : second[0]);

  if (score >= ACCEPT_SCORE && extension === null && !tooClose) {
    return { kind: "accept", country, score, heard };
  }
  return { kind: "confirm", country, score, heard, runnerUp };
}
