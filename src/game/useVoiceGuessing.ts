import { useCallback, useState } from "react";
import type { Country } from "../data/countries";
import { useSpeechRecognition, type SpeechHeard } from "./useSpeechRecognition";
import type { View } from "./useSession";
import { useWakeLock } from "./useWakeLock";
import { matchCommand, type VoiceCommand } from "./voiceCommand";
import { matchSpeech } from "./voiceMatch";

// What the player may say in each stage. Anything outside the list for the current stage is
// not a command at all, which is what stops "spin" from eating "Spain" while a flag is up.
const STAGE_COMMANDS: Record<View["kind"], readonly VoiceCommand[]> = {
  carousel: ["spin", "next"],
  guessing: ["skip", "giveUp"],
  correct: [],
  revealed: ["next"],
  roundComplete: ["next"],
  studyComplete: [],
};

// What "next" means depends on where the player is standing. Pulled out as a plain function
// because routing it to `advance` everywhere is how the round boundary quietly stopped working:
// `advance` treats a finished round as somewhere to arrive at, not somewhere to leave.
export type NextIntent = "spin" | "nextRound" | "advance";

export function nextIntentFor(stage: View["kind"]): NextIntent {
  if (stage === "carousel") return "spin";
  if (stage === "roundComplete") return "nextRound";
  return "advance";
}

// While a "did you say…" prompt is open, answering it takes priority. "Repeat" is the way to
// wave the prompt away and just say the country again.
const PROMPT_COMMANDS: readonly VoiceCommand[] = ["yes", "no", "repeat", "skip", "giveUp"];

export interface VoicePending {
  country: Country;
  runnerUp: Country | null;
  heard: string;
}

export interface VoiceActions {
  spin: () => void;
  nextRound: () => void;
  guess: (country: Country) => void;
  skip: (() => void) | undefined;
  giveUp: () => void;
  advance: () => void;
}

export interface VoiceGuessing {
  // Whether the player has switched voice play on. Deliberately not persisted: the browser
  // wants a gesture before it will open the microphone, so every reload starts over.
  active: boolean;
  supported: boolean;
  listening: boolean;
  degraded: boolean;
  error: SpeechRecognitionErrorCode | null;
  interim: string;
  pending: VoicePending | null;
  start: () => void;
  stop: () => void;
  // Tap equivalents of saying "yes" and "no" to a prompt, so it is never a dead end.
  acceptPending: () => void;
  rejectPending: () => void;
}

interface Options {
  view: View;
  actions: VoiceActions;
}

export function useVoiceGuessing({ view, actions }: Options): VoiceGuessing {
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState<VoicePending | null>(null);

  const stage = view.kind;
  // Each presentation carries its own number, so the same flag coming round again still counts
  // as a new moment. Reset during render, the way CountryInput handles its shake token, rather
  // than through an effect that would land a render late.
  const moment = `${view.kind}:${"seq" in view ? view.seq : -1}`;
  const [settledMoment, setSettledMoment] = useState(moment);
  if (settledMoment !== moment) {
    setSettledMoment(moment);
    setPending(null);
  }

  // Submitting from inside a state updater would be a side effect in a function React is
  // free to run twice, so the open prompt is read from this render instead.
  const acceptPending = useCallback(() => {
    if (pending === null) return;
    setPending(null);
    actions.guess(pending.country);
  }, [actions, pending]);

  // Turning down the first guess promotes the runner-up rather than throwing the whole
  // utterance away, which is what makes the Angola/Anguilla pairs answerable at all.
  const rejectPending = useCallback(() => {
    if (pending === null) return;
    setPending(
      pending.runnerUp === null
        ? null
        : { country: pending.runnerUp, runnerUp: null, heard: pending.heard },
    );
  }, [pending]);

  const runCommand = (command: VoiceCommand) => {
    switch (command) {
      case "spin":
        actions.spin();
        break;
      case "next":
        switch (nextIntentFor(stage)) {
          case "spin":
            actions.spin();
            break;
          case "nextRound":
            actions.nextRound();
            break;
          case "advance":
            actions.advance();
            break;
        }
        break;
      case "skip":
        setPending(null);
        actions.skip?.();
        break;
      case "giveUp":
        setPending(null);
        actions.giveUp();
        break;
      case "repeat":
        setPending(null);
        break;
      case "yes":
        acceptPending();
        break;
      case "no":
        rejectPending();
        break;
    }
  };

  // Rebuilt every render and stored in a ref by the speech hook, so reading current state
  // here never costs a restarted session.
  const handleHeard = ({ transcript, isFinal }: SpeechHeard) => {
    if (!isFinal) return;

    const allowed = pending === null ? STAGE_COMMANDS[stage] : PROMPT_COMMANDS;
    const command = matchCommand(transcript, allowed);
    if (command !== null) {
      runCommand(command);
      return;
    }
    if (stage !== "guessing") return;

    const match = matchSpeech(transcript);
    if (match.kind === "accept") {
      setPending(null);
      actions.guess(match.country);
      return;
    }
    if (match.kind === "confirm") {
      setPending({ country: match.country, runnerUp: match.runnerUp, heard: match.heard });
    }
    // A "none" is almost always a half-heard phrase; staying quiet beats guessing.
  };

  // Always asked for continuously; the speech hook stops restarting on its own once a
  // platform shows it cannot hold a session open, and reports that through `degraded`.
  const speech = useSpeechRecognition({ mode: "continuous", lang: "en-US", onHeard: handleHeard });

  useWakeLock(active);

  const start = useCallback(() => {
    setActive(true);
    speech.start();
  }, [speech]);

  const stop = useCallback(() => {
    setActive(false);
    setPending(null);
    speech.stop();
  }, [speech]);

  return {
    active,
    supported: speech.supported,
    listening: speech.status === "listening",
    degraded: speech.degraded,
    error: speech.error,
    interim: speech.interim,
    pending,
    start,
    stop,
    acceptPending,
    rejectPending,
  };
}
