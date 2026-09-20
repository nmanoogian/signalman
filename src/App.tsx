import { useCallback, useState } from "react";
import { Carousel } from "./components/Carousel";
import { Completion } from "./components/Completion";
import { GuessView } from "./components/GuessView";
import { Menu } from "./components/Menu";
import { RoundComplete } from "./components/RoundComplete";
import styles from "./App.module.css";
import { useSession } from "./game/useSession";

export function App() {
  const session = useSession();
  const [spinning, setSpinning] = useState(false);

  const handleSpinStart = useCallback(() => setSpinning(true), []);

  const handleLand = useCallback(
    (code: string) => {
      setSpinning(false);
      session.present(code);
    },
    [session],
  );

  const { view, game, study } = session;
  const inProgress = study !== null || game === null || !game.isUntouched;

  const confirmSwitch = useCallback(
    (message: string, action: () => void) => {
      if (inProgress && !window.confirm(message)) return;
      action();
    },
    [inProgress],
  );

  const handleNewGame = useCallback(() => {
    confirmSwitch("Start a new game? Your current progress will be cleared.", session.newGame);
  }, [confirmSwitch, session.newGame]);

  const handleNewStudySession = useCallback(() => {
    confirmSwitch(
      "Start a new study session? Your current progress will be cleared.",
      session.newStudySession,
    );
  }, [confirmSwitch, session.newStudySession]);

  const renderMain = () => {
    switch (view.kind) {
      case "carousel":
        return game !== null && game.isCleared ? (
          <Completion
            eyebrow="Board cleared"
            heading={`All ${session.total} flags down`}
            body="Nothing left on the wheel. Start a new game to put every flag back in the pool."
            actionLabel="Play again"
            onAction={session.newGame}
          />
        ) : (
          <Carousel
            pool={game?.remaining ?? []}
            onSpinStart={handleSpinStart}
            onLand={handleLand}
          />
        );
      case "guessing":
      case "correct":
      case "revealed":
        return (
          <GuessView
            code={view.code}
            stage={view.kind}
            onGuess={(country) => session.submitGuess(country.code)}
            onSkip={study === null ? session.skip : undefined}
            onGiveUp={session.giveUp}
            onContinue={session.advance}
          />
        );
      case "roundComplete":
        return (
          <RoundComplete
            round={study?.round ?? 1}
            adding={study?.nextRoundAdds ?? 0}
            setSize={study?.setSize ?? 0}
            onContinue={session.startNextRound}
          />
        );
      case "studyComplete":
        return (
          <Completion
            eyebrow="Study complete"
            heading={`All ${session.total} flags learned`}
            body="Every flag has been through the rotation. Start a new session to run them again."
            actionLabel="New study session"
            onAction={session.newStudySession}
          />
        );
    }
  };

  const renderProgress = () => {
    if (study !== null) {
      if (view.kind === "studyComplete" || view.kind === "roundComplete") return null;
      return (
        <p className={styles.progress}>
          Round <b>{study.round}</b> · <b>{study.setSize}</b> flags · <b>{study.repsRemaining}</b>{" "}
          {study.repsRemaining === 1 ? "rep" : "reps"} to go
        </p>
      );
    }
    if (game === null || game.isCleared || view.kind !== "carousel") return null;
    return (
      <p className={styles.progress}>
        <b>{game.correctCount}</b> Correct, <b>{game.gaveUpCount}</b> Skipped,{" "}
        <b>{game.remaining.length}</b> Left
      </p>
    );
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Signalman</h1>
        <Menu
          onNewGame={handleNewGame}
          onNewStudySession={handleNewStudySession}
          disabled={spinning}
        />
      </header>

      <main className={styles.main}>{renderMain()}</main>

      <footer className={styles.footer}>{renderProgress()}</footer>
    </div>
  );
}
