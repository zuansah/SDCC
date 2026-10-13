import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Server,
  Building2,
  FileSpreadsheet,
  Clock,
  Radio,
  Tag,
  Key,
  HardDrive,
  Pencil,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  Check,
  Loader2
} from 'lucide-react';
import { useInventoryData } from '../hooks/useInventoryData';
import { AssetItem, InventoryFilters } from '../types/inventory';
import { auth } from '../lib/firebase';
import AssetEditModal from './AssetEditModal';
import {
  formatInventoryDate,
  formatRupiah,
  buildInventoryCsv,
  getInventoryExportFilename,
  triggerCsvDownload
} from '../utils/inventoryUtils';

const PAGE_SIZE = 100;

export default function InventoryDashboard() {
  const { 
    data, 
    loading, 
    refreshing, 
    error, 
    isStale, 
    daysOld, 
    refetch,
    saveAssetEdit,
    revertAssetEdit,
    addCustomAsset,
    editsCount
  } = useInventoryData();

  const userEmail = auth.currentUser?.email || auth.currentUser?.displayName || 'User';

  // Parse initial filters from URL query parameters
  const getInitialFilters = (): InventoryFilters => {
    const params = new URLSearchParams(window.location.search);
    return {
      platform: params.get('platform') || 'ALL',
      position: params.get('position') || 'ALL',
      tenant: params.get('tenant') || 'ALL',
      witel: params.get('witel') || 'ALL',
      licence: params.get('licence') || 'ALL',
      warehouseOwner: params.get('owner') || 'ALL',
      warehouseCondition: params.get('cond') || 'ALL',
      sidIssued: params.get('sid') || 'ALL',
      hasCoords: params.get('coords') || 'ALL',
      validationStatus: params.get('validation') || 'ALL',
      search: params.get('q') || '',
    };
  };

  const [filters, setFilters] = useState<InventoryFilters>(getInitialFilters);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof AssetItem>('serial_number');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Sync filters to URL query string so links can be shared
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.platform !== 'ALL') params.set('platform', filters.platform);
    if (filters.position !== 'ALL') params.set('position', filters.position);
    if (filters.tenant !== 'ALL') params.set('tenant', filters.tenant);
    if (filters.witel !== 'ALL') params.set('witel', filters.witel);
    if (filters.licence !== 'ALL') params.set('licence', filters.licence);
    if (filters.warehouseOwner !== 'ALL') params.set('owner', filters.warehouseOwner);
    if (filters.warehouseCondition !== 'ALL') params.set('cond', filters.warehouseCondition);
    if (filters.sidIssued !== 'ALL') params.set('sid', filters.sidIssued);
    if (filters.hasCoords !== 'ALL') params.set('coords', filters.hasCoords);
    if (filters.validationStatus !== 'ALL') params.set('validation', filters.validationStatus);
    if (filters.search) params.set('q', filters.search);

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  // Clean up URL query parameters on unmount so Overview and other modules stay pristine
  useEffect(() => {
    return () => {
      if (window.location.search && !window.location.search.includes('role=technician')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
  }, []);

  const allAssets = useMemo(() => data?.assets || [], [data?.assets]);
  const meta = data?.meta;

  // Extract distinct tenants (excluding tenant_is_location === 1)
  const tenantOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allAssets) {
      if (a.tenant_is_location === 1) continue;
      const t = a.tenant_name?.trim();
      if (t) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allAssets]);

  // Extract grouped witels by witel_taxonomy
  const witelTaxonomyGroups = useMemo(() => {
    const regions: Record<string, number> = {};
    const divisions: Record<string, number> = {};
    const witels: Record<string, number> = {};
    let notRecordedCount = 0;

    for (const a of allAssets) {
      const taxonomy = a.witel_taxonomy?.toLowerCase();
      const val = a.region_witel?.trim();

      if (!val || taxonomy === 'unknown') {
        notRecordedCount++;
      } else if (taxonomy === 'region') {
        regions[val] = (regions[val] || 0) + 1;
      } else if (taxonomy === 'division') {
        divisions[val] = (divisions[val] || 0) + 1;
      } else if (taxonomy === 'witel') {
        witels[val] = (witels[val] || 0) + 1;
      } else {
        notRecordedCount++;
      }
    }

    return {
      regions: Object.entries(regions).sort((a, b) => b[1] - a[1]),
      divisions: Object.entries(divisions).sort((a, b) => b[1] - a[1]),
      witels: Object.entries(witels).sort((a, b) => b[1] - a[1]),
      notRecordedCount,
    };
  }, [allAssets]);

  // Filter assets based on all criteria
  const filteredAssets = useMemo(() => {
    const q = filters.search.trim().toLowerCase();

    return allAssets.filter(a => {
      // Platform filter
      if (filters.platform !== 'ALL' && a.platform !== filters.platform) {
        return false;
      }

      // Position filter
      if (filters.position !== 'ALL' && a.position_category !== filters.position) {
        return false;
      }

      // Tenant filter (remember: rows with tenant_is_location === 1 have no real tenant)
      if (filters.tenant !== 'ALL') {
        if (a.tenant_is_location === 1 || a.tenant_name?.trim() !== filters.tenant) {
          return false;
        }
      }

      // Witel filter
      if (filters.witel !== 'ALL') {
        if (filters.witel === '__NOT_RECORDED__') {
          if (a.region_witel && a.witel_taxonomy !== 'unknown') {
            return false;
          }
        } else if (a.region_witel?.trim() !== filters.witel) {
          return false;
        }
      }

      // Licence filter
      if (filters.licence !== 'ALL') {
        if (filters.licence === 'UNKNOWN') {
          if (a.license_norm && a.license_norm !== 'UNKNOWN') return false;
        } else if (a.license_norm !== filters.licence) {
          return false;
        }
      }

      // Warehouse Owner
      if (filters.warehouseOwner !== 'ALL' && a.warehouse_owner !== filters.warehouseOwner) {
        return false;
      }

      // Warehouse Condition
      if (filters.warehouseCondition !== 'ALL' && a.warehouse_condition !== filters.warehouseCondition) {
        return false;
      }

      // SID issued
      if (filters.sidIssued === 'issued' && a.sid_issued !== 1) {
        return false;
      }
      if (filters.sidIssued === 'not_issued' && a.sid_issued === 1) {
        return false;
      }

      // Coordinates
      if (filters.hasCoords === 'with_coords' && a.has_coords !== 1) {
        return false;
      }
      if (filters.hasCoords === 'no_coords' && a.has_coords === 1) {
        return false;
      }

      // Validation status filter
      if (filters.validationStatus && filters.validationStatus !== 'ALL') {
        if (filters.validationStatus === 'MODIFIED' && !a.is_modified) {
          return false;
        } else if (filters.validationStatus === 'VALIDATED' && a.validation_status !== 'VALIDATED') {
          return false;
        } else if (filters.validationStatus === 'NEEDS_REVIEW' && a.validation_status !== 'NEEDS_REVIEW') {
          return false;
        } else if (filters.validationStatus === 'PENDING' && a.validation_status !== 'PENDING') {
          return false;
        } else if (filters.validationStatus === 'CUSTOM_ADDED' && !a.is_custom_added) {
          return false;
        }
      }

      // Search box across serial_number, hostname, sid_sdwan, sid_connectivity, location_address, nka, kode_kontrak
      if (q) {
        const matchesSerial = a.serial_number?.toLowerCase().includes(q);
        const matchesHostname = a.hostname?.toLowerCase().includes(q);
        const matchesSidSdwan = a.sid_sdwan ? String(a.sid_sdwan).toLowerCase().includes(q) : false;
        const matchesSidConn = a.sid_connectivity ? String(a.sid_connectivity).toLowerCase().includes(q) : false;
        const matchesAddress = a.location_address?.toLowerCase().includes(q);
        const matchesNka = a.nka?.toLowerCase().includes(q);
        const matchesKodeKontrak = a.kode_kontrak?.toLowerCase().includes(q);

        if (
          !matchesSerial &&
          !matchesHostname &&
          !matchesSidSdwan &&
          !matchesSidConn &&
          !matchesAddress &&
          !matchesNka &&
          !matchesKodeKontrak
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allAssets, filters]);

  // Sort assets
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(String(valB));
        return sortAsc ? comp : -comp;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredAssets, sortField, sortAsc]);

  // Total pages and paged slice
  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / PAGE_SIZE));
  const pagedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return sortedAssets.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedAssets, currentPage]);

  const handleSort = (field: keyof AssetItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      platform: 'ALL',
      position: 'ALL',
      tenant: 'ALL',
      witel: 'ALL',
      licence: 'ALL',
      warehouseOwner: 'ALL',
      warehouseCondition: 'ALL',
      sidIssued: 'ALL',
      hasCoords: 'ALL',
      validationStatus: 'ALL',
      search: '',
    });
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const csvContent = buildInventoryCsv(sortedAssets);
        const filename = getInventoryExportFilename(filters, meta?.dataAsOf);
        triggerCsvDownload(csvContent, filename);
      } catch (err) {
        console.error('Error exporting inventory CSV:', err);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  // KPI shortcut toggles
  const toggleKpiFilter = (type: 'total' | 'deployed' | 'warehouse' | 'dormant' | 'license_expired' | 'sid_issued' | 'modified') => {
    setCurrentPage(1);
    switch (type) {
      case 'total':
        setFilters(f => ({ ...f, position: 'ALL', licence: 'ALL', sidIssued: 'ALL', validationStatus: 'ALL' }));
        break;
      case 'modified':
        setFilters(f => ({
          ...f,
          validationStatus: f.validationStatus === 'MODIFIED' ? 'ALL' : 'MODIFIED',
        }));
        break;
      case 'deployed':
        setFilters(f => ({
          ...f,
          position: f.position === '1. Deployed - Active in Controller' ? 'ALL' : '1. Deployed - Active in Controller',
        }));
        break;
      case 'warehouse':
        setFilters(f => ({
          ...f,
          position: f.position === '2. Warehouse Stock' ? 'ALL' : '2. Warehouse Stock',
        }));
        break;
      case 'dormant':
        setFilters(f => ({
          ...f,
          position: f.position === '3. Installed - Dormant' ? 'ALL' : '3. Installed - Dormant',
        }));
        break;
      case 'license_expired':
        setFilters(f => ({
          ...f,
          licence: f.licence === 'EXPIRED' ? 'ALL' : 'EXPIRED',
        }));
        break;
      case 'sid_issued':
        setFilters(f => ({
          ...f,
          sidIssued: f.sidIssued === 'issued' ? 'ALL' : 'issued',
        }));
        break;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading SD-WAN inventory register...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 w-full max-w-[1760px] mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-base text-red-900">Unable to load SD-WAN Inventory</h3>
            <p className="text-sm mt-1 text-red-700">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    filters.platform !== 'ALL' ||
    filters.position !== 'ALL' ||
    filters.tenant !== 'ALL' ||
    filters.witel !== 'ALL' ||
    filters.licence !== 'ALL' ||
    filters.warehouseOwner !== 'ALL' ||
    filters.warehouseCondition !== 'ALL' ||
    filters.sidIssued !== 'ALL' ||
    filters.hasCoords !== 'ALL' ||
    filters.validationStatus !== 'ALL' ||
    Boolean(filters.search);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-full pb-16 font-sans">
      {/* 1. Header Line */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="w-full max-w-[1760px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SD-WAN Asset Inventory</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Fleet Register
              </span>
            </div>
            <p className={`text-xs mt-1 flex items-center gap-1.5 ${isStale ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
              {isStale && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
              <span>
                Inventory as of {formatInventoryDate(meta?.dataAsOf)} · {meta?.rows?.toLocaleString() ?? 9363} units
              </span>
              {isStale && (
                <span className="font-semibold text-amber-800">
                  (Feed data is stale, {daysOld} days old)
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {editsCount > 0 && (
              <button
                onClick={() => {
                  setFilters(f => ({
                    ...f,
                    validationStatus: f.validationStatus === 'MODIFIED' ? 'ALL' : 'MODIFIED',
                  }));
                  setCurrentPage(1);
                }}
                className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
                  filters.validationStatus === 'MODIFIED'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Filter by user-validated and modified records"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{editsCount} Validated / Modified</span>
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-9 px-3.5 inline-flex items-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
              title="Register a new device or inventory unit"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Device</span>
            </button>

            <button
              onClick={() => refetch()}
              disabled={refreshing}
              className="h-9 px-3.5 inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Refresh inventory from storage"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1760px] mx-auto px-6 pt-4 space-y-4">
        {error && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* 2. Single Row of Counts (KPI shortcuts from meta & firestore) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Total Units */}
          <div
            onClick={() => toggleKpiFilter('total')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.position === 'ALL' && filters.licence === 'ALL' && filters.sidIssued === 'ALL' && filters.validationStatus === 'ALL'
                ? 'border-slate-400 ring-1 ring-slate-300'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to reset position, licence, SID and validation filters"
          >
            <div className="text-[11px] font-semibold text-slate-500">Total units</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {meta?.rows?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1">Across 3 platforms</div>
          </div>

          {/* Deployed */}
          <div
            onClick={() => toggleKpiFilter('deployed')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.position === '1. Deployed - Active in Controller'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to filter by Deployed - Active in Controller"
          >
            <div className="text-[11px] font-semibold text-slate-500">Deployed</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {meta?.byPosition?.['1. Deployed - Active in Controller']?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1">Active in controller</div>
          </div>

          {/* Warehouse Stock */}
          <div
            onClick={() => toggleKpiFilter('warehouse')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.position === '2. Warehouse Stock'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to filter by Warehouse Stock"
          >
            <div className="text-[11px] font-semibold text-slate-500">Warehouse stock</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {meta?.byPosition?.['2. Warehouse Stock']?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1">DCS / DS / Digiserve</div>
          </div>

          {/* Dormant */}
          <div
            onClick={() => toggleKpiFilter('dormant')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.position === '3. Installed - Dormant'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to filter by Installed - Dormant"
          >
            <div className="text-[11px] font-semibold text-slate-500">Dormant</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {meta?.byPosition?.['3. Installed - Dormant']?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1">Installed not active</div>
          </div>

          {/* Licence Expired (highlighted in red/amber as worth acting on) */}
          <div
            onClick={() => toggleKpiFilter('license_expired')}
            className={`p-3 rounded-lg border transition cursor-pointer ${
              filters.licence === 'EXPIRED'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/30'
                : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
            }`}
            title="Click to filter by Expired Licence"
          >
            <div className="text-[11px] font-semibold text-rose-700 flex items-center justify-between">
              <span>Licence expired</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">
              {meta?.byLicence?.['EXPIRED']?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-rose-600 mt-1 font-medium">Action required</div>
          </div>

          {/* SIDs Issued */}
          <div
            onClick={() => toggleKpiFilter('sid_issued')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.sidIssued === 'issued'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to filter by SIDs issued"
          >
            <div className="text-[11px] font-semibold text-slate-500">SIDs issued</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {meta?.sidIssued?.toLocaleString() ?? '—'}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1">Registered service IDs</div>
          </div>

          {/* Validated / Modified */}
          <div
            onClick={() => toggleKpiFilter('modified')}
            className={`p-3 rounded-lg border bg-white transition cursor-pointer ${
              filters.validationStatus === 'MODIFIED'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            title="Click to filter by user-validated and modified assets"
          >
            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>Validations</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {editsCount.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-emerald-600 mt-1 font-medium">Certified / modified</div>
          </div>
        </div>

        {/* 3. Sticky Filter Bar & Instant Search */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-3 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search serial, hostname, SID, address, NKA..."
                value={filters.search}
                onChange={e => {
                  setFilters(f => ({ ...f, search: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {filters.search && (
                <button
                  onClick={() => {
                    setFilters(f => ({ ...f, search: '' }));
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              disabled={isExporting || sortedAssets.length === 0}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer ml-auto"
              title="Export all matching rows to CSV"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce text-blue-600' : 'text-slate-500'}`} />
              <span>
                {isExporting ? 'Preparing…' : `Export CSV · ${sortedAssets.length.toLocaleString()} rows`}
              </span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-8 px-2.5 inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            {/* Platform */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Platform:</span>
              <select
                value={filters.platform}
                onChange={e => {
                  setFilters(f => ({ ...f, platform: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All platforms ({meta?.rows?.toLocaleString() ?? 9363})</option>
                <option value="CISCO">CISCO ({meta?.byPlatform?.CISCO ?? 2197})</option>
                <option value="FORTINET">FORTINET ({meta?.byPlatform?.FORTINET ?? 6000})</option>
                <option value="VELO">VELO ({meta?.byPlatform?.VELO ?? 1166})</option>
              </select>
            </div>

            {/* Position */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Position:</span>
              <select
                value={filters.position}
                onChange={e => {
                  setFilters(f => ({ ...f, position: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium max-w-[210px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All positions</option>
                <option value="1. Deployed - Active in Controller">
                  1. Deployed ({meta?.byPosition?.['1. Deployed - Active in Controller']?.toLocaleString() ?? '4,510'})
                </option>
                <option value="2. Warehouse Stock">
                  2. Warehouse Stock ({meta?.byPosition?.['2. Warehouse Stock']?.toLocaleString() ?? '4,161'})
                </option>
                <option value="3. Installed - Dormant">
                  3. Installed - Dormant ({meta?.byPosition?.['3. Installed - Dormant']?.toLocaleString() ?? '446'})
                </option>
                <option value="5. FIBERSTAR">
                  5. FIBERSTAR ({meta?.byPosition?.['5. FIBERSTAR']?.toLocaleString() ?? '246'})
                </option>
              </select>
            </div>

            {/* Tenant (excluded tenant_is_location) */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Tenant:</span>
              <select
                value={filters.tenant}
                onChange={e => {
                  setFilters(f => ({ ...f, tenant: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium max-w-[190px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All tenants ({meta?.tenants ?? tenantOptions.length})</option>
                {tenantOptions.map(([tName, count]) => (
                  <option key={tName} value={tName}>
                    {tName} ({count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Witel (grouped by taxonomy: Region / Division / Witel / Not recorded) */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Region/Witel:</span>
              <select
                value={filters.witel}
                onChange={e => {
                  setFilters(f => ({ ...f, witel: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium max-w-[210px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Region / Witel</option>
                <option value="__NOT_RECORDED__">
                  Not recorded ({witelTaxonomyGroups.notRecordedCount.toLocaleString()})
                </option>
                {witelTaxonomyGroups.regions.length > 0 && (
                  <optgroup label="Regions">
                    {witelTaxonomyGroups.regions.map(([rName, count]) => (
                      <option key={rName} value={rName}>
                        {rName} ({count.toLocaleString()})
                      </option>
                    ))}
                  </optgroup>
                )}
                {witelTaxonomyGroups.divisions.length > 0 && (
                  <optgroup label="Divisions">
                    {witelTaxonomyGroups.divisions.map(([dName, count]) => (
                      <option key={dName} value={dName}>
                        {dName} ({count.toLocaleString()})
                      </option>
                    ))}
                  </optgroup>
                )}
                {witelTaxonomyGroups.witels.length > 0 && (
                  <optgroup label="Witels">
                    {witelTaxonomyGroups.witels.map(([wName, count]) => (
                      <option key={wName} value={wName}>
                        {wName} ({count.toLocaleString()})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Licence */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Licence:</span>
              <select
                value={filters.licence}
                onChange={e => {
                  setFilters(f => ({ ...f, licence: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All licences</option>
                <option value="ACTIVE">ACTIVE ({meta?.byLicence?.ACTIVE ?? 773})</option>
                <option value="EXPIRED">EXPIRED ({meta?.byLicence?.EXPIRED ?? 2197})</option>
                <option value="NEEDED">NEEDED ({meta?.byLicence?.NEEDED ?? 5})</option>
                <option value="UNKNOWN">Not recorded ({meta?.byLicence?.UNKNOWN ?? 6388})</option>
              </select>
            </div>

            {/* Warehouse Owner */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">WH Owner:</span>
              <select
                value={filters.warehouseOwner}
                onChange={e => {
                  setFilters(f => ({ ...f, warehouseOwner: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All owners</option>
                <option value="DCS">DCS</option>
                <option value="DS">DS</option>
                <option value="DIGISERVE">DIGISERVE</option>
              </select>
            </div>

            {/* Warehouse Condition */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Condition:</span>
              <select
                value={filters.warehouseCondition}
                onChange={e => {
                  setFilters(f => ({ ...f, warehouseCondition: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All conditions</option>
                <option value="BAIK">BAIK</option>
                <option value="RUSAK">RUSAK</option>
              </select>
            </div>

            {/* SID Issued */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">SID:</span>
              <select
                value={filters.sidIssued}
                onChange={e => {
                  setFilters(f => ({ ...f, sidIssued: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All SIDs</option>
                <option value="issued">SID issued ({meta?.sidIssued?.toLocaleString() ?? 2793})</option>
                <option value="not_issued">
                  Not issued ({((meta?.rows ?? 9363) - (meta?.sidIssued ?? 2793)).toLocaleString()})
                </option>
              </select>
            </div>

            {/* Has Coordinates */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Coords:</span>
              <select
                value={filters.hasCoords}
                onChange={e => {
                  setFilters(f => ({ ...f, hasCoords: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All coords</option>
                <option value="with_coords">With coords ({meta?.withCoords?.toLocaleString() ?? 2702})</option>
                <option value="no_coords">
                  No coords ({((meta?.rows ?? 9363) - (meta?.withCoords ?? 2702)).toLocaleString()})
                </option>
              </select>
            </div>

            {/* Validation / Custom Filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium text-[11px]">Validation:</span>
              <select
                value={filters.validationStatus}
                onChange={e => {
                  setFilters(f => ({ ...f, validationStatus: e.target.value }));
                  setCurrentPage(1);
                }}
                className="h-7.5 bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All records</option>
                <option value="VALIDATED">✓ Validated / Verified</option>
                <option value="MODIFIED">User modified ({editsCount})</option>
                <option value="NEEDS_REVIEW">⚠️ Needs review</option>
                <option value="PENDING">⏳ Pending check</option>
                <option value="CUSTOM_ADDED">+ Custom added</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. The Inventory Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleSort('serial_number')}
                    className="px-3.5 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      Serial
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('platform')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      Platform
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('device_model')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[140px]"
                  >
                    <div className="flex items-center gap-1">
                      Model
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hostname')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[150px]"
                  >
                    <div className="flex items-center gap-1">
                      Hostname
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('tenant_name')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[160px]"
                  >
                    <div className="flex items-center gap-1">
                      Tenant
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('position_category')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[170px]"
                  >
                    <div className="flex items-center gap-1">
                      Position
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('sid_sdwan')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      SID
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('region_witel')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[140px]"
                  >
                    <div className="flex items-center gap-1">
                      Witel / STO
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('license_norm')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      Licence
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('warehouse')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap min-w-[140px]"
                  >
                    <div className="flex items-center gap-1">
                      Warehouse
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('software_version')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      Software
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap min-w-[150px]">
                    Validation & Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-slate-500">
                      {allAssets.length === 0 ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-700">Detailed asset rows currently connecting...</p>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Summary metrics and platform breakdowns ({meta?.rows?.toLocaleString() ?? 9363} units) are active above from Firestore metadata.
                          </p>
                          <button
                            onClick={() => refetch()}
                            className="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer transition"
                          >
                            Retry Storage Sync
                          </button>
                        </div>
                      ) : (
                        'No matching assets found in register.'
                      )}
                    </td>
                  </tr>
                ) : (
                  pagedAssets.map(asset => {
                    // Tenant formatting: if tenant_is_location === 1, render '—'
                    const tenantDisplay =
                      asset.tenant_is_location === 1 || !asset.tenant_name ? '—' : asset.tenant_name;

                    // SID formatting: if sid_issued === 0, render 'not issued' (never print raw 0)
                    const sidDisplay =
                      asset.sid_issued === 0
                        ? 'not issued'
                        : asset.sid_sdwan || asset.sid_connectivity || '—';

                    // Licence formatting: UNKNOWN renders '—'
                    const licenseDisplay =
                      !asset.license_norm || asset.license_norm === 'UNKNOWN' ? '—' : asset.license_norm;

                    return (
                      <tr
                        key={asset.serial_number}
                        onClick={() => setSelectedAsset(asset)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Serial */}
                        <td className="px-3.5 py-2 font-mono font-medium text-blue-600 group-hover:text-blue-800 whitespace-nowrap">
                          {asset.serial_number}
                        </td>

                        {/* Platform */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${
                              asset.platform === 'FORTINET'
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : asset.platform === 'CISCO'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : asset.platform === 'VELO'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {asset.platform || '—'}
                          </span>
                        </td>

                        {/* Model */}
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          {asset.device_model || '—'}
                        </td>

                        {/* Hostname */}
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[180px]" title={asset.hostname}>
                          {asset.hostname || '—'}
                        </td>

                        {/* Tenant */}
                        <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[180px]" title={tenantDisplay}>
                          {tenantDisplay}
                        </td>

                        {/* Position */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              asset.position_category?.includes('Deployed')
                                ? 'bg-blue-50 text-blue-700'
                                : asset.position_category?.includes('Warehouse')
                                ? 'bg-slate-100 text-slate-700'
                                : asset.position_category?.includes('Dormant')
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {asset.position_category || '—'}
                          </span>
                        </td>

                        {/* SID (Monospace, 'not issued' when 0) */}
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {sidDisplay === 'not issued' ? (
                            <span className="text-slate-400 italic text-[11px]">not issued</span>
                          ) : sidDisplay === '—' ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className="text-slate-800 font-medium">{sidDisplay}</span>
                          )}
                        </td>

                        {/* Witel / STO */}
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {asset.region_witel || '—'}
                          {asset.sto ? (
                            <span className="text-[10px] text-slate-400 font-mono ml-1">({asset.sto})</span>
                          ) : null}
                        </td>

                        {/* Licence */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {licenseDisplay === 'EXPIRED' ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                              EXPIRED
                            </span>
                          ) : licenseDisplay === 'ACTIVE' ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                              ACTIVE
                            </span>
                          ) : licenseDisplay === 'NEEDED' ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                              NEEDED
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Warehouse */}
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {asset.warehouse || asset.warehouse_owner || '—'}
                          {asset.warehouse_condition ? (
                            <span className="text-[10px] text-slate-400 ml-1">[{asset.warehouse_condition}]</span>
                          ) : null}
                        </td>

                        {/* Software */}
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                          {asset.software_version || '—'}
                        </td>

                        {/* Validation & Edit Action */}
                        <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {asset.is_modified && (
                              asset.validation_status === 'VALIDATED' ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title={`Validated by ${asset.last_modified_by || 'User'}${asset.validation_notes ? ': ' + asset.validation_notes : ''}`}
                                >
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  Validated
                                </span>
                              ) : asset.validation_status === 'NEEDS_REVIEW' ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                                  title={`Needs review: ${asset.validation_notes || ''}`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  Review
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200"
                                  title={`Modified by ${asset.last_modified_by || 'User'}`}
                                >
                                  Modified
                                </span>
                              )
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAsset(asset);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 rounded transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Edit, fix or validate this asset"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              {sortedAssets.length === 0 ? (
                <span>0 matching units</span>
              ) : (
                <span>
                  Showing{' '}
                  <strong className="text-slate-800">
                    {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–
                    {Math.min(currentPage * PAGE_SIZE, sortedAssets.length).toLocaleString()}
                  </strong>{' '}
                  of <strong className="text-slate-800">{sortedAssets.length.toLocaleString()}</strong> matching units
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-2 font-medium">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Row Detail Slide-over Panel */}
      {selectedAsset && (
        <AssetDetailDrawer
          asset={selectedAsset}
          meta={meta}
          userEmail={userEmail}
          onClose={() => setSelectedAsset(null)}
          onSearchSerial={serial => {
            setFilters(f => ({ ...f, search: serial }));
            setSelectedAsset(null);
            setCurrentPage(1);
          }}
          onEdit={() => setEditingAsset(selectedAsset)}
          onQuickValidate={async () => {
            await saveAssetEdit(
              selectedAsset.serial_number,
              {
                validation_status: 'VALIDATED',
                validation_notes: selectedAsset.validation_notes || 'Quick certified as validated',
                validated_by: userEmail,
                validated_at: new Date().toISOString()
              },
              userEmail
            );
            setSelectedAsset(prev => prev ? {
              ...prev,
              validation_status: 'VALIDATED',
              is_modified: true,
              last_modified_by: userEmail,
              last_modified_at: new Date().toISOString()
            } : null);
            setSaveToast(`Asset ${selectedAsset.serial_number} certified as VALIDATED.`);
            setTimeout(() => setSaveToast(null), 4000);
          }}
          onRevert={selectedAsset.is_modified ? async () => {
            await revertAssetEdit(selectedAsset.serial_number);
            const original = allAssets.find(a => a.serial_number.toUpperCase() === selectedAsset.serial_number.toUpperCase());
            if (original) setSelectedAsset(original);
            setSaveToast(`Modifications reverted for ${selectedAsset.serial_number}. Restored master data.`);
            setTimeout(() => setSaveToast(null), 4000);
          } : undefined}
        />
      )}

      {/* Floating Save / Revert Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-70 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
          <button
            onClick={() => setSaveToast(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Edit Existing Asset Modal */}
      {editingAsset && (
        <AssetEditModal
          isOpen={!!editingAsset}
          asset={editingAsset}
          mode="edit"
          userEmail={userEmail}
          onClose={() => setEditingAsset(null)}
          onSave={async (serial, updates) => {
            await saveAssetEdit(serial, updates, userEmail);
            setSaveToast(`Asset ${serial} updated and validated successfully.`);
            setTimeout(() => setSaveToast(null), 4000);
            if (selectedAsset && selectedAsset.serial_number.toUpperCase() === serial.toUpperCase()) {
              setSelectedAsset(prev => prev ? { ...prev, ...updates, is_modified: true } : null);
            }
          }}
          onRevert={async (serial) => {
            await revertAssetEdit(serial);
            setSaveToast(`Modifications reverted for ${serial}. Restored master data.`);
            setTimeout(() => setSaveToast(null), 4000);
            if (selectedAsset && selectedAsset.serial_number.toUpperCase() === serial.toUpperCase()) {
              const original = allAssets.find(a => a.serial_number.toUpperCase() === serial.toUpperCase());
              if (original) setSelectedAsset(original);
            }
          }}
        />
      )}

      {/* Add New Custom Asset Modal */}
      {isAddModalOpen && (
        <AssetEditModal
          isOpen={isAddModalOpen}
          asset={null}
          mode="create"
          userEmail={userEmail}
          onClose={() => setIsAddModalOpen(false)}
          onSave={async (serial, updates) => {
            await addCustomAsset({ serial_number: serial, ...updates } as AssetItem, userEmail);
            setSaveToast(`New asset ${serial} created and registered in inventory.`);
            setTimeout(() => setSaveToast(null), 4000);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Asset Detail Drawer Component (Side Panel)
// ------------------------------------------------------------------------------------------------

interface AssetDetailDrawerProps {
  asset: AssetItem;
  meta?: any;
  userEmail: string;
  onClose: () => void;
  onSearchSerial: (serial: string) => void;
  onEdit: () => void;
  onQuickValidate?: () => void;
  onRevert?: () => void;
}

function AssetDetailDrawer({
  asset,
  meta,
  userEmail,
  onClose,
  onSearchSerial,
  onEdit,
  onQuickValidate,
  onRevert
}: AssetDetailDrawerProps) {
  // Check usable coordinates rule: Only use coordinates when has_coords is 1
  const coordsUsable = asset.has_coords === 1 && asset.latitude && asset.longitude;
  const hasPlaceholderCoords = asset.has_coords === 0 && (asset.latitude || asset.longitude);

  // Group 1: Identity
  const identityFields = [
    { label: 'Serial Number', value: asset.serial_number, mono: true, copyable: true },
    { label: 'Platform', value: asset.platform },
    { label: 'Device Model', value: asset.device_model },
    { label: 'Hostname', value: asset.hostname, mono: true },
  ].filter(f => f.value);

  // Group 2: Service
  const tenantDisplay = asset.tenant_is_location === 1 ? null : asset.tenant_name;
  const sidSdwanDisplay = asset.sid_issued === 0 ? 'not issued' : asset.sid_sdwan;
  const sidConnDisplay = asset.sid_issued === 0 ? 'not issued' : asset.sid_connectivity;
  const sidStatus = asset.sid_issued === 1 ? 'Issued' : asset.sid_issued === 0 ? 'Not issued' : null;

  const serviceFields = [
    { label: 'Tenant Name', value: tenantDisplay },
    { label: 'SID SD-WAN', value: sidSdwanDisplay, mono: true },
    { label: 'SID Connectivity', value: sidConnDisplay, mono: true },
    { label: 'SID Registration', value: sidStatus },
  ].filter(f => f.value);

  // Group 3: Status
  const statusFields = [
    { label: 'Position Category', value: asset.position_category },
    { label: 'Warehouse Name', value: asset.warehouse },
    { label: 'Warehouse Owner', value: asset.warehouse_owner },
    { label: 'Warehouse Condition', value: asset.warehouse_condition },
  ].filter(f => f.value);

  // Group 4: Location
  const locationFields = [
    { label: 'Location Address', value: asset.location_address },
    { label: 'STO Code', value: asset.sto, mono: true },
    { label: 'Region / Witel', value: asset.region_witel },
    { label: 'Witel Taxonomy', value: asset.witel_taxonomy },
  ].filter(f => f.value);

  // Group 5: Procurement
  const procurementFields = [
    { label: 'No. Kontrak', value: asset.no_kontrak },
    { label: 'Nama Pengadaan', value: asset.nama_pengadaan },
    { label: 'Kode Kontrak', value: asset.kode_kontrak, mono: true },
    { label: 'NKA', value: asset.nka, mono: true },
  ].filter(f => f.value);

  // Group 6: Asset
  const assetFields = [
    { label: 'Acquisition Value (Per Unit)', value: formatRupiah(asset.acq_value_per_unit) },
  ].filter(f => f.value && f.value !== '—');

  // Group 7: Licence
  const licenseNormDisplay =
    asset.license_norm && asset.license_norm !== 'UNKNOWN' ? asset.license_norm : null;
  const licenceFields = [
    { label: 'License Status', value: asset.license_status },
    { label: 'License Norm', value: licenseNormDisplay },
  ].filter(f => f.value);

  // Group 8: Network
  const networkFields = [
    { label: 'System IP', value: asset.system_ip, mono: true },
    { label: 'Logical ID', value: asset.logical_id, mono: true },
    { label: 'Software Version', value: asset.software_version, mono: true },
    { label: 'IP WAN Public', value: asset.ip_wan_public, mono: true },
  ].filter(f => f.value);

  // Group 9: Lineage
  const lineageFields = [
    { label: 'Replaces Serial', value: asset.replaces_serial, mono: true, isSerialLink: true },
  ].filter(f => f.value);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    asset.platform === 'FORTINET'
                      ? 'bg-orange-100 text-orange-800 border border-orange-200'
                      : asset.platform === 'CISCO'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {asset.platform || 'SD-WAN'}
                </span>
                <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {asset.serial_number}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {asset.device_model || 'SD-WAN Edge'} {asset.hostname ? `· ${asset.hostname}` : ''}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Edit, fix or modify data for this device"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit / Fix Data</span>
            </button>
            {asset.validation_status !== 'VALIDATED' && onQuickValidate && (
              <button
                onClick={onQuickValidate}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Mark this device as verified and validated"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Certify Validated</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-xs">
          {/* Validation & Verification Audit Card if modified */}
          {asset.is_modified && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    Live Modification & Validation Record
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                    asset.validation_status === 'VALIDATED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : asset.validation_status === 'NEEDS_REVIEW'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                  }`}
                >
                  {asset.validation_status === 'VALIDATED' ? '✓ VALIDATED' : asset.validation_status || 'MODIFIED'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>
                  Certified / Modified by: <strong className="text-slate-800">{asset.last_modified_by || 'User'}</strong>
                </div>
                {asset.last_modified_at && (
                  <div>
                    Timestamp: <strong className="text-slate-800">{new Date(asset.last_modified_at).toLocaleString()}</strong>
                  </div>
                )}
                {asset.validation_notes && (
                  <div className="bg-white/90 p-2 rounded-lg border border-amber-200 text-slate-700 italic mt-1">
                    "{asset.validation_notes}"
                  </div>
                )}
              </div>
              {onRevert && (
                <div className="pt-2 border-t border-amber-200/60 flex justify-end">
                  <button
                    onClick={onRevert}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Revert to original master data</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. Identity */}
          {identityFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-blue-800">
                <Server className="w-3.5 h-3.5" />
                Identity
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {identityFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className={`font-semibold text-slate-800 ${f.mono ? 'font-mono' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Service */}
          {serviceFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <Building2 className="w-3.5 h-3.5" />
                Service
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {serviceFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className={`font-semibold text-slate-800 ${f.mono ? 'font-mono' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Status */}
          {statusFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <Radio className="w-3.5 h-3.5" />
                Status
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {statusFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className="font-semibold text-slate-800">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Location */}
          {(locationFields.length > 0 || coordsUsable || hasPlaceholderCoords) && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <MapPin className="w-3.5 h-3.5" />
                Location
              </h3>
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {locationFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className={`font-semibold text-slate-800 ${f.mono ? 'font-mono' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}

                {/* Coordinates handling */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[11px]">GPS Coordinates</span>
                  {coordsUsable ? (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-semibold text-slate-800">
                        {asset.latitude}, {asset.longitude}
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${asset.latitude},${asset.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View map</span>
                      </a>
                    </div>
                  ) : hasPlaceholderCoords ? (
                    <span className="text-amber-700 italic font-medium">coordinates not usable (placeholder)</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Procurement */}
          {procurementFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Procurement
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {procurementFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className={`font-semibold text-slate-800 ${f.mono ? 'font-mono' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Asset */}
          {assetFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <Tag className="w-3.5 h-3.5" />
                Asset Value
              </h3>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {assetFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className="font-bold text-emerald-700 text-sm">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Licence */}
          {licenceFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <Key className="w-3.5 h-3.5" />
                Licence
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {licenceFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className="font-semibold text-slate-800">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Network */}
          {networkFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <HardDrive className="w-3.5 h-3.5" />
                Network Identity
              </h3>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {networkFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <span className={`font-semibold text-slate-800 ${f.mono ? 'font-mono' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. Lineage */}
          {lineageFields.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-slate-800">
                <Clock className="w-3.5 h-3.5" />
                Lineage
              </h3>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                {lineageFields.map((f, i) => (
                  <div key={i}>
                    <span className="text-slate-400 block text-[11px]">{f.label}</span>
                    <button
                      onClick={() => onSearchSerial(String(f.value))}
                      className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {f.value} → search this serial
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Note from meta */}
          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 italic">
            Note: {meta?.omittedReason || 'Personal contact data is served only inside the network.'}
          </div>
        </div>
      </div>
    </div>
  );
}
