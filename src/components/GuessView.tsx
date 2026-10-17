import { useEffect, useRef, useState } from "react";
import { COUNTRIES_BY_CODE, flagUrl, type Country, type CountryCode } from "../data/countries";
import { COUNTRY_FACTS, type CountryFacts } from "../data/countryFacts";
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
}

export function GuessView({
  code,
  stage,
  onGuess,
  onSkip,
  onGiveUp,
  onContinue,
  voiceActive,
}: GuessViewProps) {
  const country = COUNTRIES_BY_CODE.get(code);
  const [misses, setMisses] = useState(0);
  const [lastMiss, setLastMiss] = useState<string | null>(null);

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
            }`}
          >
            <img className={styles.flag} src={flagUrl(code)} alt="Flag of an unnamed country" />
          </div>
        </div>
      </div>

      <div className={styles.panel} aria-live="polite">
        {stage === "guessing" && (
          <>
            <p className={styles.prompt}>Which country flies this flag?</p>
            <CountryInput onSelect={handleGuess} shakeToken={misses} takeFocus={!voiceActive} />
            {lastMiss !== null && (
              <p className={styles.miss} key={misses}>
                Not {lastMiss}. Try again.
              </p>
            )}
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

        {stage === "correct" && (
          <>
            <p className={styles.verdictCorrect}>Correct</p>
            <p className={styles.answer}>
              {country?.name} <span className={styles.answerCode}>{code.toUpperCase()}</span>
            </p>
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
