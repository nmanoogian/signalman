import styles from "./Completion.module.css";

interface CompletionProps {
  eyebrow: string;
  heading: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

export function Completion({ eyebrow, heading, body, actionLabel, onAction }: CompletionProps) {
  return (
    <div className={styles.completion}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.body}>{body}</p>
      <button type="button" className={styles.reset} onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
