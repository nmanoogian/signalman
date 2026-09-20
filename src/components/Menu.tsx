import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Menu.module.css";

interface MenuProps {
  onNewGame: () => void;
  onNewStudySession: () => void;
  disabled: boolean;
}

export function Menu({ onNewGame, onNewStudySession, disabled }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((showing) => !showing)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Menu
      </button>
      {open && (
        <div className={styles.items} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => choose(onNewGame)}
          >
            New Game
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => choose(onNewStudySession)}
          >
            New Study Session
          </button>
        </div>
      )}
    </div>
  );
}
