import { useEffect, useRef, useState } from "react";
import { COUNTRIES_BY_CODE, flagUrl, type Country, type CountryCode } from "../data/countries";
import { CountryInput } from "./CountryInput";
import styles from "./GuessView.module.css";

const SUCCESS_DURATION_MS = 1800;

interface GuessViewProps {
  code: CountryCode;
  stage: "guessing" | "correct" | "revealed";
  onGuess: (country: Country) => boolean;
  onSkip?: (() => void) | undefined;
  onGiveUp: () => void;
  onContinue: () => void;
}

export function GuessView({ code, stage, onGuess, onSkip, onGiveUp, onContinue }: GuessViewProps) {
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
            <CountryInput onSelect={handleGuess} shakeToken={misses} />
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
            <p className={styles.answer}>{country?.name}</p>
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
