import QRCode from 'qrcode';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import {
  TraceMapping,
  KnownField,
  ColumnMapping,
  ExcelSheetInfo,
} from '../types/trace';

// Exactly 30 characters, omitting 0, 1, I, L, O, U
export const TRACE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a crypto-secure unique Trace ID format: TLK- + 8 characters
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let id = 'TLK-';
  for (let i = 0; i < 8; i++) {
    id += TRACE_ALPHABET[bytes[i] % TRACE_ALPHABET.length];
  }
  return id;
}

/**
 * Safely converts any date, Firestore Timestamp, or number into an ISO string or null
 */
export function toIsoStringSafe(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (val?.seconds != null && typeof val.seconds === 'number') {
    try {
      return new Date(val.seconds * 1000).toISOString();
    } catch {
      return null;
    }
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
}

/**
 * Normalizes raw Firestore document data to standard TraceMapping
 */
export function normalizeTraceDoc(id: string, data: any): TraceMapping {
  const traceId = id || data.trace || data['Trace ID'] || '';
  const hostname = data.hostname || data.Hostname || '';
  const orderNumber = data.orderNumber || data.Order || data['Order Number'] || '';
  const kota = data.kota || data.Kota || '';
  const pengadaan = data.pengadaan || data['No Pengadaan'] || data.noPengadaan || '';
  const siteCode = data.siteCode || data['Site Code'] || null;
  const siteName = data.siteName || data['Site Name'] || null;
  const serial = data.serial || data.Serial || data['Serial Number'] || null;
  const sid = data.sid || data.SID || null;
  const printPage = data.printPage ?? (data['Print Page'] ? Number(data['Print Page']) : null);
  const note = data.note || data.Note || null;
  const campaign = data.campaign || data.Campaign || 'General';

  let customer = data.customer || data.Customer || '';
  if (!customer) {
    if (hostname.toUpperCase().includes('BANKNTT')) {
      customer = 'BANK NTT';
    } else {
      customer = 'INDOMARET';
    }
  }

  const source = data.source || (data.importedAt ? 'mapping-workbook' : 'app');
  const status = (data.status || 'printed') as 'issued' | 'printed' | 'void';

  return {
    trace: traceId,
    hostname: hostname.trim(),
    orderNumber: String(orderNumber).trim(),
    kota: String(kota).trim(),
    pengadaan: String(pengadaan).trim(),
    siteCode: siteCode ? String(siteCode).trim() : null,
    siteName: siteName ? String(siteName).trim() : null,
    serial: serial ? String(serial).trim() : null,
    sid: sid ? String(sid).trim() : null,
    printPage,
    note,
    campaign,
    customer,
    source,
    importedAt: toIsoStringSafe(data.importedAt),
    issuedAt: toIsoStringSafe(data.issuedAt || data.importedAt),
    issuedBy: data.issuedBy ? String(data.issuedBy) : null,
    printedAt: toIsoStringSafe(data.printedAt),
    printedBy: data.printedBy ? String(data.printedBy) : null,
    voidedAt: toIsoStringSafe(data.voidedAt),
    voidedBy: data.voidedBy ? String(data.voidedBy) : null,
    status,
  };
}

/**
 * Fixed QR Parameters (measured from field stickers):
 * Version: 1 (21x21 modules)
 * Error correction: M
 * Margin: 4 modules
 * Scale: 8 (giving 232x232 px)
 * Colors: pure black on pure white
 * Payload: bare Trace ID (TLK-XXXXXXXX)
 *
 * Generates SVG output and verifies round-trip decode with jsQR
 */
export async function generateAndVerifyQrSvg(
  traceId: string
): Promise<{ svg: string; verified: boolean }> {
  const opts = {
    version: 1 as const,
    errorCorrectionLevel: 'M' as const,
    margin: 4,
    scale: 8,
    color: { dark: '#000000ff', light: '#ffffffff' },
  };

  // 1. Generate SVG string
  const rawSvg = await QRCode.toString(traceId, { ...opts, type: 'svg' });
  // Explicitly size in millimetres: 20.5 x 20.5 mm for physical field stickers
  const svg = rawSvg.replace('<svg ', '<svg width="20.5mm" height="20.5mm" ');

  // 2. Client-side round-trip decode verification
  let verified = false;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, traceId, opts);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height);
        if (decoded && decoded.data === traceId) {
          verified = true;
        }
      }
    } catch (err) {
      console.warn('QR verification error for', traceId, err);
      verified = false;
    }
  } else {
    verified = true;
  }

  return { svg, verified };
}

/**
 * Normalizes column header text for fuzzy matching
 */
export function cleanColumnName(name: string): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Auto-detects matching KnownField for a column name
 */
export function matchKnownColumn(header: string): KnownField | null {
  const cleaned = cleanColumnName(header);
  if (!cleaned) return null;

  // Hostname
  if (
    cleaned === 'hostname' ||
    cleaned === 'sdwanhostname' ||
    cleaned === 'host' ||
    cleaned === 'hostnamerouter' ||
    cleaned === 'devicehostname' ||
    cleaned === 'devicename' ||
    cleaned === 'namaalat' ||
    cleaned === 'device'
  ) {
    return 'hostname';
  }

  // Order Number
  if (
    cleaned === 'order' ||
    cleaned === 'sdwanordernumber' ||
    cleaned === 'ordersdwan' ||
    cleaned === 'ordernumber' ||
    cleaned === 'noorder' ||
    cleaned === 'orderno' ||
    cleaned === 'nomororder' ||
    cleaned === 'ordersdwanid' ||
    cleaned === 'sdwanorder' ||
    cleaned === 'ordernum' ||
    cleaned === 'orderid' ||
    cleaned === 'idorder' ||
    cleaned === 'nopesanan'
  ) {
    return 'orderNumber';
  }

  // Kota
  if (
    cleaned === 'kota' ||
    cleaned === 'branch' ||
    cleaned === 'city' ||
    cleaned === 'witel' ||
    cleaned === 'lokasi' ||
    cleaned === 'regionwitel' ||
    cleaned === 'kabupaten' ||
    cleaned === 'wilayah' ||
    cleaned === 'witelnorm'
  ) {
    return 'kota';
  }

  // No Pengadaan
  if (
    cleaned === 'nopengadaan' ||
    cleaned === 'pengadaan' ||
    cleaned === 'nomorpengadaan' ||
    cleaned === 'kontrakpengadaan' ||
    cleaned === 'nokontrak' ||
    cleaned === 'nokontrakpengadaan' ||
    cleaned === 'nomorkontrak' ||
    cleaned === 'suratpesanan' ||
    cleaned === 'sp' ||
    cleaned === 'no_pengadaan' ||
    cleaned === 'pengadaanno' ||
    cleaned === 'namapengadaan'
  ) {
    return 'pengadaan';
  }

  // Site Code
  if (
    cleaned === 'sitecode' ||
    cleaned === 'kodetoko' ||
    cleaned === 'alias' ||
    cleaned === 'site' ||
    cleaned === 'kodesite' ||
    cleaned === 'storecode' ||
    cleaned === 'sto'
  ) {
    return 'siteCode';
  }

  // Site Name
  if (
    cleaned === 'sitename' ||
    cleaned === 'namacabang' ||
    cleaned === 'alamat' ||
    cleaned === 'namatoko' ||
    cleaned === 'lokasi' ||
    cleaned === 'namasite' ||
    cleaned === 'storename' ||
    cleaned === 'branchname' ||
    cleaned === 'locationaddress'
  ) {
    return 'siteName';
  }

  // Serial Number
  if (
    cleaned === 'snfortinet' ||
    cleaned === 'serialnumber' ||
    cleaned === 'sn' ||
    cleaned === 'serial' ||
    cleaned === 'snedge' ||
    cleaned === 'snrouter' ||
    cleaned === 'noseri' ||
    cleaned === 'nomorseri' ||
    cleaned === 'devicesn' ||
    cleaned === 'sncisco' ||
    cleaned === 'serial_number'
  ) {
    return 'serial';
  }

  // SID SDWAN
  if (
    cleaned === 'sidsdwan' ||
    cleaned === 'sid' ||
    cleaned === 'sidconnectivity' ||
    cleaned === 'sdwansid'
  ) {
    return 'sid';
  }

  // Customer / Tenant
  if (
    cleaned === 'customer' ||
    cleaned === 'pelanggan' ||
    cleaned === 'tenant' ||
    cleaned === 'client' ||
    cleaned === 'namapelanggan' ||
    cleaned === 'tenantname' ||
    cleaned === 'namatenant'
  ) {
    return 'customer';
  }

  // Campaign / Batch
  if (
    cleaned === 'campaign' ||
    cleaned === 'batch' ||
    cleaned === 'proyek' ||
    cleaned === 'project' ||
    cleaned === 'kegiatan' ||
    cleaned === 'gelombang'
  ) {
    return 'campaign';
  }

  return null;
}

/**
 * Scans the first 10 rows of a sheet, scores each row by matching known headers,
 * and identifies the best header row.
 */
export function detectHeaderRow(rawMatrix: any[][]): {
  headerRowIndex: number; // 0-indexed row in rawMatrix
  headers: string[];
  ignoredColumnsCount: number;
  dataRowsCount: number;
  mapping: ColumnMapping;
} {
  const scanLimit = Math.min(10, rawMatrix.length);
  let bestRowIndex = 0;
  let bestScore = -1;
  let bestHeaders: string[] = [];

  for (let r = 0; r < scanLimit; r++) {
    const row = rawMatrix[r] || [];
    let score = 0;
    const currentHeaders: string[] = [];

    for (let c = 0; c < row.length; c++) {
      const val = row[c] != null ? String(row[c]).trim() : '';
      currentHeaders.push(val);
      if (val) {
        const match = matchKnownColumn(val);
        if (match) {
          // Weight hostname and orderNumber higher
          if (match === 'hostname' || match === 'orderNumber') {
            score += 3;
          } else {
            score += 1;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
      bestHeaders = currentHeaders;
    }
  }

  // Trim leading completely empty columns if any
  let firstValidCol = 0;
  while (firstValidCol < bestHeaders.length && !bestHeaders[firstValidCol]) {
    firstValidCol++;
  }

  // Auto-map headers
  const mapping: ColumnMapping = {
    hostname: null,
    orderNumber: null,
    kota: null,
    pengadaan: null,
    siteCode: null,
    siteName: null,
    serial: null,
    sid: null,
    customer: null,
    campaign: null,
  };

  let ignoredCount = 0;
  for (let c = firstValidCol; c < bestHeaders.length; c++) {
    const h = bestHeaders[c];
    if (!h) continue;
    const matchedField = matchKnownColumn(h);
    if (matchedField && !mapping[matchedField]) {
      mapping[matchedField] = h;
    } else {
      ignoredCount++;
    }
  }

  // Count non-empty data rows after header row until first run of completely blank rows
  let dataRowsCount = 0;
  let consecutiveEmpty = 0;
  for (let r = bestRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r] || [];
    const hasData = row.some((cell) => cell != null && String(cell).trim().length > 0);
    if (hasData) {
      dataRowsCount++;
      consecutiveEmpty = 0;
    } else {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3) {
        break; // Stop at trailing blanks
      }
    }
  }

  return {
    headerRowIndex: bestRowIndex,
    headers: bestHeaders.filter(Boolean),
    ignoredColumnsCount: ignoredCount,
    dataRowsCount,
    mapping,
  };
}

/**
 * Exports an XLSX workbook to browser file download
 */
export function exportExcelWorkbook(
  sheets: { sheetName: string; rows: any[] }[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.substring(0, 31));
  }

  XLSX.writeFile(wb, filename);
}

/**
 * Escapes a cell for CSV formatting
 */
function escapeCsv(val: any): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds CSV content for Trace Registry with UTF-8 BOM
 */
export function buildTraceRegistryCsv(mappings: TraceMapping[]): string {
  const headers = [
    'Trace ID',
    'Hostname',
    'Customer',
    'Kota',
    'Site Code',
    'Site Name',
    'Order Number',
    'Serial Number',
    'No Pengadaan',
    'Campaign',
    'Status',
    'In Inventory',
    'Source',
    'Issued By',
    'Issued At',
    'Printed By',
    'Printed At',
    'Voided By',
    'Voided At',
    'Note',
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  for (const m of mappings) {
    const row = [
      escapeCsv(m.trace),
      escapeCsv(m.hostname),
      escapeCsv(m.customer),
      escapeCsv(m.kota),
      escapeCsv(m.siteCode || ''),
      escapeCsv(m.siteName || ''),
      escapeCsv(m.orderNumber || ''),
      escapeCsv(m.serial || ''),
      escapeCsv(m.pengadaan || ''),
      escapeCsv(m.campaign || ''),
      escapeCsv(m.status),
      escapeCsv(m.inInventory ? 'Yes' : 'No'),
      escapeCsv(m.source),
      escapeCsv(m.issuedBy || ''),
      escapeCsv(m.issuedAt || ''),
      escapeCsv(m.printedBy || ''),
      escapeCsv(m.printedAt || ''),
      escapeCsv(m.voidedBy || ''),
      escapeCsv(m.voidedAt || ''),
      escapeCsv(m.note || ''),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers CSV file download in browser
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
