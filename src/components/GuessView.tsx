import { useEffect, useRef, useState } from "react";
import { COUNTRIES_BY_CODE, flagUrl, type Country, type CountryCode } from "../data/countries";
import { COUNTRY_FACTS, type CountryFacts } from "../data/countryFacts";
import { TILE_COUNT } from "../game/tileReveal";
import { useTileReveal, type TileReveal } from "../game/useTileReveal";
import { CountryInput } from "./CountryInput";
import styles from "./GuessView.module.css";

const SUCCESS_DURATION_MS = 1800;

const exactPopulation = new Intl.NumberFormat("en");
const largePopulation = new Intl.NumberFormat("en", {
  notation: "compact",
  compactDisplay: "long",
  maximumSignificantDigits: 3,
});

function formatPopulation(population: number): string {
  if (population === 0) return "None permanent";
  return (population < 1_000_000 ? exactPopulation : largePopulation).format(population);
}

function Facts({ facts }: { facts: CountryFacts | undefined }) {
  if (facts?.callingCode === undefined && facts?.population === undefined) return null;
  return (
    <dl className={styles.facts}>
      {facts.callingCode !== undefined && (
        <div className={styles.fact}>
          <dt>Calling code</dt>
          <dd>+{facts.callingCode}</dd>
        </div>
      )}
      {facts.population !== undefined && (
        <div className={styles.fact}>
          <dt>Population</dt>
          <dd>{formatPopulation(facts.population)}</dd>
        </div>
      )}
    </dl>
  );
}

// Lifted tiles are tracked by rank — the step at which each one lifts — so the grid can be
// drawn in reading order while lifting in a shuffled one.
function Tiles({ reveal, live }: { reveal: TileReveal; live: boolean }) {
  const rank: number[] = [];
  reveal.order.forEach((tile, step) => {
    rank[tile] = step;
  });
  return (
    <div className={styles.tiles} aria-hidden="true">
      {rank.map((step, tile) => {
        const lifted = !live || step < reveal.shown;
        return (
          <div
            // A tile's identity is its grid position.
            // oxlint-disable-next-line react/no-array-index-key
            key={tile}
            className={`${styles.tile} ${lifted ? styles.tileLifted : ""}`}
            // Once the flag is answered, the tiles still down sweep away in their own order.
            style={live ? undefined : { transitionDelay: `${(step - reveal.shown) * 22}ms` }}
          />
        );
      })}
    </div>
  );
}

function tileCount(shown: number): string {
  return `${shown} of ${TILE_COUNT} ${TILE_COUNT === 1 ? "tile" : "tiles"}`;
}

interface GuessViewProps {
  code: CountryCode;
  stage: "guessing" | "correct" | "revealed";
  onGuess: (country: Country) => boolean;
  onSkip?: (() => void) | undefined;
  onGiveUp: () => void;
  onContinue: () => void;
  // Voice play keeps the keyboard down; the answer arrives through the microphone instead.
  voiceActive: boolean;
  // Tile Reveal: the flag starts covered and uncovers tile by tile until the player pauses.
  tileReveal: boolean;
}

export function GuessView({
  code,
  stage,
  onGuess,
  onSkip,
  onGiveUp,
  onContinue,
  voiceActive,
  tileReveal,
}: GuessViewProps) {
  const country = COUNTRIES_BY_CODE.get(code);
  const [misses, setMisses] = useState(0);
  const [lastMiss, setLastMiss] = useState<string | null>(null);

  const live = stage === "guessing";
  const reveal = useTileReveal({ enabled: tileReveal, live });
  // Until the player pauses, there is nothing to type into: the point is to commit early.
  const awaitingPause = tileReveal && !reveal.paused;

  // Focused so a keyboard player can pause with Enter or Space straight away. Voice play has
  // no use for focus, the same as CountryInput.
  const pauseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (awaitingPause && live && !voiceActive) pauseRef.current?.focus();
  }, [awaitingPause, live, voiceActive]);

  const onContinueRef = useRef(onContinue);

  useEffect(() => {
    onContinueRef.current = onContinue;
  });

  useEffect(() => {
    if (stage !== "correct") return;
    const timer = window.setTimeout(() => onContinueRef.current(), SUCCESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const handleGuess = (guess: Country) => {
    if (onGuess(guess)) return;
    setMisses((count) => count + 1);
    setLastMiss(guess.name);
  };

  return (
    <div className={styles.guess}>
      <div className={styles.entrance}>
        <div className={misses > 0 ? styles.shaker : undefined} key={misses}>
          <div
            className={`${styles.flagFrame} ${stage === "correct" ? styles.frameCorrect : ""} ${
              lastMiss === null ? "" : styles.frameMissed
            } ${tileReveal && live ? styles.frameCovered : ""}`}
          >
            <img className={styles.flag} src={flagUrl(code)} alt="Flag of an unnamed country" />
            {tileReveal && <Tiles reveal={reveal} live={live} />}
          </div>
        </div>
      </div>

      <div className={styles.panel} aria-live="polite">
        {live && awaitingPause && (
          <>
            <p className={styles.prompt}>Pause to guess</p>
            <button type="button" className={styles.primary} onClick={reveal.pause} ref={pauseRef}>
              Pause &amp; Guess
            </button>
            <div className={styles.actions}>
              {onSkip && (
                <button type="button" className={styles.secondary} onClick={onSkip}>
                  Skip
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={onGiveUp}>
                Give Up
              </button>
            </div>
          </>
        )}

        {live && !awaitingPause && (
          <>
            <p className={styles.prompt}>
              {tileReveal
                ? reveal.finished
                  ? "Fully uncovered. Who flies this flag?"
                  : `Paused at ${tileCount(reveal.shown)}. Who flies this flag?`
                : "Who flies this flag?"}
            </p>
            <CountryInput onSelect={handleGuess} shakeToken={misses} takeFocus={!voiceActive} />
            {lastMiss !== null && (
              <p className={styles.miss} key={misses}>
                Not {lastMiss}. Try again.
              </p>
            )}
            <div className={styles.actions}>
              {tileReveal && !reveal.finished && (
                <button type="button" className={styles.secondary} onClick={reveal.resume}>
                  Resume
                </button>
              )}
              {onSkip && (
                <button type="button" className={styles.secondary} onClick={onSkip}>
                  Skip
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={onGiveUp}>
                Give Up
              </button>
            </div>
          </>
        )}

        {stage === "correct" && (
          <>
            <p className={styles.verdictCorrect}>Correct</p>
            <p className={styles.answer}>
              {country?.name} <span className={styles.answerCode}>{code.toUpperCase()}</span>
            </p>
            {tileReveal && <p className={styles.revealStat}>Named at {tileCount(reveal.shown)}</p>}
            <Facts facts={COUNTRY_FACTS.get(code)} />
          </>
        )}

        {stage === "revealed" && (
          <>
            <p className={styles.verdictRevealed}>The answer was</p>
            <p className={styles.answer}>{country?.name}</p>
            <button type="button" className={styles.primary} onClick={onContinue}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
