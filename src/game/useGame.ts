import { useCallback, useEffect, useState } from "react";
import { COUNTRIES, type CountryCode } from "../data/countries";
import { loadPool, savePool } from "./storage";

const ALL_CODES: readonly CountryCode[] = COUNTRIES.map((country) => country.code);

export type View =
  | { kind: "carousel" }
  | { kind: "guessing"; code: CountryCode }
  | { kind: "correct"; code: CountryCode }
  | { kind: "revealed"; code: CountryCode };

export interface Game {
  remaining: readonly CountryCode[];
  total: number;
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
  const [remaining, setRemaining] = useState<readonly CountryCode[]>(() => loadPool() ?? ALL_CODES);
  const [view, setView] = useState<View>({ kind: "carousel" });

  useEffect(() => {
    savePool(remaining);
  }, [remaining]);

  const retire = useCallback((code: CountryCode) => {
    setRemaining((pool) => pool.filter((candidate) => candidate !== code));
  }, []);

  const present = useCallback((code: CountryCode) => {
    setView({ kind: "guessing", code });
  }, []);

  const submitGuess = useCallback(
    (code: CountryCode) => {
      if (view.kind !== "guessing") return false;
      if (code !== view.code) return false;
      retire(view.code);
      setView({ kind: "correct", code: view.code });
      return true;
    },
    [retire, view],
  );

  const skip = useCallback(() => {
    setView({ kind: "carousel" });
  }, []);

  const giveUp = useCallback(() => {
    if (view.kind !== "guessing") return;
    retire(view.code);
    setView({ kind: "revealed", code: view.code });
  }, [retire, view]);

  const returnToCarousel = useCallback(() => {
    setView({ kind: "carousel" });
  }, []);

  const reset = useCallback(() => {
    setRemaining(ALL_CODES);
    setView({ kind: "carousel" });
  }, []);

  return {
    remaining,
    total: ALL_CODES.length,
    view,
    isCleared: remaining.length === 0,
    present,
    submitGuess,
    skip,
    giveUp,
    returnToCarousel,
    reset,
  };
}
