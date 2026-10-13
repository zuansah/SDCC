export type TraceStatus = 'issued' | 'printed' | 'void';

export interface TraceMapping {
  trace: string; // Document ID (e.g. TLK-XBWH9HFG)
  hostname: string;
  orderNumber: string;
  kota: string;
  pengadaan: string;
  siteCode?: string | null;
  siteName?: string | null;
  serial?: string | null;
  sid?: string | null;
  printPage?: number | null;
  note?: string | null;
  campaign?: string | null;
  customer: string;
  source: 'mapping-workbook' | 'app';
  importedAt?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  printedAt?: string | null;
  printedBy?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  status: TraceStatus;
  // Computed / joined fields
  inInventory?: boolean;
}

export interface IssueCandidate {
  hostname: string;
  orderNumber: string;
  kota?: string;
  pengadaan?: string;
  siteCode?: string;
  siteName?: string;
  serial?: string;
  sid?: string;
  customer?: string;
  campaign?: string;
  verdict?: 'new' | 'already_labelled' | 'no_order' | 'duplicate_in_file' | 'not_in_inventory';
  existingTrace?: string;
  inInventory?: boolean;
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
}

export type KnownField =
  | 'hostname'
  | 'orderNumber'
  | 'kota'
  | 'pengadaan'
  | 'siteCode'
  | 'siteName'
  | 'serial'
  | 'sid'
  | 'customer'
  | 'campaign';

export type ColumnMapping = Record<KnownField, string | null>;

export interface ExcelParsedRow {
  rowIndex: number; // 1-based original sheet row index
  raw: Record<string, any>;
  hostname: string;
  orderNumber: string;
  kota: string;
  pengadaan: string;
  siteCode: string;
  siteName: string;
  serial: string;
  sid: string;
  customer?: string;
  campaign?: string;
  verdict: 'new' | 'already_labelled' | 'no_order' | 'duplicate_in_file' | 'not_in_inventory';
  isPrintable: boolean;
  reason?: string;
  existingTrace?: string;
  inInventory?: boolean;
  matchedBy?: 'serial' | 'hostname' | null;
  filledFromInventory?: {
    serial?: boolean;
    kota?: boolean;
    siteCode?: boolean;
    siteName?: boolean;
    pengadaan?: boolean;
  };
}

export interface PrintQueueItem extends TraceMapping {
  queueId: string;
  qrSvg?: string;
  qrVerified?: boolean;
}
