import { COUNTRIES_BY_CODE, type CountryCode } from "../data/countries";

const STORAGE_KEY = "signalman:pool:v1";

export function loadPool(): CountryCode[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const known = parsed.filter(
      (code): code is CountryCode => typeof code === "string" && COUNTRIES_BY_CODE.has(code),
    );
    return [...new Set(known)];
  } catch {
    return null;
  }
}

export function savePool(codes: readonly CountryCode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // Storage can be unavailable or full; the game stays playable, just not resumable.
  }
}
