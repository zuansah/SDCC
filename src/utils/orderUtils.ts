import { PeriodFilter } from '../types/orders';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses a date string that represents WIB (Asia/Jakarta, UTC+7) time.
 * If the string has no timezone offset (e.g. "2026-09-25 15:05:29"),
 * it appends "+07:00" to ensure it represents the exact instant in WIB.
 */
export function parseWibDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const clean = str.trim();
  if (!clean) return null;
  
  // If string contains offset (+XX:XX) or ends with Z, parse directly
  if (clean.includes('+') || clean.endsWith('Z')) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }
  
  // If string is YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss, treat as WIB (+07:00)
  const isoFormatted = clean.replace(' ', 'T') + '+07:00';
  const d = new Date(isoFormatted);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a WIB date string into e.g. "25 Sep 2026 15:05 WIB"
 */
export function formatWibDateTime(dateStr: string | undefined | null, includeWib = true): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim();
  
  // Match standard YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const month = MONTH_NAMES_SHORT[monthIdx] || match[2];
    const hours = match[4];
    const minutes = match[5];

    if (hours !== undefined && minutes !== undefined) {
      return `${day} ${month} ${year} ${hours}:${minutes}${includeWib ? ' WIB' : ''}`;
    }
    return `${day} ${month} ${year}`;
  }

  // Fallback to Date parser if format differs
  const d = parseWibDate(clean);
  if (!d) return clean;

  const day = d.getDate();
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}${includeWib ? ' WIB' : ''}`;
}

/**
 * Formats time only, e.g. "13:50"
 */
export function formatWibTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim();
  const match = clean.match(/[T\s](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  const d = parseWibDate(clean);
  if (!d) return clean;
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * Formats WIB date string as YYYY-MM-DD HH:MM (without timezone conversion).
 * E.g. "2026-09-25 15:05:29" -> "2026-09-25 15:05"
 */
export function formatWibMinute(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  const matchDate = clean.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matchDate) {
    return matchDate[1];
  }
  return clean;
}

/**
 * Extracts YYYYMMDD-HHmm slug from dataAsOf string, e.g. "20260925-1537"
 */
export function getDataAsOfSlug(dataAsOf: string | undefined | null): string {
  if (dataAsOf) {
    const match = dataAsOf.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}-${match[4]}${match[5]}`;
    }
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${h}${min}`;
}


/**
 * Formats date only, e.g. "21 Sep 2026"
 */
export function formatWibDateOnly(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const month = MONTH_NAMES_SHORT[monthIdx] || match[2];
    return `${day} ${month} ${year}`;
  }
  const d = parseWibDate(clean);
  if (!d) return clean;
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Durations:
 * - under a minute -> "<1m"
 * - under an hour -> "Xm"
 * - under two days -> "Xh Ym"
 * - beyond -> "Xd Yh"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = totalMinutes % 60;

  if (totalMinutes < 1) return '<1m';
  if (totalHours < 1) return `${mins}m`;
  if (days < 2) return `${totalHours}h ${mins}m`;
  return `${days}d ${hours}h`;
}

/**
 * Calculates waiting gap between two steps.
 * Returns formatted string if gap >= 1 minute (60,000 ms), otherwise null.
 */
export function getWaitTime(prevFinishStr: string | null | undefined, currentStartStr: string | null | undefined): string | null {
  if (!prevFinishStr || !currentStartStr) return null;
  const prevFinish = parseWibDate(prevFinishStr);
  const currentStart = parseWibDate(currentStartStr);
  if (!prevFinish || !currentStart) return null;

  const gapMs = currentStart.getTime() - prevFinish.getTime();
  if (gapMs >= 60 * 1000) {
    return formatDuration(gapMs);
  }
  return null;
}

/**
 * Checks whether a given statusDate falls within the specified PeriodFilter.
 * Anchor date is dataAsOf date, falling back to current date.
 */
export function isDateInPeriod(dateStr: string | undefined | null, period: PeriodFilter, anchorDate: Date): boolean {
  if (!dateStr) return false;
  const d = parseWibDate(dateStr);
  if (!d) return false;

  const diffMs = anchorDate.getTime() - d.getTime();
  // Note: Allow minor future timestamps within 1 day in case of slight clock difference
  if (diffMs < -24 * 60 * 60 * 1000) return false;

  switch (period) {
    case 'month': {
      // Same month and year as anchorDate in WIB
      return d.getFullYear() === anchorDate.getFullYear() && d.getMonth() === anchorDate.getMonth();
    }
    case '30d': {
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    }
    case '90d': {
      return diffMs <= 90 * 24 * 60 * 60 * 1000;
    }
    case '12m': {
      return diffMs <= 365 * 24 * 60 * 60 * 1000;
    }
    default:
      return true;
  }
}

/**
 * Formats currency as Indonesian Rupiah (Rp X.XXX.XXX)
 */
export function formatRupiah(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '-';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * Fixed top-7 color palette and Other color as specified in v2 requirements:
 * #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7
 * Everything else is #b9b8b2
 */
export const TOP_7_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
];

export const OTHER_COLOR = '#b9b8b2';

/**
 * Formats days as whole days, e.g. "1037d", "940d", "0d", with no decimals.
 */
export function formatWholeDays(days: number | undefined | null): string {
  if (days === undefined || days === null) return '-';
  return `${Math.round(days)}d`;
}

