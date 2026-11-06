// Blur Reveal: the flag starts as a smear of colour and sharpens over REVEAL_DURATION_MS.

export const REVEAL_DURATION_MS = 30_000;

// As a fraction of the flag's rendered width, so a phone and a desktop start equally lost.
// At 560px wide this is an 84px blur — most flags open as a single blended colour.
export const MAX_BLUR_FRACTION = 0.15;

// How far through the reveal `elapsedMs` is, from 0 to 1.
export function revealProgress(elapsedMs: number, durationMs = REVEAL_DURATION_MS): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

// Blur radius for a point in the reveal. A linear fall would leave the flag unreadable until
// the last few seconds, because detail returns roughly with the inverse of the radius; the
// cubic front-loads the drop so new detail keeps arriving across the whole thirty seconds.
export function blurRadius(progress: number, flagWidth: number): number {
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  return MAX_BLUR_FRACTION * flagWidth * remaining ** 3;
}

export function formatRevealTime(elapsedMs: number): string {
  return `${(Math.max(0, elapsedMs) / 1000).toFixed(1)}s`;
}
