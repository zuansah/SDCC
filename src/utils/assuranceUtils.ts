import { AssuranceTicket } from '../types/assurance';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parses date string in WIB (UTC+7)
 */
export function parseWibDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const clean = str.trim();
  if (!clean) return null;

  if (clean.includes('+') || clean.endsWith('Z')) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  const iso = clean.replace(' ', 'T') + '+07:00';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats "2026-09-25T16:52:24" into "25 Sep 2026 16:52"
 */
export function formatWibDateTime(dateStr: string | undefined | null, includeWib = true): string {
  if (!dateStr) return '—';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const month = MONTH_NAMES_SHORT[monthIdx] || match[2];
    const time = `${match[4]}:${match[5]}`;
    return `${day} ${month} ${year} ${time}${includeWib ? ' WIB' : ''}`;
  }
  return clean;
}

/**
 * Formats "2026-09" into "Sep 2026"
 */
export function formatMonthLabel(monthStr: string | undefined | null): string {
  if (!monthStr) return '—';
  const match = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const m = MONTH_NAMES_SHORT[monthIdx] || match[2];
    return `${m} ${year}`;
  }
  return monthStr;
}

/**
 * Formats dataAsOf timestamp into YYYYMMDD-HHmm
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
 * Quotes every CSV cell and doubles internal quotes
 */
export function escapeCsvCell(val: any): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds CSV content for Assurance tickets with UTF-8 BOM
 */
export function buildAssuranceTicketsCsv(tickets: AssuranceTicket[]): string {
  const headers = [
    'Ticket ID',
    'Status',
    'Created (WIB)',
    'Resolved (WIB)',
    'TTR (hours)',
    'Customer',
    'SD-WAN SID',
    'Ticketed SID',
    'Division',
    'Witel',
    'Region',
    'Category',
    'Asset',
    'Urgency',
    'Gamas',
    'Proactive',
    'Owner',
    'Solution',
    'Headline',
    'Re-opened',
    'Next Ticket',
    'Provisional'
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const t of tickets) {
    const row = [
      escapeCsvCell(t.id || ''),
      escapeCsvCell(t.status || ''),
      escapeCsvCell(t.created || ''),
      escapeCsvCell(t.resolved || ''),
      escapeCsvCell(t.ttrH != null ? t.ttrH.toFixed(2) : ''),
      escapeCsvCell(t.customer || ''),
      escapeCsvCell(t.svc || ''),
      escapeCsvCell(t.sid || ''),
      escapeCsvCell(t.divisi || ''),
      escapeCsvCell(t.witel || ''),
      escapeCsvCell(t.region || ''),
      escapeCsvCell(t.category || ''),
      escapeCsvCell(t.asset || ''),
      escapeCsvCell(t.urgency || ''),
      escapeCsvCell(t.gamas ? 'Yes' : 'No'),
      escapeCsvCell(t.proactive ? 'Yes' : 'No'),
      escapeCsvCell(t.owner || ''),
      escapeCsvCell(t.solution || ''),
      escapeCsvCell(t.headline || ''),
      escapeCsvCell(t.reopened ? 'Yes' : 'No'),
      escapeCsvCell(t.nextTicket || ''),
      escapeCsvCell(t.provisional ? 'Yes' : 'No')
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers browser download with UTF-8 BOM
 */
export function triggerCsvDownload(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
