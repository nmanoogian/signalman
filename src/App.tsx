import { useCallback, useState } from "react";
import { Carousel } from "./components/Carousel";
import { Completion } from "./components/Completion";
import { GuessView } from "./components/GuessView";
import styles from "./App.module.css";
import { useGame } from "./game/useGame";

export function App() {
  const game = useGame();
  const [spinning, setSpinning] = useState(false);

  const handleSpinStart = useCallback(() => setSpinning(true), []);

  const handleLand = useCallback(
    (code: string) => {
      setSpinning(false);
      game.present(code);
    },
    [game],
  );

  const { view } = game;
  const started = game.remaining.length < game.total;

  const handleReset = useCallback(() => {
    if (started && !window.confirm("Put all flags back in the pool?")) return;
    game.reset();
  }, [game, started]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Signalman</h1>
        {view.kind === "carousel" && !game.isCleared && (
          <button type="button" className={styles.reset} onClick={handleReset} disabled={spinning}>
            Reset
          </button>
        )}
      </header>

      <main className={styles.main}>
        {view.kind === "carousel" ? (
          game.isCleared ? (
            <Completion total={game.total} onReset={game.reset} />
          ) : (
            <Carousel pool={game.remaining} onSpinStart={handleSpinStart} onLand={handleLand} />
          )
        ) : (
          <GuessView
            code={view.code}
            stage={view.kind}
            onGuess={(country) => game.submitGuess(country.code)}
            onSkip={game.skip}
            onGiveUp={game.giveUp}
            onContinue={game.returnToCarousel}
          />
        )}
      </main>

      <footer className={styles.footer}>
        {view.kind === "carousel" && !game.isCleared && (
          <p className={styles.progress}>
            <b>{game.correctCount}</b> Correct, <b>{game.gaveUpCount}</b> Skipped,{" "}
            <b>{game.remaining.length}</b> Left
          </p>
        )}
      </footer>
    </div>
  );
}
