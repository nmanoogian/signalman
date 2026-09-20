import styles from "./RoundComplete.module.css";

interface RoundCompleteProps {
  round: number;
  adding: number;
  setSize: number;
  onContinue: () => void;
}

export function RoundComplete({ round, adding, setSize, onContinue }: RoundCompleteProps) {
  return (
    <div className={styles.round}>
      <p className={styles.eyebrow}>Round {round} complete</p>
      <h2 className={styles.heading}>
        {adding} more {adding === 1 ? "flag" : "flags"}
      </h2>
      <p className={styles.body}>
        {setSize + adding} flags in the set. The new ones need three correct guesses each, the rest
        need one.
      </p>
      <button type="button" className={styles.continue} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
