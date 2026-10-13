import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSessionTimeoutOptions {
  enabled: boolean;
  timeoutMinutes?: number; // Inactivity timeout in minutes (default: 15)
  warningSeconds?: number; // How many seconds before timeout to show warning (default: 120)
  onTimeout: () => void;
  onActivity?: () => void;
}

export function useSessionTimeout({
  enabled,
  timeoutMinutes = 15,
  warningSeconds = 120,
  onTimeout,
  onActivity,
}: UseSessionTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(warningSeconds);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = (timeoutMinutes * 60 - warningSeconds) * 1000;

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingSeconds(warningSeconds);
    if (onActivity) {
      onActivity();
    }
  }, [warningSeconds, onActivity]);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    lastActivityRef.current = Date.now();

    const checkInactivity = () => {
      const idleTime = Date.now() - lastActivityRef.current;

      if (idleTime >= timeoutMs) {
        // Timed out
        setShowWarning(false);
        onTimeout();
      } else if (idleTime >= warningMs) {
        // Show warning
        const remaining = Math.max(1, Math.ceil((timeoutMs - idleTime) / 1000));
        setRemainingSeconds(remaining);
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    timerRef.current = setInterval(checkInactivity, 1000);

    // Activity event listeners
    const handleUserInteraction = () => {
      // If warning is already showing, user must explicitly click "Extend Session"
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [enabled, timeoutMs, warningMs, onTimeout, showWarning]);

  return {
    showWarning,
    remainingSeconds,
    extendSession: resetTimer,
  };
}
