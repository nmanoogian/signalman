import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flagUrl, type CountryCode } from "../data/countries";
import styles from "./Carousel.module.css";

const RING_SIZE = 18;
const STEP_DEGREES = 360 / RING_SIZE;
const IDLE_DEGREES_PER_SECOND = 7;
const SPIN_DURATION_MS = 3400;
const MIN_SPIN_TURNS = 5;
const LANDING_PAUSE_MS = 650;
const REDUCED_SPIN_DURATION_MS = 700;
const REDUCED_SPIN_TURNS = 1;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const FRONT_CLASS = styles.front ?? "";

interface Spin {
  startedAt: number;
  duration: number;
  from: number;
  to: number;
  slot: number;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

// Fills every ring slot from a shuffled sample of the pool, repeating entries once the
// pool has shrunk below the ring size so the wheel never looks half empty.
function buildRing(pool: readonly CountryCode[]): CountryCode[] {
  if (pool.length === 0) return [];
  const ring: CountryCode[] = [];
  while (ring.length < RING_SIZE) ring.push(...shuffle(pool));
  return ring.slice(0, RING_SIZE);
}

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

function frontSlot(rotationDegrees: number): number {
  const raw = Math.round(-rotationDegrees / STEP_DEGREES) % RING_SIZE;
  return (raw + RING_SIZE) % RING_SIZE;
}

interface CarouselProps {
  pool: readonly CountryCode[];
  onSpinStart: () => void;
  onLand: (code: CountryCode) => void;
}

export function Carousel({ pool, onSpinStart, onLand }: CarouselProps) {
  const ring = useMemo(() => buildRing(pool), [pool]);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rotationRef = useRef(0);
  const spinRef = useRef<Spin | null>(null);
  const frozenRef = useRef(false);
  const frontRef = useRef(-1);
  const onLandRef = useRef(onLand);

  useEffect(() => {
    onLandRef.current = onLand;
  });

  useEffect(() => {
    let frame = 0;
    let handoff = 0;
    let previous = performance.now();

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const elapsed = Math.min(now - previous, 100);
      previous = now;

      const spin = spinRef.current;
      if (spin) {
        const progress = Math.min((now - spin.startedAt) / spin.duration, 1);
        rotationRef.current = spin.from + (spin.to - spin.from) * easeOutQuint(progress);
        if (progress === 1) {
          spinRef.current = null;
          frozenRef.current = true;
          const code = ring[spin.slot] as CountryCode;
          setSpinning(false);
          setLanded(true);
          handoff = window.setTimeout(() => onLandRef.current(code), LANDING_PAUSE_MS);
        }
      } else if (!frozenRef.current && !prefersReducedMotion()) {
        rotationRef.current -= (IDLE_DEGREES_PER_SECOND * elapsed) / 1000;
      }

      stageRef.current?.style.setProperty("--rotation", `${rotationRef.current}deg`);

      const front = frontSlot(rotationRef.current);
      if (front !== frontRef.current) {
        itemRefs.current[frontRef.current]?.classList.remove(FRONT_CLASS);
        itemRefs.current[front]?.classList.add(FRONT_CLASS);
        frontRef.current = front;
      }
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(handoff);
    };
  }, [ring]);

  const spin = useCallback(() => {
    if (spinRef.current || frozenRef.current || ring.length === 0) return;
    const reduced = prefersReducedMotion();
    const slot = Math.floor(Math.random() * ring.length);
    const from = rotationRef.current;
    const turns = reduced ? REDUCED_SPIN_TURNS : MIN_SPIN_TURNS;
    let to = -slot * STEP_DEGREES;
    while (to > from - turns * 360) to -= 360;
    const duration = reduced ? REDUCED_SPIN_DURATION_MS : SPIN_DURATION_MS;
    spinRef.current = { startedAt: performance.now(), duration, from, to, slot };
    setSpinning(true);
    onSpinStart();
  }, [onSpinStart, ring.length]);

  return (
    <div className={styles.carousel}>
      <div className={`${styles.viewport} ${landed ? styles.viewportLanded : ""}`}>
        <div className={styles.stage} ref={stageRef}>
          {ring.map((code, slot) => (
            <div
              // A slot's identity is its position on the ring; a small pool repeats codes.
              // oxlint-disable-next-line react/no-array-index-key
              key={`${slot}-${code}`}
              className={styles.item}
              ref={(element) => {
                itemRefs.current[slot] = element;
              }}
              style={{ "--slot": slot } as CSSProperties}
            >
              <img className={styles.flag} src={flagUrl(code)} alt="" draggable={false} />
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.spinButton}
        onClick={spin}
        disabled={spinning || landed}
      >
        {spinning ? "Spinning…" : "Spin"}
      </button>
    </div>
  );
}
