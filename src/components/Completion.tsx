import styles from "./Completion.module.css";

interface CompletionProps {
  total: number;
  onReset: () => void;
}

export function Completion({ total, onReset }: CompletionProps) {
  return (
    <div className={styles.completion}>
      <p className={styles.eyebrow}>Board cleared</p>
      <h2 className={styles.heading}>All {total} flags down</h2>
      <p className={styles.body}>
        Nothing left on the wheel. Reset to put every flag back in the pool and run it again.
      </p>
      <button type="button" className={styles.reset} onClick={onReset}>
        Play again
      </button>
    </div>
  );
}
