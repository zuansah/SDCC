import { AssetItem, InventoryFilters } from '../types/inventory';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses date string (ISO or WIB) into a Date object
 */
export function parseDate(str: string | undefined | null): Date | null {
  if (!str) return null;
  const clean = str.trim();
  if (!clean) return null;

  if (clean.includes('+') || clean.endsWith('Z')) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  const iso = clean.replace(' ', 'T') + '+00:00';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats dataAsOf date into e.g. "2 Oct 2026, 16:27"
 */
export function formatInventoryDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const clean = dateStr.trim();
  const d = parseDate(clean);
  if (!d) return clean;

  const day = d.getUTCDate();
  const month = MONTH_NAMES_SHORT[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

/**
 * Checks if dataAsOf is more than 7 days old
 */
export function checkInventoryStaleness(dateStr: string | undefined | null): { isStale: boolean; daysOld: number } {
  if (!dateStr) return { isStale: false, daysOld: 0 };
  const d = parseDate(dateStr);
  if (!d) return { isStale: false, daysOld: 0 };

  const ageMs = Date.now() - d.getTime();
  const daysOld = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  return {
    isStale: daysOld >= 7,
    daysOld: Math.max(0, daysOld),
  };
}

/**
 * Formats acquisition price as Rupiah
 */
export function formatRupiah(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '—';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(amount);
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
}

/**
 * Produces timestamp slug YYYYMMDD-HHmm from dataAsOf
 */
export function getDataAsOfSlug(dataAsOf: string | undefined | null): string {
  if (dataAsOf) {
    const d = parseDate(dataAsOf);
    if (d) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const h = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      return `${y}${m}${day}-${h}${min}`;
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
 * Generates the CSV content for exported assets with UTF-8 BOM
 */
export function buildInventoryCsv(assets: AssetItem[]): string {
  const headers = [
    'Serial Number',
    'Platform',
    'Device Model',
    'Hostname',
    'Tenant',
    'Position Category',
    'SID SD-WAN',
    'SID Connectivity',
    'SID Status',
    'Location Address',
    'STO',
    'Region/Witel',
    'Witel Taxonomy',
    'Latitude',
    'Longitude',
    'Has Usable Coordinates',
    'Warehouse',
    'Warehouse Owner',
    'Warehouse Condition',
    'No Kontrak',
    'Nama Pengadaan',
    'Kode Kontrak',
    'Acquisition Value Per Unit',
    'NKA',
    'License Status',
    'License Norm',
    'System IP',
    'Logical ID',
    'Software Version',
    'IP WAN Public',
    'Replaces Serial'
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const a of assets) {
    // Tenant: if tenant_is_location === 1, render empty / '—'
    const tenantStr = a.tenant_is_location === 1 ? '' : (a.tenant_name || '');
    
    // SID SD-WAN & Connectivity
    const sidSdwanStr = a.sid_issued === 0 ? 'not issued' : (a.sid_sdwan ?? '');
    const sidConnStr = a.sid_issued === 0 ? 'not issued' : (a.sid_connectivity ?? '');
    const sidStatus = a.sid_issued === 1 ? 'Issued' : 'Not issued';

    // License: UNKNOWN means not recorded, output empty/dash
    const licenseNormStr = a.license_norm === 'UNKNOWN' ? '' : (a.license_norm || '');

    // Coordinates: only if has_coords === 1
    const latStr = a.has_coords === 1 ? (a.latitude ?? '') : '';
    const lngStr = a.has_coords === 1 ? (a.longitude ?? '') : '';

    const row = [
      escapeCsvCell(a.serial_number || ''),
      escapeCsvCell(a.platform || ''),
      escapeCsvCell(a.device_model || ''),
      escapeCsvCell(a.hostname || ''),
      escapeCsvCell(tenantStr),
      escapeCsvCell(a.position_category || ''),
      escapeCsvCell(sidSdwanStr),
      escapeCsvCell(sidConnStr),
      escapeCsvCell(sidStatus),
      escapeCsvCell(a.location_address || ''),
      escapeCsvCell(a.sto || ''),
      escapeCsvCell(a.region_witel || ''),
      escapeCsvCell(a.witel_taxonomy || ''),
      escapeCsvCell(latStr),
      escapeCsvCell(lngStr),
      escapeCsvCell(a.has_coords === 1 ? '1' : '0'),
      escapeCsvCell(a.warehouse || ''),
      escapeCsvCell(a.warehouse_owner || ''),
      escapeCsvCell(a.warehouse_condition || ''),
      escapeCsvCell(a.no_kontrak || ''),
      escapeCsvCell(a.nama_pengadaan || ''),
      escapeCsvCell(a.kode_kontrak || ''),
      escapeCsvCell(a.acq_value_per_unit ?? ''),
      escapeCsvCell(a.nka || ''),
      escapeCsvCell(a.license_status || ''),
      escapeCsvCell(licenseNormStr),
      escapeCsvCell(a.system_ip || ''),
      escapeCsvCell(a.logical_id || ''),
      escapeCsvCell(a.software_version || ''),
      escapeCsvCell(a.ip_wan_public || ''),
      escapeCsvCell(a.replaces_serial || '')
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Builds export filename: inventory_sdwan_<filters>_<YYYYMMDD-HHmm>.csv
 */
export function getInventoryExportFilename(filters: InventoryFilters, dataAsOf?: string): string {
  const parts: string[] = ['inventory_sdwan'];

  if (filters.platform !== 'ALL') parts.push(filters.platform.toLowerCase());
  if (filters.position !== 'ALL') {
    const slug = filters.position.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    parts.push(slug);
  }
  if (filters.tenant !== 'ALL') {
    const slug = filters.tenant.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    parts.push(slug);
  }
  if (filters.licence !== 'ALL') parts.push(filters.licence.toLowerCase());
  if (filters.warehouseOwner !== 'ALL') parts.push(filters.warehouseOwner.toLowerCase());
  if (filters.warehouseCondition !== 'ALL') parts.push(filters.warehouseCondition.toLowerCase());
  if (filters.sidIssued !== 'ALL') parts.push(filters.sidIssued);

  const timestamp = getDataAsOfSlug(dataAsOf);
  parts.push(timestamp);

  return `${parts.join('_')}.csv`;
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
