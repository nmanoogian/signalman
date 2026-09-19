import { useCallback, useEffect, useState } from "react";
import { COUNTRIES, type CountryCode } from "../data/countries";
import { loadProgress, saveProgress, type Progress } from "./storage";

const ALL_CODES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);
const FRESH: Progress = { remaining: ALL_CODES, gaveUp: [] };

export type View =
  | { kind: "carousel" }
  | { kind: "guessing"; code: CountryCode }
  | { kind: "correct"; code: CountryCode }
  | { kind: "revealed"; code: CountryCode };

export interface Game {
  remaining: readonly CountryCode[];
  total: number;
  correctCount: number;
  gaveUpCount: number;
  view: View;
  isCleared: boolean;
  present: (code: CountryCode) => void;
  submitGuess: (code: CountryCode) => boolean;
  skip: () => void;
  giveUp: () => void;
  returnToCarousel: () => void;
  reset: () => void;
}

export function useGame(): Game {
  const [progress, setProgress] = useState<Progress>(() => loadProgress() ?? FRESH);
  const [view, setView] = useState<View>({ kind: "carousel" });

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const present = useCallback((code: CountryCode) => {
    setView({ kind: "guessing", code });
  }, []);

  const submitGuess = useCallback(
    (code: CountryCode) => {
      if (view.kind !== "guessing") return false;
      if (code !== view.code) return false;
      setProgress((current) => ({
        ...current,
        remaining: current.remaining.filter((candidate) => candidate !== code),
      }));
      setView({ kind: "correct", code: view.code });
      return true;
    },
    [view],
  );

  const skip = useCallback(() => {
    setView({ kind: "carousel" });
  }, []);

  const giveUp = useCallback(() => {
    if (view.kind !== "guessing") return;
    const { code } = view;
    setProgress((current) => ({
      remaining: current.remaining.filter((candidate) => candidate !== code),
      gaveUp: [...current.gaveUp, code],
    }));
    setView({ kind: "revealed", code });
  }, [view]);

  const returnToCarousel = useCallback(() => {
    setView({ kind: "carousel" });
  }, []);

  const reset = useCallback(() => {
    setProgress(FRESH);
    setView({ kind: "carousel" });
  }, []);

  return {
    remaining: progress.remaining,
    total: ALL_CODES.length,
    correctCount: ALL_CODES.length - progress.remaining.length - progress.gaveUp.length,
    gaveUpCount: progress.gaveUp.length,
    view,
    isCleared: progress.remaining.length === 0,
    present,
    submitGuess,
    skip,
    giveUp,
    returnToCarousel,
    reset,
  };
}
