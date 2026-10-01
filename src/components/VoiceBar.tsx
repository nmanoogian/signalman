import type { View } from "../game/useSession";
import type { VoiceGuessing } from "../game/useVoiceGuessing";
import styles from "./VoiceBar.module.css";

interface VoiceBarProps {
  voice: VoiceGuessing;
  stage: View["kind"];
  canSkip: boolean;
}

function hintFor(stage: View["kind"], canSkip: boolean): string {
  switch (stage) {
    case "carousel":
      return "Say “spin” or “hit me”.";
    case "guessing":
      return canSkip
        ? "Say the country, or “skip” or “give up”."
        : "Say the country, or “give up”.";
    case "revealed":
    case "roundComplete":
      return "Say “next”.";
    case "correct":
    case "studyComplete":
      return "";
  }
}

// Microphone trouble is worth explaining precisely: on iOS the usual cause is not a denied
// prompt but Dictation being switched off system-wide, which no amount of retrying fixes.
function faultFor(voice: VoiceGuessing): string | null {
  if (voice.error === "not-allowed" || voice.error === "service-not-allowed") {
    return "The microphone is blocked. Allow it for this site, and check that Siri & Dictation is on in Settings.";
  }
  if (voice.error === "network") return "Speech recognition needs a network connection.";
  if (voice.error === "audio-capture") return "No microphone was available.";
  return null;
}

export function VoiceBar({ voice, stage, canSkip }: VoiceBarProps) {
  if (!voice.active) return null;

  const fault = faultFor(voice);
  const hint = hintFor(stage, canSkip);
  const { pending } = voice;

  return (
    <div className={styles.bar}>
      <div className={styles.line}>
        <span
          className={`${styles.dot} ${fault === null ? (voice.listening ? styles.live : "") : styles.fault}`}
        />
        {voice.interim === "" ? (
          <p className={styles.hint}>{voice.listening ? hint : "Paused."}</p>
        ) : (
          <p className={styles.heard} aria-live="polite">
            {voice.interim}
          </p>
        )}
      </div>

      {fault !== null && <p className={styles.fence}>{fault}</p>}

      {voice.degraded && fault === null && (
        <p className={styles.fence}>
          This browser kept dropping the microphone, so continuous listening is off. Tap to speak.
        </p>
      )}

      {pending !== null && (
        <div className={styles.prompt}>
          <p className={styles.question}>
            Did you say <span className={styles.name}>{pending.country.name}</span>?
          </p>
          <button type="button" className={styles.yes} onClick={voice.acceptPending}>
            Yes
          </button>
          <button type="button" className={styles.no} onClick={voice.rejectPending}>
            {pending.runnerUp === null ? "No" : `No — ${pending.runnerUp.name}?`}
          </button>
        </div>
      )}
    </div>
  );
}
