import { useCallback, useEffect, useRef, useState } from "react";
import { nextTileAt, REVEAL_DURATION_MS, tileOrder, tilesShown } from "./tileReveal";

interface Options {
  enabled: boolean;
  // Only a flag that is still being guessed keeps uncovering; once it is answered, skipped or
  // given up, the clock stops where it was.
  live: boolean;
}

export interface TileReveal {
  // `order[k]` is the index of the k-th tile to lift. Fixed for the life of the flag.
  order: readonly number[];
  shown: number;
  paused: boolean;
  // Every tile has lifted, so there is nothing left to resume.
  finished: boolean;
  pause: () => void;
  resume: () => void;
}

// Tiles change only a couple of dozen times in thirty seconds, so a timer per tile and plain
// React state are plenty; there is nothing to animate frame by frame.
export function useTileReveal({ enabled, live }: Options): TileReveal {
  const [order] = useState(() => tileOrder());
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const elapsedRef = useRef(0);

  const running = enabled && live && !paused;

  useEffect(() => {
    if (!running) return;
    const startedAt = performance.now() - elapsedRef.current;
    let timer = 0;

    const schedule = () => {
      const now = performance.now() - startedAt;
      const count = tilesShown(now);
      setShown(count);
      const next = nextTileAt(count);
      if (next === null) {
        elapsedRef.current = REVEAL_DURATION_MS;
        setPaused(true);
        return;
      }
      timer = window.setTimeout(schedule, next - now);
    };
    schedule();

    return () => {
      window.clearTimeout(timer);
      elapsedRef.current = Math.min(REVEAL_DURATION_MS, performance.now() - startedAt);
    };
  }, [running]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    if (elapsedRef.current < REVEAL_DURATION_MS) setPaused(false);
  }, []);

  return {
    order,
    shown,
    paused,
    finished: shown >= order.length,
    pause,
    resume,
  };
}
