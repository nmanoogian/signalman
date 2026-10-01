import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechStatus = "unsupported" | "idle" | "listening" | "denied" | "error";

// Push-to-talk is the fallback for platforms that will not hold a session open. Both run
// through the same code path, so switching is one flag rather than a second implementation.
export type SpeechMode = "continuous" | "pushToTalk";

export interface SpeechHeard {
  transcript: string;
  isFinal: boolean;
}

// One recognizer session, start to finish. Restarts are invisible from the outside, so this is
// the only way to see a platform cutting sessions short.
export interface SpeechSession {
  startedAt: number;
  durationMs: number;
  heardAnything: boolean;
}

// A session that ends this quickly without hearing anything never really started. iOS Safari
// is reported to degrade this way after a number of restarts, and the only cure is to stop
// restarting and let the player drive with push-to-talk.
const MIN_SESSION_MS = 500;
const MAX_EMPTY_RESTARTS = 4;
// Restarting inside `onend` itself is rejected on some builds; a tick of daylight avoids it.
const RESTART_DELAY_MS = 150;

interface SpeechOptions {
  mode: SpeechMode;
  lang: string;
  onHeard: (heard: SpeechHeard) => void;
  onSessionEnd?: ((session: SpeechSession) => void) | undefined;
}

export interface SpeechControls {
  status: SpeechStatus;
  supported: boolean;
  // Set once the platform has shown it cannot hold a session open. The caller should drop back
  // to push-to-talk rather than keep asking for always-on listening.
  degraded: boolean;
  // The partial transcript, for showing the player what is being heard as they speak.
  interim: string;
  error: SpeechRecognitionErrorCode | null;
  // Both target browsers refuse to start outside a user gesture, so this must be called from
  // an event handler, not an effect.
  start: () => void;
  stop: () => void;
}

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition({
  mode,
  lang,
  onHeard,
  onSessionEnd,
}: SpeechOptions): SpeechControls {
  const [supported] = useState(() => recognitionConstructor() !== null);
  const [status, setStatus] = useState<SpeechStatus>(supported ? "idle" : "unsupported");
  const [degraded, setDegraded] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechRecognitionErrorCode | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantsRef = useRef(false);
  const emptyRestartsRef = useRef(0);
  const degradedRef = useRef(false);
  // The mode the live session was built with, so a re-render cannot restart it for nothing.
  const activeModeRef = useRef(mode);
  const timerRef = useRef(0);
  const heardRef = useRef(onHeard);
  const sessionEndRef = useRef(onSessionEnd);
  const launchRef = useRef<() => void>(() => {});

  // Kept in refs so a re-render never tears down a live session.
  useEffect(() => {
    heardRef.current = onHeard;
    sessionEndRef.current = onSessionEnd;
  });

  const launch = () => {
    const Recognition = recognitionConstructor();
    if (Recognition === null) return;

    const recognition = new Recognition();
    activeModeRef.current = mode;
    recognition.continuous = mode === "continuous";
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    const startedAt = Date.now();
    let heardAnything = false;

    recognition.addEventListener("start", () => {
      setStatus("listening");
    });

    recognition.addEventListener("result", (event) => {
      let partial = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const best = result?.[0];
        if (result === undefined || best === undefined) continue;
        heardAnything = true;
        if (result.isFinal) {
          heardRef.current({ transcript: best.transcript, isFinal: true });
        } else {
          partial += best.transcript;
        }
      }
      setInterim(partial);
      if (partial !== "") heardRef.current({ transcript: partial, isFinal: false });
    });

    recognition.addEventListener("error", (event) => {
      // Silence and our own `abort()` are ordinary; `onend` decides what happens next.
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantsRef.current = false;
        setStatus("denied");
      } else {
        setStatus("error");
      }
    });

    recognition.addEventListener("end", () => {
      recognitionRef.current = null;
      setInterim("");
      sessionEndRef.current?.({
        startedAt,
        durationMs: Date.now() - startedAt,
        heardAnything,
      });
      if (!wantsRef.current || mode !== "continuous" || degradedRef.current) {
        wantsRef.current = false;
        setStatus((current) => (current === "denied" || current === "error" ? current : "idle"));
        return;
      }

      if (!heardAnything && Date.now() - startedAt < MIN_SESSION_MS) {
        emptyRestartsRef.current += 1;
      } else {
        emptyRestartsRef.current = 0;
      }
      if (emptyRestartsRef.current >= MAX_EMPTY_RESTARTS) {
        wantsRef.current = false;
        degradedRef.current = true;
        setDegraded(true);
        setStatus("idle");
        return;
      }
      timerRef.current = window.setTimeout(() => launchRef.current(), RESTART_DELAY_MS);
    });

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // start() throws when a previous session is still winding down; onend will retry.
    }
  };

  useEffect(() => {
    launchRef.current = launch;
  });

  const start = useCallback(() => {
    if (!supported || wantsRef.current) return;
    setError(null);
    emptyRestartsRef.current = 0;
    wantsRef.current = true;
    launchRef.current();
  }, [supported]);

  const stop = useCallback(() => {
    wantsRef.current = false;
    window.clearTimeout(timerRef.current);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setInterim("");
    if (supported) setStatus("idle");
  }, [supported]);

  // A mode change mid-session needs a fresh recognizer, since `continuous` is read at start.
  useEffect(() => {
    if (!wantsRef.current || activeModeRef.current === mode) return;
    window.clearTimeout(timerRef.current);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    launchRef.current();
  }, [mode]);

  useEffect(
    () => () => {
      wantsRef.current = false;
      window.clearTimeout(timerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return { status, supported, degraded, interim, error, start, stop };
}
