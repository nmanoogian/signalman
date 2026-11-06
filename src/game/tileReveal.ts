// Tile Reveal: the flag starts hidden under a grid of tiles, which lift one at a time in a
// random order until the whole flag is showing at REVEAL_DURATION_MS.

export const TILE_COLUMNS = 6;
// Every flag is drawn on a 4:3 canvas, so a 6×4 grid gives square tiles.
export const TILE_ROWS = 4;
export const TILE_COUNT = TILE_COLUMNS * TILE_ROWS;

export const REVEAL_DURATION_MS = 30_000;
const TILE_INTERVAL_MS = REVEAL_DURATION_MS / TILE_COUNT;

// How many tiles have lifted by `elapsedMs`. The first lifts one interval in, rather than at
// once, and the last lifts exactly as the reveal ends.
export function tilesShown(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(TILE_COUNT, Math.floor(elapsedMs / TILE_INTERVAL_MS));
}

// When the next tile lifts, given how many are already showing; null once they all are.
export function nextTileAt(shown: number): number | null {
  if (shown >= TILE_COUNT) return null;
  return (shown + 1) * TILE_INTERVAL_MS;
}

// A random lifting order: `order[k]` is the index of the k-th tile to lift.
export function tileOrder(random: () => number = Math.random): number[] {
  const order = Array.from({ length: TILE_COUNT }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}
