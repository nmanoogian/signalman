import { useEffect, useRef } from "react";
import styles from "./Credits.module.css";

interface CreditsProps {
  onClose: () => void;
}

export function Credits({ onClose }: CreditsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  // Shown as an overlay rather than in place of the main view, so whatever game is underneath
  // keeps its state while the credits are up.
  return (
    <div className={styles.backdrop}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
      >
        <h2 id="credits-title" className={styles.heading}>
          Credits
        </h2>
        <dl className={styles.list}>
          <div className={styles.entry}>
            <dt className={styles.name}>Erin</dt>
            <dd className={styles.role}>Inventor of tile mode</dd>
          </div>
        </dl>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
