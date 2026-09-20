import { COUNTRIES, type CountryCode } from "../data/countries";
import { shuffle } from "./shuffle";

export const ROUND_SIZE = 5;
const NEW_FLAG_REPS = 3;
const REVIEW_FLAG_REPS = 1;

const ALL_CODES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);

export interface StudyProgress {
  round: number;
  introduced: readonly CountryCode[];
  newest: readonly CountryCode[];
  reps: Readonly<Record<CountryCode, number>>;
  current: CountryCode | null;
}

export function requiredReps(study: StudyProgress, code: CountryCode): number {
  return study.newest.includes(code) ? NEW_FLAG_REPS : REVIEW_FLAG_REPS;
}

function owed(study: StudyProgress, code: CountryCode): number {
  return Math.max(0, requiredReps(study, code) - (study.reps[code] ?? 0));
}

export function repsRemaining(study: StudyProgress): number {
  return study.introduced.reduce((total, code) => total + owed(study, code), 0);
}

export function isRoundComplete(study: StudyProgress): boolean {
  return repsRemaining(study) === 0;
}

export function hasUnintroduced(study: StudyProgress): boolean {
  return study.introduced.length < ALL_CODES.length;
}

// Picks from whatever still owes reps, avoiding an immediate repeat unless nothing else is due.
function pickNext(study: StudyProgress, justAnswered: CountryCode | null): CountryCode | null {
  const due = study.introduced.filter((code) => owed(study, code) > 0);
  if (due.length === 0) return null;
  const fresh = due.filter((code) => code !== justAnswered);
  const candidates = fresh.length > 0 ? fresh : due;
  return shuffle(candidates)[0] ?? null;
}

export function openRound(previous: StudyProgress | null): StudyProgress {
  const introduced = previous?.introduced ?? [];
  const seen = new Set(introduced);
  const added = shuffle(ALL_CODES.filter((code) => !seen.has(code))).slice(0, ROUND_SIZE);
  const opened: StudyProgress = {
    round: (previous?.round ?? 0) + 1,
    introduced: [...introduced, ...added],
    newest: added,
    reps: {},
    current: null,
  };
  return { ...opened, current: pickNext(opened, null) };
}

export function recordCorrect(study: StudyProgress, code: CountryCode): StudyProgress {
  const scored: StudyProgress = {
    ...study,
    reps: { ...study.reps, [code]: (study.reps[code] ?? 0) + 1 },
  };
  return { ...scored, current: pickNext(scored, code) };
}

// A miss or a give-up wipes the reps banked on that flag.
export function clearReps(study: StudyProgress, code: CountryCode): StudyProgress {
  return { ...study, reps: { ...study.reps, [code]: 0 } };
}

export function advanceAfterGiveUp(study: StudyProgress, code: CountryCode): StudyProgress {
  const cleared = clearReps(study, code);
  return { ...cleared, current: pickNext(cleared, code) };
}

// Restores a pointer to the next flag, for sessions restored from storage whose current
// flag was dropped from the country list.
export function ensureCurrent(study: StudyProgress): StudyProgress {
  if (study.current !== null && study.introduced.includes(study.current)) return study;
  return { ...study, current: pickNext(study, null) };
}

export const TOTAL_FLAGS = ALL_CODES.length;
