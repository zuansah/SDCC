/**
 * Enterprise Application Security & Anti-DDoS Module
 * Telkom Indonesia NSM SD-WAN Infrastructure
 *
 * Implements:
 * 1. Rate Limiting & Anti-Flood Guard (Application-level Anti-DDoS)
 * 2. Brute-Force & Credential Stuffing Lockout (Authentication Shield)
 * 3. Complete Clipboard Lockdown (Copy, Paste, Cut, Selection, Drag-Drop disabled)
 * 4. URL & Input Sanitization
 */

// ------------------------------------------------------------------------------------------------
// 1. APPLICATION-LEVEL ANTI-DDOS / RATE LIMITER
// ------------------------------------------------------------------------------------------------
interface RequestLog {
  timestamps: number[];
}

class RequestRateLimiter {
  private requests: Map<string, RequestLog> = new Map();
  private maxRequestsPerMinute: number;

  constructor(maxRequestsPerMinute = 60) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  public isAllowed(endpointOrKey = 'global'): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute sliding window

    const log = this.requests.get(endpointOrKey) || { timestamps: [] };
    // Filter timestamps inside current window
    log.timestamps = log.timestamps.filter((t) => t > windowStart);

    if (log.timestamps.length >= this.maxRequestsPerMinute) {
      const oldestInWindow = log.timestamps[0];
      const retryAfter = Math.max(1, Math.ceil((oldestInWindow + 60000 - now) / 1000));
      return { allowed: false, retryAfterSeconds: retryAfter };
    }

    log.timestamps.push(now);
    this.requests.set(endpointOrKey, log);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  public reset(endpointOrKey = 'global') {
    this.requests.delete(endpointOrKey);
  }
}

export const appRateLimiter = new RequestRateLimiter(60);

// ------------------------------------------------------------------------------------------------
// 2. AUTHENTICATION BRUTE-FORCE & FLOOD GUARD
// ------------------------------------------------------------------------------------------------
interface AuthAttemptRecord {
  failures: number;
  lockedUntil: number;
  lastAttempt: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

const authAttempts = new Map<string, AuthAttemptRecord>();

export const authFloodGuard = {
  checkAllowed(identifier: string): { allowed: boolean; remainingSeconds: number; attemptsLeft: number } {
    const key = (identifier || 'anonymous').trim().toLowerCase();
    const now = Date.now();
    const record = authAttempts.get(key);

    if (!record) {
      return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
    }

    if (record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, remainingSeconds, attemptsLeft: 0 };
    }

    // Reset if lockout window has expired
    if (record.lockedUntil > 0 && record.lockedUntil <= now) {
      authAttempts.delete(key);
      return { allowed: true, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS };
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - record.failures);
    return { allowed: true, remainingSeconds: 0, attemptsLeft };
  },

  recordFailure(identifier: string): { locked: boolean; remainingSeconds: number; attemptsLeft: number } {
    const key = (identifier || 'anonymous').trim().toLowerCase();
    const now = Date.now();
    const record = authAttempts.get(key) || { failures: 0, lockedUntil: 0, lastAttempt: now };

    record.failures += 1;
    record.lastAttempt = now;

    if (record.failures >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      authAttempts.set(key, record);
      return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000), attemptsLeft: 0 };
    }

    authAttempts.set(key, record);
    return {
      locked: false,
      remainingSeconds: 0,
      attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - record.failures),
    };
  },

  recordSuccess(identifier: string) {
    const key = (identifier || 'anonymous').trim().toLowerCase();
    authAttempts.delete(key);
  },
};

// ------------------------------------------------------------------------------------------------
// 3. CLIPBOARD & COPY-PASTE DEACTIVATION
// ------------------------------------------------------------------------------------------------
export function initCompleteClipboardLockdown(onBlocked?: (action: string) => void): () => void {
  let toastTimeout: any = null;

  const notifyBlocked = (action: string) => {
    if (onBlocked) {
      try { onBlocked(action); } catch (_) {}
    }

    // Default unobtrusive visual feedback
    let toast = document.getElementById('security-copy-paste-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'security-copy-paste-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.zIndex = '99999';
      toast.style.background = '#0f172a';
      toast.style.color = '#f8fafc';
      toast.style.padding = '10px 16px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '12px';
      toast.style.fontWeight = '600';
      toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.4)';
      toast.style.border = '1px solid #334155';
      toast.style.display = 'flex';
      toast.style.alignItems = 'center';
      toast.style.gap = '8px';
      toast.style.transition = 'all 0.2s ease-in-out';
      toast.style.pointerEvents = 'none';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span style="color:#ef4444">🔒</span> Action Blocked: <strong>${action}</strong> is deactivated under Telkom Cyber Security Policy.`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
      }
    }, 2800);
  };

  // Block copy
  const handleCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
    }
    notifyBlocked('Copy');
  };

  // Block paste
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
    }
    notifyBlocked('Paste');
  };

  // Block cut
  const handleCut = (e: ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
    }
    notifyBlocked('Cut');
  };

  // Block right-click context menu (which exposes Inspect Element)
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    notifyBlocked('Inspect Element & Context Menu');
  };

  // Block drag & drop content injection
  const handleDragStart = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    // If it is a file upload to an intentional file drop zone, allow it
    const target = e.target as HTMLElement;
    if (target && target.closest('[data-allow-drop="true"]')) {
      return;
    }
    e.preventDefault();
  };

  // Block keyboard shortcuts: F12, Ctrl/Cmd + Shift + I/J/C, Ctrl/Cmd + U, C, V, X, A, S
  const handleKeyDown = (e: KeyboardEvent) => {
    // Block F12 (Inspect)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked('F12 (DevTools / Inspect)');
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;
    const key = e.key.toLowerCase();

    // Block Inspect shortcut combinations:
    // Ctrl+Shift+I, Cmd+Opt+I (DevTools)
    // Ctrl+Shift+J, Cmd+Opt+J (Console)
    // Ctrl+Shift+C, Cmd+Opt+C (Inspect Element)
    if (
      (isCtrlOrCmd && isShift && (key === 'i' || key === 'j' || key === 'c')) ||
      (e.metaKey && isAlt && (key === 'i' || key === 'j' || key === 'c'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked('Inspect / Developer Tools Shortcut');
      return;
    }

    // Ctrl+U / Cmd+Opt+U (View Source)
    if ((isCtrlOrCmd && key === 'u') || (e.metaKey && isAlt && key === 'u')) {
      e.preventDefault();
      e.stopPropagation();
      notifyBlocked('View Source (Ctrl+U)');
      return;
    }

    if (!isCtrlOrCmd) return;

    if (key === 'c') {
      e.preventDefault();
      notifyBlocked('Ctrl+C (Copy)');
    } else if (key === 'v') {
      e.preventDefault();
      notifyBlocked('Ctrl+V (Paste)');
    } else if (key === 'x') {
      e.preventDefault();
      notifyBlocked('Ctrl+X (Cut)');
    } else if (key === 'a') {
      // Prevent selecting all content unless inside an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
    } else if (key === 's') {
      // Prevent saving page HTML
      e.preventDefault();
      notifyBlocked('Save Page (Ctrl+S)');
    }
  };

  document.addEventListener('copy', handleCopy, true);
  document.addEventListener('paste', handlePaste, true);
  document.addEventListener('cut', handleCut, true);
  document.addEventListener('contextmenu', handleContextMenu, true);
  document.addEventListener('dragstart', handleDragStart, true);
  document.addEventListener('drop', handleDrop, true);
  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    document.removeEventListener('copy', handleCopy, true);
    document.removeEventListener('paste', handlePaste, true);
    document.removeEventListener('cut', handleCut, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('dragstart', handleDragStart, true);
    document.removeEventListener('drop', handleDrop, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    clearTimeout(toastTimeout);
    const toast = document.getElementById('security-copy-paste-toast');
    if (toast) toast.remove();
  };
}

// ------------------------------------------------------------------------------------------------
// 4. URL SANITIZATION
// ------------------------------------------------------------------------------------------------
export function sanitizeBrowserUrl() {
  if (typeof window === 'undefined') return;
  // If URL has search parameters, clean them unless explicit role parameter
  const search = window.location.search;
  if (search && !search.includes('role=technician')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

// ------------------------------------------------------------------------------------------------
// 5. DEVTOOLS ACTIVE INSPECTION DETECTOR
// ------------------------------------------------------------------------------------------------
export function initDevToolsWatcher(onDetected?: (isOpen: boolean) => void): () => void {
  let isDevToolsOpen = false;

  const check = () => {
    // If DevTools is open/docked, outer and inner dimensions differ significantly (>160px)
    const widthDiff = window.outerWidth - window.innerWidth > 160;
    const heightDiff = window.outerHeight - window.innerHeight > 160;
    const detected = widthDiff || heightDiff;

    if (detected !== isDevToolsOpen) {
      isDevToolsOpen = detected;
      if (onDetected) {
        onDetected(detected);
      }
    }
  };

  const interval = setInterval(check, 1500);
  window.addEventListener('resize', check);

  return () => {
    clearInterval(interval);
    window.removeEventListener('resize', check);
  };
}
