import { COUNTRIES_BY_CODE, type CountryCode } from "../data/countries";
import type { StudyProgress } from "./study";

const STORAGE_KEY = "signalman:session:v1";

export interface GameProgress {
  remaining: readonly CountryCode[];
  gaveUp: readonly CountryCode[];
}

export type Session =
  | { mode: "game"; game: GameProgress }
  | { mode: "study"; study: StudyProgress };

function knownCodes(value: unknown): CountryCode[] {
  if (!Array.isArray(value)) return [];
  const codes = value.filter(
    (code): code is CountryCode => typeof code === "string" && COUNTRIES_BY_CODE.has(code),
  );
  return [...new Set(codes)];
}

function readGame(value: unknown): GameProgress | null {
  if (typeof value !== "object" || value === null) return null;
  const { remaining, gaveUp } = value as Record<string, unknown>;
  const retired = new Set(knownCodes(gaveUp));
  return {
    remaining: knownCodes(remaining).filter((code) => !retired.has(code)),
    gaveUp: [...retired],
  };
}

function readStudy(value: unknown): StudyProgress | null {
  if (typeof value !== "object" || value === null) return null;
  const { round, introduced, newest, reps, current } = value as Record<string, unknown>;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1) return null;

  const seen = knownCodes(introduced);
  if (seen.length === 0) return null;
  const inRound = new Set(seen);

  const banked: Record<CountryCode, number> = {};
  if (typeof reps === "object" && reps !== null) {
    for (const [code, count] of Object.entries(reps)) {
      if (inRound.has(code) && typeof count === "number" && Number.isInteger(count) && count >= 0) {
        banked[code] = count;
      }
    }
  }

  return {
    round,
    introduced: seen,
    newest: knownCodes(newest).filter((code) => inRound.has(code)),
    reps: banked,
    current: typeof current === "string" && inRound.has(current) ? current : null,
  };
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { mode, game, study } = parsed as Record<string, unknown>;

    if (mode === "study") {
      const restored = readStudy(study);
      return restored === null ? null : { mode: "study", study: restored };
    }
    const restored = readGame(game);
    return restored === null ? null : { mode: "game", game: restored };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable or full; play continues, it just will not resume.
  }
}
