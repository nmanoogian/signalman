import { COUNTRIES_BY_CODE, type CountryCode } from "../data/countries";

const STORAGE_KEY = "signalman:progress:v1";

export interface Progress {
  remaining: readonly CountryCode[];
  gaveUp: readonly CountryCode[];
}

function knownCodes(value: unknown): CountryCode[] {
  if (!Array.isArray(value)) return [];
  const codes = value.filter(
    (code): code is CountryCode => typeof code === "string" && COUNTRIES_BY_CODE.has(code),
  );
  return [...new Set(codes)];
}

export function loadProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { remaining, gaveUp } = parsed as Record<string, unknown>;
    const retired = new Set(knownCodes(gaveUp));
    return {
      remaining: knownCodes(remaining).filter((code) => !retired.has(code)),
      gaveUp: [...retired],
    };
  } catch {
    return null;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable or full; the game stays playable, just not resumable.
  }
}
