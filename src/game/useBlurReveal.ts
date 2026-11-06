import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { blurRadius, REVEAL_DURATION_MS, revealProgress } from "./reveal";

interface Options {
  enabled: boolean;
  // Only a flag that is still being guessed keeps sharpening; once it is answered, skipped or
  // given up, the clock stops where it was.
  live: boolean;
  // Receives the `--reveal-blur` and `--reveal-progress` custom properties.
  rootRef: RefObject<HTMLElement | null>;
  // Whose width the blur radius is scaled to.
  flagRef: RefObject<HTMLElement | null>;
}

export interface BlurReveal {
  paused: boolean;
  // The reveal ran its full course, so there is nothing left to resume.
  finished: boolean;
  // Time on the clock as of the last pause or stop. Not updated while the reveal runs.
  elapsedMs: number;
  pause: () => void;
  resume: () => void;
}

// Drives the blur from requestAnimationFrame by writing custom properties straight onto the
// DOM, so thirty seconds of sharpening costs no React renders at all.
export function useBlurReveal({ enabled, live, rootRef, flagRef }: Options): BlurReveal {
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);

  const apply = useCallback(
    (elapsed: number) => {
      const root = rootRef.current;
      if (root === null) return;
      const progress = revealProgress(elapsed);
      const width = flagRef.current?.clientWidth ?? 0;
      root.style.setProperty("--reveal-blur", `${blurRadius(progress, width)}px`);
      root.style.setProperty("--reveal-progress", String(progress));
    },
    [flagRef, rootRef],
  );

  // Before the first paint, so the flag never flashes sharp on arrival.
  useLayoutEffect(() => {
    if (enabled) apply(elapsedRef.current);
  }, [apply, enabled]);

  const running = enabled && live && !paused;

  useEffect(() => {
    if (!running) return;
    const startedAt = performance.now() - elapsedRef.current;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(REVEAL_DURATION_MS, now - startedAt);
      elapsedRef.current = elapsed;
      apply(elapsed);
      if (elapsed >= REVEAL_DURATION_MS) {
        setElapsedMs(elapsed);
        setPaused(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      setElapsedMs(elapsedRef.current);
    };
  }, [apply, running]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    if (elapsedRef.current < REVEAL_DURATION_MS) setPaused(false);
  }, []);

  return {
    paused,
    finished: elapsedMs >= REVEAL_DURATION_MS,
    elapsedMs,
    pause,
    resume,
  };
}
