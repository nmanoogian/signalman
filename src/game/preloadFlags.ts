import { useEffect } from "react";
import { COUNTRIES, flagUrl, type CountryCode } from "../data/countries";

// Six at a time warms the set quickly without crowding out whatever is on screen. The median
// flag is under a kilobyte; only a handful carry a detailed coat of arms.
const CONCURRENCY = 6;

const ALL_CODES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);

const warmed = new Set<CountryCode>();
const queue: CountryCode[] = [];
let inFlight = 0;

function fetchFlag(code: CountryCode, urgent: boolean): Promise<void> {
  const image = new Image();
  image.decoding = "async";
  // The bulk warm yields to anything the page actually needs; a flag about to appear does not.
  image.fetchPriority = urgent ? "auto" : "low";
  image.src = flagUrl(code);
  // Decoding as well as fetching leaves the first paint of the flag with nothing left to do.
  // A failure is swallowed on purpose: one bad file must not stall the queue behind it.
  return image.decode().catch(() => undefined);
}

function pump(): void {
  while (inFlight < CONCURRENCY) {
    const code = queue.shift();
    if (code === undefined) return;
    if (warmed.has(code)) continue;
    warmed.add(code);
    inFlight++;
    void fetchFlag(code, false).finally(() => {
      inFlight--;
      pump();
    });
  }
}

// Queues flags to warm the browser cache. Codes already warm or already queued cost nothing,
// so callers can be liberal about what they ask for.
export function preloadFlags(codes: readonly CountryCode[]): void {
  for (const code of codes) {
    if (warmed.has(code) || queue.includes(code)) continue;
    queue.push(code);
  }
  pump();
}

// Fetches one flag ahead of the queue entirely, for a flag that is about to be on screen.
export function preloadNow(code: CountryCode): void {
  if (warmed.has(code)) return;
  warmed.add(code);
  const queued = queue.indexOf(code);
  if (queued >= 0) queue.splice(queued, 1);
  void fetchFlag(code, true);
}

// Data Saver is a clear request not to pull half a megabyte of flags the player may never see.
// The game still works: anything not warmed simply loads when it is needed.
function savingData(): boolean {
  return navigator.connection?.saveData === true;
}

// Warms the flag on screen, the one queued up behind it, and then — traffic permitting — the
// rest of the set, so later flags appear without a fetch.
export function useFlagPreload(current: CountryCode | null, upcoming: CountryCode | null): void {
  useEffect(() => {
    if (current !== null) preloadNow(current);
    if (upcoming !== null) preloadNow(upcoming);
    if (!savingData()) preloadFlags(ALL_CODES);
  }, [current, upcoming]);
}
