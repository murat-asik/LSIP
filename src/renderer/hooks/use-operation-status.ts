import { useEffect, useRef, useState } from 'react';

/** A synchronous guard also blocks repeated Enter presses before React renders. */
export function useOperationStatus() {
  const locked = useRef(false);
  const startedAt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  return {
    busy, seconds,
    start() {
      if (locked.current) return false;
      locked.current = true;
      startedAt.current = Date.now();
      setSeconds(0);
      setBusy(true);
      return true;
    },
    finish() { locked.current = false; setBusy(false); },
  };
}
