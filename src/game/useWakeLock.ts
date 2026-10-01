import { useEffect } from "react";

// Holds the screen awake while hands-free play is running: otherwise the phone sleeps mid
// session and takes the recognizer with it. Browsers without the API simply do nothing.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (released) {
          await next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Refused, or the page was hidden at the moment of asking. The visibility listener
        // below gets another chance.
      }
    };

    // The lock is dropped whenever the tab goes away, so it has to be retaken on return.
    const reacquire = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", reacquire);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", reacquire);
      void sentinel?.release();
    };
  }, [active]);
}
