import { useCallback, useEffect, useRef, useState } from "react";
import { COUNTRIES, type CountryCode } from "../data/countries";
import { loadSession, saveSession, type GameProgress, type Session } from "./storage";
import {
  advanceAfterGiveUp,
  clearReps,
  ensureCurrent,
  hasUnintroduced,
  isRoundComplete,
  openRound,
  recordCorrect,
  repsRemaining,
  ROUND_SIZE,
  TOTAL_FLAGS,
  type StudyProgress,
} from "./study";

const ALL_CODES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);
const FRESH_GAME: GameProgress = { remaining: ALL_CODES, gaveUp: [] };

// `seq` counts flag presentations so the guess view remounts for each new prompt, even when
// the same flag comes round again.
export type View =
  | { kind: "carousel" }
  | { kind: "guessing"; code: CountryCode; seq: number }
  | { kind: "correct"; code: CountryCode; seq: number }
  | { kind: "revealed"; code: CountryCode; seq: number }
  | { kind: "roundComplete" }
  | { kind: "studyComplete" };

function startingView(session: Session): View {
  if (session.mode === "game") return { kind: "carousel" };
  const { current } = session.study;
  if (current !== null) return { kind: "guessing", code: current, seq: 0 };
  return hasUnintroduced(session.study) ? { kind: "roundComplete" } : { kind: "studyComplete" };
}

function restore(): Session {
  const saved = loadSession();
  if (saved === null) return { mode: "game", game: FRESH_GAME };
  if (saved.mode === "study") return { mode: "study", study: ensureCurrent(saved.study) };
  return saved;
}

export function useSession() {
  const [session, setSession] = useState<Session>(restore);
  const [view, setView] = useState<View>(() => startingView(session));
  const seqRef = useRef(0);

  const nextSeq = useCallback(() => ++seqRef.current, []);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const study = session.mode === "study" ? session.study : null;
  const game = session.mode === "game" ? session.game : null;

  const setStudy = useCallback((next: StudyProgress) => {
    setSession({ mode: "study", study: next });
  }, []);

  const present = useCallback(
    (code: CountryCode) => {
      setView({ kind: "guessing", code, seq: nextSeq() });
    },
    [nextSeq],
  );

  const submitGuess = useCallback(
    (code: CountryCode) => {
      if (view.kind !== "guessing") return false;

      if (code !== view.code) {
        if (study !== null) setStudy(clearReps(study, view.code));
        return false;
      }

      if (study !== null) setStudy(recordCorrect(study, view.code));
      else if (game !== null) {
        setSession({
          mode: "game",
          game: { ...game, remaining: game.remaining.filter((c) => c !== view.code) },
        });
      }
      setView({ kind: "correct", code: view.code, seq: view.seq });
      return true;
    },
    [game, setStudy, study, view],
  );

  const skip = useCallback(() => {
    setView({ kind: "carousel" });
  }, []);

  const giveUp = useCallback(() => {
    if (view.kind !== "guessing") return;
    const { code } = view;
    if (study !== null) setStudy(advanceAfterGiveUp(study, code));
    else if (game !== null) {
      setSession({
        mode: "game",
        game: {
          remaining: game.remaining.filter((candidate) => candidate !== code),
          gaveUp: [...game.gaveUp, code],
        },
      });
    }
    setView({ kind: "revealed", code, seq: view.seq });
  }, [game, setStudy, study, view]);

  // Leaving the flag the player just finished with: back to the wheel in a game, on to the
  // next flag (or the round boundary) when studying.
  const advance = useCallback(() => {
    if (study === null) {
      setView({ kind: "carousel" });
      return;
    }
    if (isRoundComplete(study)) {
      setView(hasUnintroduced(study) ? { kind: "roundComplete" } : { kind: "studyComplete" });
      return;
    }
    setView(
      study.current === null
        ? { kind: "roundComplete" }
        : { kind: "guessing", code: study.current, seq: nextSeq() },
    );
  }, [nextSeq, study]);

  const startNextRound = useCallback(() => {
    if (study === null) return;
    const opened = openRound(study);
    setStudy(opened);
    setView(
      opened.current === null
        ? { kind: "studyComplete" }
        : { kind: "guessing", code: opened.current, seq: nextSeq() },
    );
  }, [nextSeq, setStudy, study]);

  const newGame = useCallback(() => {
    setSession({ mode: "game", game: FRESH_GAME });
    setView({ kind: "carousel" });
  }, []);

  const newStudySession = useCallback(() => {
    const opened = openRound(null);
    setSession({ mode: "study", study: opened });
    setView(
      opened.current === null
        ? { kind: "studyComplete" }
        : { kind: "guessing", code: opened.current, seq: nextSeq() },
    );
  }, [nextSeq]);

  const gameCorrect = game === null ? 0 : TOTAL_FLAGS - game.remaining.length - game.gaveUp.length;

  return {
    mode: session.mode,
    view,
    total: TOTAL_FLAGS,
    game:
      game === null
        ? null
        : {
            remaining: game.remaining,
            correctCount: gameCorrect,
            gaveUpCount: game.gaveUp.length,
            isCleared: game.remaining.length === 0,
            isUntouched: game.remaining.length === TOTAL_FLAGS,
          },
    study:
      study === null
        ? null
        : {
            round: study.round,
            setSize: study.introduced.length,
            repsRemaining: repsRemaining(study),
            nextRoundAdds: Math.min(ROUND_SIZE, TOTAL_FLAGS - study.introduced.length),
          },
    present,
    submitGuess,
    skip,
    giveUp,
    advance,
    startNextRound,
    newGame,
    newStudySession,
  };
}
