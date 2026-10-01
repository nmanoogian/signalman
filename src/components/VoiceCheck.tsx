import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  useSpeechRecognition,
  type SpeechHeard,
  type SpeechMode,
  type SpeechSession,
} from "../game/useSpeechRecognition";
import { matchCommand } from "../game/voiceCommand";
import { matchSpeech } from "../game/voiceMatch";
import styles from "./VoiceCheck.module.css";

const MAX_LOG = 40;
const MAX_SESSIONS = 300;
// Matches the hook's own definition of a session that never really started.
const SHORT_SESSION_MS = 500;

type Tone = "accept" | "confirm" | "none" | "command";

interface Entry {
  id: number;
  transcript: string;
  typed: boolean;
  verdict: string;
  tone: Tone;
}

// Commands are read first, exactly as the game will read them.
function describe(transcript: string): { verdict: string; tone: Tone } {
  const command = matchCommand(transcript);
  if (command !== null) return { verdict: `command · ${command}`, tone: "command" };

  const match = matchSpeech(transcript);
  if (match.kind === "none") return { verdict: `no match · heard "${match.heard}"`, tone: "none" };
  const score = match.score.toFixed(3);
  if (match.kind === "accept") {
    return { verdict: `accept · ${match.country.name} · ${score}`, tone: "accept" };
  }
  const alternative = match.runnerUp === null ? "" : ` · or ${match.runnerUp.name}?`;
  return { verdict: `confirm · ${match.country.name} · ${score}${alternative}`, tone: "confirm" };
}

function apiFlavour(): string {
  if (typeof window === "undefined") return "none";
  if (window.SpeechRecognition) return "standard";
  if (window.webkitSpeechRecognition) return "webkit-prefixed";
  return "none";
}

export function VoiceCheck() {
  const [mode, setMode] = useState<SpeechMode>("continuous");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessions, setSessions] = useState<SpeechSession[]>([]);
  const [typed, setTyped] = useState("");
  const nextId = useRef(0);

  const record = useCallback((transcript: string, fromKeyboard: boolean) => {
    const trimmed = transcript.trim();
    if (trimmed === "") return;
    const { verdict, tone } = describe(trimmed);
    // Minted outside the updater: React may run an updater twice, and it should stay pure.
    const entry: Entry = {
      id: nextId.current++,
      transcript: trimmed,
      typed: fromKeyboard,
      verdict,
      tone,
    };
    setEntries((prior) => [entry, ...prior].slice(0, MAX_LOG));
  }, []);

  const handleHeard = useCallback(
    ({ transcript, isFinal }: SpeechHeard) => {
      if (isFinal) record(transcript, false);
    },
    [record],
  );

  const handleSessionEnd = useCallback((session: SpeechSession) => {
    setSessions((prior) => [...prior, session].slice(-MAX_SESSIONS));
  }, []);

  const speech = useSpeechRecognition({
    mode,
    lang: "en-US",
    onHeard: handleHeard,
    onSessionEnd: handleSessionEnd,
  });

  const stillborn = sessions.filter(
    (session) => !session.heardAnything && session.durationMs < SHORT_SESSION_MS,
  ).length;
  const lastSession = sessions.at(-1);

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    record(typed, true);
    setTyped("");
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Voice check</h1>
      <p className={styles.lede}>
        Drives the same recognizer and matcher the game will use. Start listening, say twenty or so
        country names, and watch the session counters: restarts climbing while <em>cut short</em>{" "}
        climbs with them is the platform refusing to hold a session open.
      </p>

      <div className={styles.card}>
        <dl className={styles.facts}>
          <dt>API</dt>
          <dd className={speech.supported ? styles.good : styles.bad}>{apiFlavour()}</dd>
          <dt>Secure context</dt>
          <dd className={window.isSecureContext ? styles.good : styles.bad}>
            {window.isSecureContext ? "yes" : "no — the mic will be refused"}
          </dd>
          <dt>Status</dt>
          <dd>{speech.status}</dd>
          <dt>Degraded</dt>
          <dd className={speech.degraded ? styles.bad : undefined}>
            {speech.degraded ? "yes — fell back to push-to-talk" : "no"}
          </dd>
          <dt>Last error</dt>
          <dd className={speech.error === null ? undefined : styles.bad}>
            {speech.error ?? "none"}
          </dd>
          <dt>Sessions</dt>
          <dd>{sessions.length}</dd>
          <dt>Cut short</dt>
          <dd className={stillborn > 0 ? styles.bad : undefined}>{stillborn}</dd>
          <dt>Last session</dt>
          <dd>{lastSession === undefined ? "—" : `${lastSession.durationMs} ms`}</dd>
          <dt>Browser</dt>
          <dd>{navigator.userAgent}</dd>
        </dl>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.primary}
          onClick={speech.status === "listening" ? speech.stop : speech.start}
          disabled={!speech.supported}
        >
          {speech.status === "listening" ? "Stop" : "Start listening"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() =>
            setMode((current) => (current === "continuous" ? "pushToTalk" : "continuous"))
          }
        >
          Mode: {mode === "continuous" ? "continuous" : "push-to-talk"}
        </button>
      </div>

      <div className={styles.card}>
        <p className={styles.listening} aria-live="polite">
          {speech.interim === "" ? (
            <span className={styles.hint}>
              {speech.status === "listening" ? "Listening…" : "Not listening."}
            </span>
          ) : (
            speech.interim
          )}
        </p>
      </div>

      <form className={styles.tryRow} onSubmit={submitTyped}>
        <input
          className={styles.input}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Or type a transcript to test the matcher"
          aria-label="Transcript to test"
        />
        <button type="submit" className={styles.secondary}>
          Test
        </button>
      </form>

      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing heard yet.</p>
      ) : (
        <ul className={styles.log}>
          {entries.map((entry) => (
            <li key={entry.id} className={`${styles.entry} ${styles[entry.tone]}`}>
              <p className={styles.said}>
                {entry.transcript}
                {entry.typed ? " (typed)" : ""}
              </p>
              <p className={styles.verdict}>{entry.verdict}</p>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <button type="button" className={styles.secondary} onClick={() => setEntries([])}>
          Clear log
        </button>
      )}
    </main>
  );
}
