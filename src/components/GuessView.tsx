import { useEffect, useRef, useState } from "react";
import { COUNTRIES_BY_CODE, flagUrl, type Country, type CountryCode } from "../data/countries";
import { COUNTRY_FACTS, type CountryFacts } from "../data/countryFacts";
import { formatRevealTime } from "../game/reveal";
import { useBlurReveal } from "../game/useBlurReveal";
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

interface GuessViewProps {
  code: CountryCode;
  stage: "guessing" | "correct" | "revealed";
  onGuess: (country: Country) => boolean;
  onSkip?: (() => void) | undefined;
  onGiveUp: () => void;
  onContinue: () => void;
  // Voice play keeps the keyboard down; the answer arrives through the microphone instead.
  voiceActive: boolean;
  // Blur Reveal: the flag starts blurred and sharpens until the player pauses to guess.
  blurReveal: boolean;
}

export function GuessView({
  code,
  stage,
  onGuess,
  onSkip,
  onGiveUp,
  onContinue,
  voiceActive,
  blurReveal,
}: GuessViewProps) {
  const country = COUNTRIES_BY_CODE.get(code);
  const [misses, setMisses] = useState(0);
  const [lastMiss, setLastMiss] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);
  const reveal = useBlurReveal({
    enabled: blurReveal,
    live: stage === "guessing",
    rootRef,
    flagRef,
  });
  // Until the player pauses, there is nothing to type into: the point is to commit early.
  const awaitingPause = blurReveal && !reveal.paused;

  // Focused so a keyboard player can pause with Enter or Space straight away. Voice play has
  // no use for focus, the same as CountryInput.
  const pauseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (awaitingPause && stage === "guessing" && !voiceActive) pauseRef.current?.focus();
  }, [awaitingPause, stage, voiceActive]);

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
    <div className={styles.guess} ref={rootRef}>
      <div className={styles.entrance}>
        {/* Outside the shaker, which remounts on every miss and would drop the blur with it. */}
        <div
          className={
            blurReveal ? (stage === "guessing" ? styles.blurred : styles.unblurred) : undefined
          }
          ref={flagRef}
        >
          <div className={misses > 0 ? styles.shaker : undefined} key={misses}>
            <div
              className={`${styles.flagFrame} ${stage === "correct" ? styles.frameCorrect : ""} ${
                lastMiss === null ? "" : styles.frameMissed
              }`}
            >
              <img className={styles.flag} src={flagUrl(code)} alt="Flag of an unnamed country" />
            </div>
          </div>
        </div>
      </div>

      {blurReveal && stage === "guessing" && (
        <div className={styles.revealTrack} aria-hidden="true">
          <div className={styles.revealFill} />
        </div>
      )}

      <div className={styles.panel} aria-live="polite">
        {stage === "guessing" && awaitingPause && (
          <>
            <p className={styles.prompt}>Pause the moment you know it</p>
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

        {stage === "guessing" && !awaitingPause && (
          <>
            <p className={styles.prompt}>
              {blurReveal ? (
                reveal.finished ? (
                  "Fully revealed. Who flies this flag?"
                ) : (
                  <>
                    Paused at{" "}
                    <span className={styles.seconds}>{formatRevealTime(reveal.elapsedMs)}</span>.
                    Who flies this flag?
                  </>
                )
              ) : (
                "Who flies this flag?"
              )}
            </p>
            <CountryInput onSelect={handleGuess} shakeToken={misses} takeFocus={!voiceActive} />
            {lastMiss !== null && (
              <p className={styles.miss} key={misses}>
                Not {lastMiss}. Try again.
              </p>
            )}
            <div className={styles.actions}>
              {blurReveal && !reveal.finished && (
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
            {blurReveal && (
              <p className={styles.revealTime}>Named at {formatRevealTime(reveal.elapsedMs)}</p>
            )}
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
