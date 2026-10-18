import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Tag,
  Search,
  Download,
  PlusCircle,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowUpDown,
  Upload,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  QrCode,
  FileText,
  AlertCircle,
  HelpCircle,
  Layers,
  RotateCw,
  Loader2,
  Image as ImageIcon,
  Archive,
  CheckSquare,
  Square,
  Trash2
} from 'lucide-react';
import { useTraceRegistry } from '../hooks/useTraceRegistry';
import { useInventoryData } from '../hooks/useInventoryData';
import PhysicalStickerPreview from './PhysicalStickerPreview';
import { downloadStandardLabelExcelTemplate } from '../utils/templateGenerator';
import {
  exportStickerSheetsToPdf,
  downloadElementAsPng,
  downloadSvgFile,
  downloadQrCodesZip
} from '../utils/pdfExport';
import {
  TraceMapping,
  IssueCandidate,
  PrintQueueItem,
  ExcelSheetInfo,
  KnownField,
  ColumnMapping,
  ExcelParsedRow
} from '../types/trace';
import {
  buildTraceRegistryCsv,
  triggerCsvDownload,
  detectHeaderRow,
  exportExcelWorkbook,
  generateAndVerifyQrSvg
} from '../utils/traceUtils';

interface LabelTraceViewProps {
  user?: any;
}

export default function LabelTraceView({ user }: LabelTraceViewProps) {
  const {
    mappings,
    loading: registryLoading,
    error: registryError,
    activeTraceByHostname,
    traceById,
    issueSingleTrace,
    batchIssueTraceLabels,
    updateTraceLabel,
    markAsPrinted,
    voidTraceLabel,
    deleteSingleTraceLabel,
    batchDeleteTraceLabels,
  } = useTraceRegistry();

  const { data: inventoryData, loading: inventoryLoading } = useInventoryData();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<'registry' | 'issue' | 'print'>('registry');

  // Sub-tab under Registry: 'issued' (Tracked Labels Registry) | 'inventory' (Master Asset Register)
  const [registrySubTab, setRegistrySubTab] = useState<'inventory' | 'issued'>('issued');

  // Master Inventory Asset search & filters
  const [invSearch, setInvSearch] = useState<string>('');
  const [invWitel, setInvWitel] = useState<string>('ALL');
  const [invPlatform, setInvPlatform] = useState<string>('ALL');
  const [invIssuedFilter, setInvIssuedFilter] = useState<'ALL' | 'ISSUED' | 'NOT_ISSUED'>('ALL');
  const [invPage, setInvPage] = useState<number>(1);
  const [selectedAssetHostnames, setSelectedAssetHostnames] = useState<Set<string>>(new Set());

  // Step d selected row for live sticker preview
  const [previewRow, setPreviewRow] = useState<ExcelParsedRow | null>(null);

  // Standard Telkom procurement contract fallback if absent in workbook
  const [defaultPengadaan, setDefaultPengadaan] = useState<string>(
    'K.TEL.000882/HK.810/GPP-000000/2026'
  );

  // Auto-update existing metadata option on re-upload
  const [autoUpdateExisting, setAutoUpdateExisting] = useState<boolean>(true);

  // Print Queue state
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [printStartPos, setPrintStartPos] = useState<number>(1); // 1-21
  const [groupByKota, setGroupByKota] = useState<boolean>(true);
  const [isMarkingPrinted, setIsMarkingPrinted] = useState<boolean>(false);
  const [isExportingSheetPdf, setIsExportingSheetPdf] = useState<boolean>(false);
  const [sheetPdfProgress, setSheetPdfProgress] = useState<{ current: number; total: number } | null>(null);

  // Detail Modal state
  const [selectedMapping, setSelectedMapping] = useState<TraceMapping | null>(null);
  const [isVoiding, setIsVoiding] = useState<boolean>(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState<boolean>(false);

  // Tracked Labels Registry Selection & Bulk Actions
  const [selectedTraceIds, setSelectedTraceIds] = useState<Set<string>>(new Set());
  const [isZippingQr, setIsZippingQr] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkQueueLoading, setBulkQueueLoading] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'single' | 'selected' | 'filtered';
    traceIds: string[];
    title: string;
    sampleItems: { trace: string; hostname: string; customer?: string }[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  // ------------------------------------------------------------------------------------------------
  // INVENTORY LOOKUPS (SERIAL FIRST, THEN HOSTNAME)
  // ------------------------------------------------------------------------------------------------
  const inventoryBySerial = useMemo(() => {
    const map = new Map<string, any>();
    if (inventoryData?.assets) {
      for (const item of inventoryData.assets) {
        if (item.serial_number) {
          map.set(item.serial_number.toUpperCase().trim(), {
            ...item,
            serial: item.serial_number,
            tenant: item.tenant_canonical || item.tenant_name || '',
            kota: item.witel_norm || item.region_witel || '',
            pengadaan: item.nama_pengadaan || '',
            orderNumber: item.sid_sdwan ? String(item.sid_sdwan) : '',
            siteCode: item.sto || '',
            siteName: item.location_address || '',
          });
        }
      }
    }
    return map;
  }, [inventoryData?.assets]);

  const inventoryByHostname = useMemo(() => {
    const map = new Map<string, any>();
    if (inventoryData?.assets) {
      for (const item of inventoryData.assets) {
        if (item.hostname) {
          map.set(item.hostname.toUpperCase().trim(), {
            ...item,
            serial: item.serial_number,
            tenant: item.tenant_canonical || item.tenant_name || '',
            kota: item.witel_norm || item.region_witel || '',
            pengadaan: item.nama_pengadaan || '',
            orderNumber: item.sid_sdwan ? String(item.sid_sdwan) : '',
            siteCode: item.sto || '',
            siteName: item.location_address || '',
          });
        }
      }
    }
    return map;
  }, [inventoryData?.assets]);

  // Enrich mappings with inventory presence
  const enrichedMappings = useMemo(() => {
    return mappings.map((m) => {
      let match = m.serial ? inventoryBySerial.get(m.serial.toUpperCase().trim()) : null;
      if (!match && m.hostname) {
        match = inventoryByHostname.get(m.hostname.toUpperCase().trim());
      }
      return {
        ...m,
        inInventory: !!match,
      };
    });
  }, [mappings, inventoryBySerial, inventoryByHostname]);

  // ------------------------------------------------------------------------------------------------
  // REGISTRY TAB
  // ------------------------------------------------------------------------------------------------
  const [regSearch, setRegSearch] = useState<string>('');
  const [regCustomer, setRegCustomer] = useState<string>('ALL');
  const [regCampaign, setRegCampaign] = useState<string>('ALL');
  const [regKota, setRegKota] = useState<string>('ALL');
  const [regStatus, setRegStatus] = useState<string>('ALL');
  const [regMatchFilter, setRegMatchFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [regSortField, setRegSortField] = useState<keyof TraceMapping>('trace');
  const [regSortAsc, setRegSortAsc] = useState<boolean>(true);
  const [regPage, setRegPage] = useState<number>(1);
  const pageSize = 100;

  const filterOptions = useMemo(() => {
    const customers = new Set<string>();
    const campaigns = new Set<string>();
    const kotas = new Set<string>();

    for (const m of mappings) {
      if (m.customer) customers.add(m.customer);
      if (m.campaign) campaigns.add(m.campaign);
      if (m.kota) kotas.add(m.kota);
    }

    return {
      customers: Array.from(customers).sort(),
      campaigns: Array.from(campaigns).sort(),
      kotas: Array.from(kotas).sort(),
    };
  }, [mappings]);

  const filteredMappings = useMemo(() => {
    let q = regSearch.trim().toLowerCase();
    if (q.startsWith('tlk-')) {
      q = q.substring(4);
    }

    return enrichedMappings.filter((m) => {
      if (regCustomer !== 'ALL' && m.customer !== regCustomer) return false;
      if (regCampaign !== 'ALL' && m.campaign !== regCampaign) return false;
      if (regKota !== 'ALL' && m.kota !== regKota) return false;
      if (regStatus !== 'ALL' && m.status !== regStatus) return false;
      if (regMatchFilter === 'YES' && !m.inInventory) return false;
      if (regMatchFilter === 'NO' && m.inInventory) return false;

      if (q) {
        const traceCode = m.trace.toLowerCase().replace('tlk-', '');
        const matchTrace = traceCode.includes(q) || m.trace.toLowerCase().includes(q);
        const matchHost = m.hostname.toLowerCase().includes(q);
        const matchKota = m.kota.toLowerCase().includes(q);
        const matchOrder = m.orderNumber.toLowerCase().includes(q);
        const matchSerial = m.serial ? m.serial.toLowerCase().includes(q) : false;
        const matchSiteCode = m.siteCode ? m.siteCode.toLowerCase().includes(q) : false;
        const matchSiteName = m.siteName ? m.siteName.toLowerCase().includes(q) : false;

        if (
          !matchTrace &&
          !matchHost &&
          !matchKota &&
          !matchOrder &&
          !matchSerial &&
          !matchSiteCode &&
          !matchSiteName
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    enrichedMappings,
    regSearch,
    regCustomer,
    regCampaign,
    regKota,
    regStatus,
    regMatchFilter,
  ]);

  const sortedMappings = useMemo(() => {
    return [...filteredMappings].sort((a, b) => {
      let valA: any = a[regSortField];
      let valB: any = b[regSortField];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(String(valB));
        return regSortAsc ? comp : -comp;
      }
      return regSortAsc ? valA - valB : valB - valA;
    });
  }, [filteredMappings, regSortField, regSortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedMappings.length / pageSize));
  const currentPageMappings = useMemo(() => {
    const start = (regPage - 1) * pageSize;
    return sortedMappings.slice(start, start + pageSize);
  }, [sortedMappings, regPage]);

  const handleRegSort = (field: keyof TraceMapping) => {
    if (regSortField === field) {
      setRegSortAsc(!regSortAsc);
    } else {
      setRegSortField(field);
      setRegSortAsc(true);
    }
    setRegPage(1);
  };

  const handleExportRegistryCsv = () => {
    const csv = buildTraceRegistryCsv(sortedMappings);
    const filename = `trace_mappings_export_${new Date().toISOString().substring(0, 10)}.csv`;
    triggerCsvDownload(csv, filename);
  };

  // Selection helpers for Tracked Labels Registry
  const allFilteredTraceIds = useMemo(() => sortedMappings.map((m) => m.trace), [sortedMappings]);
  const currentPageTraceIds = useMemo(() => currentPageMappings.map((m) => m.trace), [currentPageMappings]);
  
  const isAllFilteredSelected = useMemo(() => {
    if (allFilteredTraceIds.length === 0) return false;
    return allFilteredTraceIds.every((id) => selectedTraceIds.has(id));
  }, [allFilteredTraceIds, selectedTraceIds]);

  const isCurrentPageAllSelected = useMemo(() => {
    if (currentPageTraceIds.length === 0) return false;
    return currentPageTraceIds.every((id) => selectedTraceIds.has(id));
  }, [currentPageTraceIds, selectedTraceIds]);

  const toggleSelectCurrentPage = () => {
    if (isCurrentPageAllSelected) {
      setSelectedTraceIds((prev) => {
        const next = new Set(prev);
        currentPageTraceIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedTraceIds((prev) => {
        const next = new Set(prev);
        currentPageTraceIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedTraceIds(new Set(allFilteredTraceIds));
  };

  const clearSelection = () => {
    setSelectedTraceIds(new Set());
  };

  const toggleSelectTrace = (traceId: string) => {
    setSelectedTraceIds((prev) => {
      const next = new Set(prev);
      if (next.has(traceId)) {
        next.delete(traceId);
      } else {
        next.add(traceId);
      }
      return next;
    });
  };

  const handleBulkDownloadQrZip = async (scope: 'selected' | 'campaign' | 'all') => {
    let targetMappings: TraceMapping[] = [];
    let zipName = 'Telkom_QR_Labels.zip';

    if (scope === 'selected') {
      if (selectedTraceIds.size === 0) {
        alert('Please select at least one label using the checkboxes.');
        return;
      }
      targetMappings = mappings.filter((m) => selectedTraceIds.has(m.trace));
      zipName = `Telkom_QR_Selected_${targetMappings.length}_Labels.zip`;
    } else if (scope === 'campaign') {
      targetMappings = sortedMappings;
      const campaignName = regCampaign !== 'ALL' ? regCampaign : 'Filtered';
      zipName = `Telkom_QR_Campaign_${campaignName}_${targetMappings.length}_Labels.zip`;
    } else {
      targetMappings = mappings;
      zipName = `Telkom_QR_All_${targetMappings.length}_Labels.zip`;
    }

    if (targetMappings.length === 0) {
      alert('No labels found to download.');
      return;
    }

    setIsZippingQr(true);
    try {
      await downloadQrCodesZip(
        targetMappings.map((m) => ({ trace: m.trace, hostname: m.hostname })),
        zipName,
        (current, total) => setZipProgress({ current, total })
      );
    } catch (err: any) {
      console.error('Failed to create QR zip:', err);
      alert('Failed to create QR ZIP: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsZippingQr(false);
      setZipProgress(null);
    }
  };

  const handleBulkAddToQueue = async (scope: 'selected' | 'campaign' | 'all') => {
    let targetMappings: TraceMapping[] = [];
    if (scope === 'selected') {
      if (selectedTraceIds.size === 0) {
        alert('Please select at least one label using the checkboxes.');
        return;
      }
      targetMappings = mappings.filter((m) => selectedTraceIds.has(m.trace));
    } else if (scope === 'campaign') {
      targetMappings = sortedMappings;
    } else {
      targetMappings = mappings;
    }

    if (targetMappings.length === 0) {
      alert('No labels found to add to queue.');
      return;
    }

    setBulkQueueLoading(true);
    try {
      await handleAddMultipleToPrintQueue(targetMappings);
      setActiveTab('print');
    } catch (err: any) {
      console.error('Failed to add to print queue:', err);
      alert('Failed to add to print queue: ' + (err?.message || 'Unknown error'));
    } finally {
      setBulkQueueLoading(false);
    }
  };

  // ------------------------------------------------------------------------------------------------
  // DELETE LABEL DATA HANDLERS (SINGLE, SELECTED, FILTERED)
  // ------------------------------------------------------------------------------------------------
  const handleDeleteSingle = (mapping: TraceMapping) => {
    setDeleteTarget({
      type: 'single',
      traceIds: [mapping.trace],
      title: `Delete Label: ${mapping.trace}`,
      sampleItems: [{ trace: mapping.trace, hostname: mapping.hostname, customer: mapping.customer }],
    });
  };

  const handleDeleteSelected = () => {
    if (selectedTraceIds.size === 0) {
      alert('Please select at least one label using the checkboxes first.');
      return;
    }
    const targetMappings = mappings.filter((m) => selectedTraceIds.has(m.trace));
    setDeleteTarget({
      type: 'selected',
      traceIds: Array.from(selectedTraceIds),
      title: `Delete ${selectedTraceIds.size} Selected Label(s)`,
      sampleItems: targetMappings.slice(0, 5).map((m) => ({
        trace: m.trace,
        hostname: m.hostname,
        customer: m.customer,
      })),
    });
  };

  const handleDeleteFiltered = () => {
    if (sortedMappings.length === 0) {
      alert('No labels match the current filter to delete.');
      return;
    }
    setDeleteTarget({
      type: 'filtered',
      traceIds: sortedMappings.map((m) => m.trace),
      title: `Delete All ${sortedMappings.length} Filtered Label(s)`,
      sampleItems: sortedMappings.slice(0, 5).map((m) => ({
        trace: m.trace,
        hostname: m.hostname,
        customer: m.customer,
      })),
    });
  };

  const confirmExecuteDelete = async () => {
    if (!deleteTarget || deleteTarget.traceIds.length === 0) return;
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: deleteTarget.traceIds.length });
    try {
      const deletedIds = new Set(deleteTarget.traceIds);
      const res = await batchDeleteTraceLabels(deleteTarget.traceIds, (current, total) => {
        setDeleteProgress({ current, total });
      });

      // Clean up selectedTraceIds
      setSelectedTraceIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });

      // Clean up printQueue if any were queued
      setPrintQueue((prev) => prev.filter((item) => !deletedIds.has(item.trace)));

      // Close detail modal if the open item was deleted
      if (selectedMapping && deletedIds.has(selectedMapping.trace)) {
        setSelectedMapping(null);
      }

      const count = res.deletedCount || deleteTarget.traceIds.length;
      setDeleteSuccessMessage(`Successfully deleted ${count} label(s) from cloud database.`);
      setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 4500);

      setDeleteTarget(null);
    } catch (err: any) {
      alert('Failed to delete label records: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
      setDeleteProgress(null);
    }
  };

  // Master Inventory calculations and lookups
  const allInventoryAssets = useMemo(() => inventoryData?.assets || [], [inventoryData?.assets]);

  const inventoryWitels = useMemo(() => {
    const set = new Set<string>();
    for (const a of allInventoryAssets) {
      const w = a.witel_norm || a.region_witel;
      if (w) set.add(w);
    }
    return Array.from(set).sort();
  }, [allInventoryAssets]);

  const filteredInventoryAssets = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    return allInventoryAssets.filter((a) => {
      if (invWitel !== 'ALL' && a.witel_norm !== invWitel && a.region_witel !== invWitel) return false;
      if (invPlatform !== 'ALL' && a.platform !== invPlatform) return false;
      const hasLabel = !!activeTraceByHostname.get((a.hostname || '').toUpperCase().trim());
      if (invIssuedFilter === 'ISSUED' && !hasLabel) return false;
      if (invIssuedFilter === 'NOT_ISSUED' && hasLabel) return false;

      if (q) {
        const matchHost = (a.hostname || '').toLowerCase().includes(q);
        const matchSerial = (a.serial_number || '').toLowerCase().includes(q);
        const matchSid = a.sid_sdwan ? String(a.sid_sdwan).toLowerCase().includes(q) : false;
        const matchWitel = (a.witel_norm || a.region_witel || '').toLowerCase().includes(q);
        const matchTenant = (a.tenant_name || a.tenant_canonical || '').toLowerCase().includes(q);
        if (!matchHost && !matchSerial && !matchSid && !matchWitel && !matchTenant) return false;
      }
      return true;
    });
  }, [allInventoryAssets, invSearch, invWitel, invPlatform, invIssuedFilter, activeTraceByHostname]);

  const invPageSize = 25;
  const totalInvPages = Math.max(1, Math.ceil(filteredInventoryAssets.length / invPageSize));
  const currentInvAssets = useMemo(() => {
    const start = (invPage - 1) * invPageSize;
    return filteredInventoryAssets.slice(start, start + invPageSize);
  }, [filteredInventoryAssets, invPage]);

  // Add single item to print queue (replaces existing entry with fresh verified QR & layout)
  const handleAddToPrintQueue = async (item: TraceMapping) => {
    const qrResult = await generateAndVerifyQrSvg(item.trace);
    const queueItem: PrintQueueItem = {
      ...item,
      queueId: `${item.trace}-${Date.now()}`,
      qrSvg: qrResult.svg,
      qrVerified: qrResult.verified,
    };
    setPrintQueue((prev) => {
      const idx = prev.findIndex((p) => p.trace === item.trace);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = queueItem;
        return copy;
      }
      return [...prev, queueItem];
    });
  };

  // Add multiple items to print queue with verified QR codes (updates existing)
  const handleAddMultipleToPrintQueue = async (items: TraceMapping[]) => {
    const toAdd: PrintQueueItem[] = [];
    for (const item of items) {
      const qrResult = await generateAndVerifyQrSvg(item.trace);
      toAdd.push({
        ...item,
        queueId: `${item.trace}-${Date.now()}-${Math.random()}`,
        qrSvg: qrResult.svg,
        qrVerified: qrResult.verified,
      });
    }

    setPrintQueue((prev) => {
      const newItemsMap = new Map(toAdd.map((item) => [item.trace, item]));
      const updatedPrev = prev.map((p) => newItemsMap.get(p.trace) || p);
      const prevTraces = new Set(prev.map((p) => p.trace));
      const brandNew = toAdd.filter((item) => !prevTraces.has(item.trace));
      return [...updatedPrev, ...brandNew];
    });
  };

  // Issue & print a label directly from the Master Inventory register
  const handleIssueAssetFromInventory = async (asset: any) => {
    if (!asset.hostname) return;
    const hostKey = asset.hostname.toUpperCase().trim();
    const existing = activeTraceByHostname.get(hostKey);
    if (existing) {
      await handleAddToPrintQueue(existing);
      setActiveTab('print');
      return;
    }

    if (!user?.email) {
      alert('Authentication required: Please sign in to issue Trace IDs.');
      return;
    }

    try {
      const candidate: IssueCandidate = {
        hostname: asset.hostname,
        orderNumber: asset.sid_sdwan ? String(asset.sid_sdwan) : `ORD-${asset.hostname.substring(0, 8)}`,
        kota: asset.witel_norm || asset.region_witel || 'INDONESIA',
        pengadaan: asset.nama_pengadaan || 'K.TEL.000882/HK.810/GPP-000000/2026',
        serial: asset.serial_number || '',
        siteCode: asset.sto || '',
        siteName: asset.location_address || '',
        sid: asset.sid_sdwan ? String(asset.sid_sdwan) : '',
        inInventory: true,
      };

      const issued = await issueSingleTrace(
        candidate,
        'Direct Registry Issue',
        asset.tenant_name || asset.tenant_canonical || 'TELKOM SD-WAN',
        user.email
      );

      await handleAddToPrintQueue(issued);
      setActiveTab('print');
    } catch (err: any) {
      alert('Failed to issue label: ' + (err.message || 'Unknown error'));
    }
  };

  // Batch issue & print selected items from Master Inventory
  const handleBatchIssueSelectedInventory = async () => {
    if (selectedAssetHostnames.size === 0) return;
    if (!user?.email) {
      alert('Authentication required: Please sign in to issue Trace IDs.');
      return;
    }

    const selectedAssets = allInventoryAssets.filter((a) =>
      selectedAssetHostnames.has((a.hostname || '').toUpperCase().trim())
    );

    const candidatesToIssue: IssueCandidate[] = [];
    const alreadyIssuedMappings: TraceMapping[] = [];

    for (const a of selectedAssets) {
      const hostKey = (a.hostname || '').toUpperCase().trim();
      const existing = activeTraceByHostname.get(hostKey);
      if (existing) {
        alreadyIssuedMappings.push(existing);
      } else {
        candidatesToIssue.push({
          hostname: a.hostname,
          orderNumber: a.sid_sdwan ? String(a.sid_sdwan) : `ORD-${a.hostname.substring(0, 8)}`,
          kota: a.witel_norm || a.region_witel || 'INDONESIA',
          pengadaan: a.nama_pengadaan || 'K.TEL.000882/HK.810/GPP-000000/2026',
          serial: a.serial_number || '',
          siteCode: a.sto || '',
          siteName: a.location_address || '',
          sid: a.sid_sdwan ? String(a.sid_sdwan) : '',
          inInventory: true,
        });
      }
    }

    try {
      let newlyIssued: TraceMapping[] = [];
      if (candidatesToIssue.length > 0) {
        const res = await batchIssueTraceLabels(
          candidatesToIssue,
          'Master Inventory Batch',
          'TELKOM SD-WAN',
          user.email
        );
        newlyIssued = res.success;
      }

      await handleAddMultipleToPrintQueue([...newlyIssued, ...alreadyIssuedMappings]);
      setSelectedAssetHostnames(new Set());
      setActiveTab('print');
    } catch (err: any) {
      alert('Batch issue error: ' + (err.message || 'Unknown error'));
    }
  };

  // Print sheet execution with verification & physical dimension self-check
  const handlePrintSheet = () => {
    // 1. Verify all items in queue have verified QR codes
    const unverified = printQueue.filter((p) => !p.qrVerified);
    if (unverified.length > 0) {
      alert(`Cannot print: ${unverified.length} label(s) failed QR round-trip decode verification.`);
      return;
    }

    // 2. Measure rendered QR element in the DOM
    const qrElement = document.querySelector('.label-qr-box') as HTMLElement;
    if (qrElement) {
      const rect = qrElement.getBoundingClientRect();
      // At standard 96 DPI: 1 mm = 3.779528 px
      const pxPerMm = 96 / 25.4;
      const measuredMm = rect.width / pxPerMm;

      if (measuredMm < 19.0) {
        alert(
          `WARNING: The rendered QR code element measures only ${measuredMm.toFixed(1)} mm (expected 20.5 mm, minimum 19.0 mm).\n\n` +
          `A shrunk QR code may fail scanning on physical stickers.\n` +
          `Please set browser zoom to 100% and choose "Actual size" (100%) in the print dialog.`
        );
        return;
      }
    }

    window.print();
  };

  const handleDownloadStickerSheetsPdf = async () => {
    if (printPages.length === 0) return;
    setIsExportingSheetPdf(true);
    try {
      const sheetElements = Array.from(document.querySelectorAll<HTMLElement>('.a4-sheet'));
      if (sheetElements.length === 0) {
        alert('No sticker sheet elements found in DOM to export.');
        return;
      }
      const pageCount = printPages.length;
      await exportStickerSheetsToPdf(
        sheetElements,
        `Telkom_SDWAN_Stickers_${pageCount}_Sheet${pageCount !== 1 ? 's' : ''}.pdf`,
        (current, total) => setSheetPdfProgress({ current, total })
      );
    } catch (err: any) {
      console.error('Failed to export sticker sheets PDF:', err);
      alert('Failed to generate sticker PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExportingSheetPdf(false);
      setSheetPdfProgress(null);
    }
  };

  // ------------------------------------------------------------------------------------------------
  // TAB 2: ISSUE (UPLOAD EXCEL WORKBOOK — THE MAIN WORKFLOW)
  // ------------------------------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sheetList, setSheetList] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Step b & c states
  const [rawSheetData, setRawSheetData] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0); // 0-indexed
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
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
  });
  const [ignoredColumnsCount, setIgnoredColumnsCount] = useState<number>(0);

  // Step d states
  const [parsedRows, setParsedRows] = useState<ExcelParsedRow[]>([]);
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  // Step e states
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [campaignInput, setCampaignInput] = useState<string>('');
  const [customerInput, setCustomerInput] = useState<string>('INDOMARET');
  const [isProcessingIssue, setIsProcessingIssue] = useState<boolean>(false);
  const [issueProgress, setIssueProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  // Post-issue results & files ready to download
  const [issuedResultSummary, setIssuedResultSummary] = useState<{
    newIssuedCount: number;
    reprintCount: number;
    unprintableCount: number;
    campaign: string;
    printableRows: ExcelParsedRow[];
    unprintableRows: ExcelParsedRow[];
  } | null>(null);

  // Handle client-side file selection
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFile(e.target.files[0]);
    }
  };

  // Pure browser-side parsing using XLSX (never uploaded anywhere!)
  const processIncomingFile = (file: File) => {
    // Constrain file extension: accept only .xlsx, .xls, .csv
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      alert('Format berkas tidak didukung. Harap unggah berkas spreadsheet .xlsx, .xls, atau .csv.');
      return;
    }

    // Cap file size (15MB)
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert('Ukuran berkas melebihi batas maksimal 15MB.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);

        const sheets: ExcelSheetInfo[] = [];
        let maxRows = -1;
        let defaultSheet = wb.SheetNames[0] || '';

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
          const rowCount = range.e.r - range.s.r + 1;
          sheets.push({ name: sheetName, rowCount });
          if (rowCount > maxRows) {
            maxRows = rowCount;
            defaultSheet = sheetName;
          }
        });

        setSheetList(sheets);
        setSelectedSheet(defaultSheet);
        loadSheetContent(wb, defaultSheet, file.name);
      } catch (err: any) {
        alert('Failed to parse Excel workbook: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Load a chosen sheet and auto-detect header row
  const loadSheetContent = (wb: XLSX.WorkBook, sheetName: string, fName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    setRawSheetData(matrix);

    // Auto-detect header row (scans first 10 rows)
    const detected = detectHeaderRow(matrix);
    setHeaderRowIdx(detected.headerRowIndex);
    setDetectedHeaders(detected.headers);
    setColumnMapping(detected.mapping);
    setIgnoredColumnsCount(detected.ignoredColumnsCount);

    // Auto-derive campaign name: filename (cleaned) + sheet date if detected
    const cleanFileName = fName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateMatch = sheetName.match(/(\d{1,2}\s*[a-zA-Z]+\s*\d{2,4})|(\d{6,8})/);
    const datePart = dateMatch ? '-' + dateMatch[0].replace(/\s+/g, '').toLowerCase() : '';
    setCampaignInput(`${cleanFileName}${datePart}`);

    // Auto-detect customer
    if (fName.toUpperCase().includes('BANKNTT') || sheetName.toUpperCase().includes('BANKNTT')) {
      setCustomerInput('BANK NTT');
    } else {
      setCustomerInput('INDOMARET');
    }
  };

  // When sheet selection changes
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    loadSheetContent(workbook, sheetName, fileName);
  };

  // When header row index is adjusted
  const handleHeaderRowIndexChange = (newRowIdx: number) => {
    setHeaderRowIdx(newRowIdx);
    if (!rawSheetData[newRowIdx]) return;

    const row = rawSheetData[newRowIdx];
    const headers: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const val = row[c] != null ? String(row[c]).trim() : '';
      headers.push(val);
    }
    setDetectedHeaders(headers.filter(Boolean));
  };

  // Compute verdicts per row (Step d)
  useEffect(() => {
    if (!rawSheetData || rawSheetData.length <= headerRowIdx + 1) {
      setParsedRows([]);
      return;
    }

    const headerRow = rawSheetData[headerRowIdx] || [];
    const headerColIndices: Record<string, number> = {};
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] || '').trim();
      if (h) headerColIndices[h] = c;
    }

    const rows: ExcelParsedRow[] = [];
    const seenHostnames = new Set<string>();

    for (let r = headerRowIdx + 1; r < rawSheetData.length; r++) {
      const row = rawSheetData[r];
      if (!row || row.every((c: any) => c == null || String(c).trim() === '')) {
        continue; // skip blank rows
      }

      const getColVal = (field: KnownField): string => {
        const colHeader = columnMapping[field];
        if (!colHeader) return '';
        const colIdx = headerColIndices[colHeader];
        if (colIdx === undefined || colIdx === -1) return '';
        const v = row[colIdx];
        return v != null ? String(v).trim() : '';
      };

      const rawHostname = getColVal('hostname');
      const rawOrderNumber = getColVal('orderNumber');
      const rawKota = getColVal('kota');
      const rawPengadaan = getColVal('pengadaan');
      const rawSiteCode = getColVal('siteCode');
      const rawSiteName = getColVal('siteName');
      const rawSerial = getColVal('serial');
      const rawSid = getColVal('sid');
      const rawCustomer = getColVal('customer');
      const rawCampaign = getColVal('campaign');

      // Matching against Inventory: MATCH ON SERIAL FIRST, THEN HOSTNAME!
      let invMatch: any = null;
      let matchedBy: 'serial' | 'hostname' | null = null;

      if (rawSerial) {
        invMatch = inventoryBySerial.get(rawSerial.toUpperCase().trim());
        if (invMatch) matchedBy = 'serial';
      }
      if (!invMatch && rawHostname) {
        invMatch = inventoryByHostname.get(rawHostname.toUpperCase().trim());
        if (invMatch) matchedBy = 'hostname';
      }

      // Resolved values: fill gaps from inventory where column is absent, fallback to defaultPengadaan
      const finalHostname = rawHostname || (invMatch?.hostname ? String(invMatch.hostname) : '');
      const finalOrderNumber = rawOrderNumber;
      const finalKota = rawKota || (invMatch?.kota ? String(invMatch.kota) : '');
      const finalPengadaan =
        rawPengadaan ||
        (invMatch?.pengadaan ? String(invMatch.pengadaan) : '') ||
        defaultPengadaan;
      const finalSiteCode =
        rawSiteCode || (invMatch?.siteCode ? String(invMatch.siteCode) : '');
      const finalSiteName =
        rawSiteName || (invMatch?.siteName ? String(invMatch.siteName) : '');
      const finalSerial =
        rawSerial || (invMatch?.serial ? String(invMatch.serial) : '');
      const finalSid = rawSid || (invMatch?.orderNumber ? String(invMatch.orderNumber) : '');

      const filledFlags = {
        serial: !rawSerial && !!finalSerial,
        kota: !rawKota && !!finalKota,
        siteCode: !rawSiteCode && !!finalSiteCode,
        siteName: !rawSiteName && !!finalSiteName,
        pengadaan: !rawPengadaan && !!finalPengadaan,
      };

      // VERDICT LOGIC
      let verdict: ExcelParsedRow['verdict'] = 'new';
      let isPrintable = true;
      let reason: string | undefined = undefined;

      const hostKey = finalHostname.toUpperCase().trim();
      const existingTraceDoc = hostKey ? activeTraceByHostname.get(hostKey) : null;

      if (!finalOrderNumber) {
        verdict = 'no_order';
        isPrintable = false;
        reason = 'No order number (SDWAN - Order Number is empty)';
      } else if (seenHostnames.has(hostKey)) {
        verdict = 'duplicate_in_file';
        isPrintable = false;
        reason = `Duplicate hostname in upload (${finalHostname})`;
      } else if (existingTraceDoc) {
        verdict = 'already_labelled';
        isPrintable = true; // Reused as reprint
        reason = `Already labelled (${existingTraceDoc.trace})`;
      } else if (!invMatch) {
        verdict = 'not_in_inventory';
        isPrintable = true; // Warning only, still prints!
        reason = 'Not found in inventory (will issue Trace ID)';
      } else {
        verdict = 'new';
        isPrintable = true;
      }

      if (finalHostname) {
        seenHostnames.add(hostKey);
      }

      rows.push({
        rowIndex: r + 1,
        raw: row,
        hostname: finalHostname,
        orderNumber: finalOrderNumber,
        kota: finalKota,
        pengadaan: finalPengadaan,
        siteCode: finalSiteCode,
        siteName: finalSiteName,
        serial: finalSerial,
        sid: finalSid,
        customer: rawCustomer || undefined,
        campaign: rawCampaign || undefined,
        verdict,
        isPrintable,
        reason,
        existingTrace: existingTraceDoc?.trace,
        inInventory: !!invMatch,
        matchedBy,
        filledFromInventory: filledFlags,
      });
    }

    setParsedRows(rows);
    if (rows.length > 0) {
      setPreviewRow((prev) => {
        if (!prev) return rows[0];
        const found = rows.find((item) => item.hostname === prev.hostname);
        return found || rows[0];
      });
    } else {
      setPreviewRow(null);
    }
  }, [
    rawSheetData,
    headerRowIdx,
    columnMapping,
    defaultPengadaan,
    activeTraceByHostname,
    inventoryBySerial,
    inventoryByHostname,
  ]);

  // Verdict stats
  const verdictStats = useMemo(() => {
    let newCount = 0;
    let alreadyCount = 0;
    let noOrderCount = 0;
    let dupCount = 0;
    let notInInvCount = 0;

    for (const r of parsedRows) {
      if (r.verdict === 'new') newCount++;
      else if (r.verdict === 'already_labelled') alreadyCount++;
      else if (r.verdict === 'no_order') noOrderCount++;
      else if (r.verdict === 'duplicate_in_file') dupCount++;
      else if (r.verdict === 'not_in_inventory') notInInvCount++;
    }

    return {
      total: parsedRows.length,
      newCount,
      alreadyCount,
      noOrderCount,
      dupCount,
      notInInvCount,
      printableTotal: newCount + alreadyCount + notInInvCount,
      unprintableTotal: noOrderCount + dupCount,
    };
  }, [parsedRows]);

  // Filtered rows for verdict preview table
  const displayedParsedRows = useMemo(() => {
    if (verdictFilter === 'ALL') return parsedRows;
    if (verdictFilter === 'PRINTABLE') return parsedRows.filter((r) => r.isPrintable);
    if (verdictFilter === 'UNPRINTABLE') return parsedRows.filter((r) => !r.isPrintable);
    return parsedRows.filter((r) => r.verdict === verdictFilter);
  }, [parsedRows, verdictFilter]);

  // Execute confirm and issue
  const handleExecuteWorkbookIssue = async () => {
    if (!user?.email) {
      alert('You must be signed in to issue new Trace IDs.');
      return;
    }

    const campaign = campaignInput.trim() || 'General';
    const customer = customerInput.trim() || 'INDOMARET';

    // Separate rows to issue (new & not_in_inventory) vs reprints (already_labelled)
    const candidatesToIssue: IssueCandidate[] = [];
    const rowsToReprint: ExcelParsedRow[] = [];
    const unprintableRows: ExcelParsedRow[] = [];

    for (const r of parsedRows) {
      if (!r.isPrintable) {
        unprintableRows.push(r);
      } else if (r.verdict === 'already_labelled') {
        rowsToReprint.push(r);
      } else {
        candidatesToIssue.push({
          hostname: r.hostname,
          orderNumber: r.orderNumber,
          kota: r.kota,
          pengadaan: r.pengadaan,
          siteCode: r.siteCode,
          siteName: r.siteName,
          serial: r.serial,
          sid: r.sid,
          customer,
          campaign,
        });
      }
    }

    setIsProcessingIssue(true);
    setIssueProgress({ current: 0, total: candidatesToIssue.length });

    try {
      const issueRes = await batchIssueTraceLabels(
        candidatesToIssue,
        campaign,
        customer,
        user.email,
        (current, total) => {
          setIssueProgress({ current, total });
        }
      );

      // Collect all printable mappings: newly issued + refreshed already labelled docs
      const printableMappings: TraceMapping[] = [...issueRes.success];
      const updatePromises: Promise<any>[] = [];

      for (const reprintRow of rowsToReprint) {
        const existing = activeTraceByHostname.get(reprintRow.hostname.toUpperCase().trim());
        if (existing) {
          const updatedMapping: TraceMapping = {
            ...existing,
            orderNumber: reprintRow.orderNumber || existing.orderNumber,
            kota: reprintRow.kota || existing.kota,
            pengadaan: reprintRow.pengadaan || existing.pengadaan || defaultPengadaan,
            serial: reprintRow.serial || existing.serial,
            customer: reprintRow.customer || customer || existing.customer,
            campaign: reprintRow.campaign || campaign || existing.campaign,
          };
          if (autoUpdateExisting && user?.email) {
            updatePromises.push(
              updateTraceLabel(
                existing.trace,
                {
                  orderNumber: updatedMapping.orderNumber,
                  kota: updatedMapping.kota,
                  pengadaan: updatedMapping.pengadaan,
                  serial: updatedMapping.serial,
                  customer: updatedMapping.customer,
                  campaign: updatedMapping.campaign,
                },
                user.email
              ).catch((e) => console.warn('Failed to update trace doc', e))
            );
          }
          printableMappings.push(updatedMapping);
        }
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      // Add all to Print Queue with client-side verified QR codes!
      await handleAddMultipleToPrintQueue(printableMappings);

      // Save summary so user can download the two resulting Excel workbooks
      setIssuedResultSummary({
        newIssuedCount: issueRes.success.length,
        reprintCount: rowsToReprint.length,
        unprintableCount: unprintableRows.length,
        campaign,
        printableRows: parsedRows.filter((r) => r.isPrintable),
        unprintableRows,
      });

      setConfirmModalOpen(false);
      // Automatically transition to the sticker sheet!
      setActiveTab('print');
    } catch (err: any) {
      alert('Error during batch issue: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingIssue(false);
      setIssueProgress(null);
    }
  };

  // Download Output File 1: Mapping Trace ID - <campaign>.xlsx
  const handleDownloadMappingWorkbook = () => {
    if (!issuedResultSummary) return;

    const rows = issuedResultSummary.printableRows.map((r, idx) => {
      const existing = activeTraceByHostname.get(r.hostname.toUpperCase().trim());
      const traceId = existing?.trace || r.existingTrace || 'PENDING';
      return {
        No: idx + 1,
        'Trace ID': traceId,
        Hostname: r.hostname,
        'Order SDWAN': r.orderNumber,
        Kota: r.kota,
        'Site Code': r.siteCode || '',
        'Site Name': r.siteName || '',
        'Serial Number': r.serial || '',
        'SID SDWAN': r.sid || '',
        'No Pengadaan': r.pengadaan || '',
        'Hal. Cetak': Math.floor(idx / 21) + 1,
        Keterangan: r.verdict === 'already_labelled' ? 'Reprint (reused Trace ID)' : 'Baru diterbitkan',
      };
    });

    exportExcelWorkbook(
      [{ sheetName: 'Mapping Trace ID', rows }],
      `Mapping Trace ID - ${issuedResultSummary.campaign}.xlsx`
    );
  };

  // Download Output File 2: Tidak dicetak - <campaign>.xlsx
  const handleDownloadUnprintableWorkbook = () => {
    if (!issuedResultSummary) return;

    const rows = issuedResultSummary.unprintableRows.map((r, idx) => ({
      No: idx + 1,
      Row: r.rowIndex,
      Hostname: r.hostname,
      'Order SDWAN': r.orderNumber || '(KOSONG)',
      'Serial Number': r.serial || '',
      'Alasan Tidak Dicetak': r.reason || 'Data tidak lengkap',
    }));

    exportExcelWorkbook(
      [{ sheetName: 'Tanpa Order SDWAN', rows }],
      `Tidak dicetak - ${issuedResultSummary.campaign}.xlsx`
    );
  };

  // ------------------------------------------------------------------------------------------------
  // TAB 3: PRINT QUEUE & PHYSICAL STICKER SHEET
  // ------------------------------------------------------------------------------------------------
  const orderedPrintQueue = useMemo(() => {
    return [...printQueue].sort((a, b) => {
      if (groupByKota) {
        const kotaComp = (a.kota || '').localeCompare(b.kota || '');
        if (kotaComp !== 0) return kotaComp;
      }
      return (a.hostname || '').localeCompare(b.hostname || '');
    });
  }, [printQueue, groupByKota]);

  // Lay out stickers onto A4 3x7 pages (21 stickers per page)
  const printPages = useMemo(() => {
    if (orderedPrintQueue.length === 0) return [];

    const pages: (PrintQueueItem | null)[][] = [];
    let currentPage: (PrintQueueItem | null)[] = [];

    // Prepend blank slots for start position offset (1-indexed)
    const initialBlankCount = Math.max(0, Math.min(20, printStartPos - 1));
    for (let i = 0; i < initialBlankCount; i++) {
      currentPage.push(null);
    }

    for (const item of orderedPrintQueue) {
      if (currentPage.length === 21) {
        pages.push(currentPage);
        currentPage = [];
      }
      currentPage.push(item);
    }

    if (currentPage.length > 0) {
      while (currentPage.length < 21) {
        currentPage.push(null);
      }
      pages.push(currentPage);
    }

    return pages;
  }, [orderedPrintQueue, printStartPos]);

  const handleMarkQueueAsPrinted = async () => {
    if (printQueue.length === 0 || !user?.email) return;
    setIsMarkingPrinted(true);
    try {
      const traceIds = printQueue.map((p) => p.trace);
      await markAsPrinted(traceIds, user.email);
      alert(`Marked ${traceIds.length} stickers as printed in Firestore.`);
    } catch (err: any) {
      alert('Failed to mark as printed: ' + err.message);
    } finally {
      setIsMarkingPrinted(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-full pb-16 font-sans">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3.5 shadow-2xs print:hidden">
        <div className="w-full max-w-[1760px] mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Tag className="w-6 h-6 text-blue-600" />
                Label
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Trace ID Registry & Automated Sticker Printing
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Drop request workbook → auto-detect & match → issue Trace IDs → generate verified QR codes → print A4 3×7 sheets
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('registry')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'registry'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>Registry</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {mappings.length.toLocaleString()}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('issue')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'issue'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Upload Data (XLSX)</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'print'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <span>Print Queue</span>
              {printQueue.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-600 text-white">
                  {printQueue.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-[1760px] mx-auto px-6 pt-4 space-y-4 print:p-0 print:m-0 print:max-w-none">
        {/* ======================================================================================== */}
        {/* TAB 1: REGISTRY (DEFAULT) */}
        {/* ======================================================================================== */}
        {activeTab === 'registry' && (
          <div className="space-y-4 print:hidden">
            {/* KPI stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Total Registered</span>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {mappings.length.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Issued Trace IDs</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Printed Stickers</span>
                <div className="text-2xl font-bold text-emerald-700 mt-0.5">
                  {mappings.filter((m) => m.status === 'printed').length.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Physical labels produced</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Matched in Inventory</span>
                <div className="text-2xl font-bold text-blue-700 mt-0.5">
                  {enrichedMappings.filter((m) => m.inInventory).length.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Joined by serial/hostname</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Print Queue</span>
                <div className="text-2xl font-bold text-purple-700 mt-0.5">
                  {printQueue.length.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-400">Staged for A4 sheet</span>
              </div>
            </div>

            {/* Sub-tab view selector: Master Asset Register vs Issued Labels */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRegistrySubTab('issued')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    registrySubTab === 'issued'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tracked Labels Registry ({mappings.length.toLocaleString()})</span>
                </button>
                <button
                  onClick={() => setRegistrySubTab('inventory')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    registrySubTab === 'inventory'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Master Asset Register ({allInventoryAssets.length.toLocaleString()} Devices)</span>
                </button>
              </div>

              {registrySubTab === 'inventory' && selectedAssetHostnames.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {selectedAssetHostnames.size} selected
                  </span>
                  <button
                    onClick={handleBatchIssueSelectedInventory}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Issue & Print Selected ({selectedAssetHostnames.size})</span>
                  </button>
                  <button
                    onClick={() => setSelectedAssetHostnames(new Set())}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* VIEW A: MASTER ASSET REGISTER (9,363 INVENTORY ASSETS) */}
            {registrySubTab === 'inventory' && (
              <div className="space-y-4">
                {/* Search & Filters */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search hostname, serial, SID SD-WAN, kota, tenant..."
                        value={invSearch}
                        onChange={(e) => {
                          setInvSearch(e.target.value);
                          setInvPage(1);
                        }}
                        className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                      {invSearch && (
                        <button
                          onClick={() => setInvSearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={invWitel}
                      onChange={(e) => {
                        setInvWitel(e.target.value);
                        setInvPage(1);
                      }}
                      className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium max-w-[160px] truncate"
                    >
                      <option value="ALL">All Witel ({inventoryWitels.length})</option>
                      {inventoryWitels.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>

                    <select
                      value={invPlatform}
                      onChange={(e) => {
                        setInvPlatform(e.target.value);
                        setInvPage(1);
                      }}
                      className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                    >
                      <option value="ALL">All Platforms</option>
                      <option value="CISCO">Cisco Catalyst</option>
                      <option value="FORTINET">Fortinet Secure SD-WAN</option>
                      <option value="VELO">VMware VeloCloud</option>
                    </select>

                    <select
                      value={invIssuedFilter}
                      onChange={(e) => {
                        setInvIssuedFilter(e.target.value as any);
                        setInvPage(1);
                      }}
                      className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                    >
                      <option value="ALL">Label Status: All</option>
                      <option value="ISSUED">Already Issued</option>
                      <option value="NOT_ISSUED">Not Yet Issued</option>
                    </select>
                  </div>

                  {/* Batch Selection Helpers */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const first21 = currentInvAssets.slice(0, 21).map((a) => (a.hostname || '').toUpperCase().trim()).filter(Boolean);
                        setSelectedAssetHostnames(new Set(first21));
                      }}
                      className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                      title="Select up to 21 devices on current page (exactly 1 full A4 sticker sheet)"
                    >
                      Select 21 (1 Sheet)
                    </button>
                    <span className="text-slate-500 font-medium">
                      Showing {filteredInventoryAssets.length.toLocaleString()} devices
                    </span>
                  </div>
                </div>

                {/* Master Inventory Asset Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                currentInvAssets.length > 0 &&
                                currentInvAssets.every((a) =>
                                  selectedAssetHostnames.has((a.hostname || '').toUpperCase().trim())
                                )
                              }
                              onChange={(e) => {
                                const copy = new Set(selectedAssetHostnames);
                                if (e.target.checked) {
                                  currentInvAssets.forEach((a) => {
                                    if (a.hostname) copy.add(a.hostname.toUpperCase().trim());
                                  });
                                } else {
                                  currentInvAssets.forEach((a) => {
                                    if (a.hostname) copy.delete(a.hostname.toUpperCase().trim());
                                  });
                                }
                                setSelectedAssetHostnames(copy);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-3.5 py-2.5">Hostname</th>
                          <th className="px-3 py-2.5">Serial Number</th>
                          <th className="px-3 py-2.5">Order SDWAN (SID)</th>
                          <th className="px-3 py-2.5">Kota / Witel</th>
                          <th className="px-3 py-2.5">Tenant / Customer</th>
                          <th className="px-3 py-2.5">Platform</th>
                          <th className="px-3 py-2.5 text-center">Physical Label Status</th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventoryLoading && allInventoryAssets.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-500">
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <div className="font-semibold text-slate-700">Connecting to Master Inventory...</div>
                              <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                Checking cloud cache. You can view your issued labels directly in{' '}
                                <button
                                  type="button"
                                  onClick={() => setRegistrySubTab('issued')}
                                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                                >
                                  Tracked Labels Registry ({mappings.length.toLocaleString()})
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : currentInvAssets.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-10 text-center text-slate-500">
                              <div className="font-medium text-slate-700">
                                {allInventoryAssets.length === 0
                                  ? 'No master devices loaded from storage. You can upload an XLSX file in "Upload Data (XLSX)" to issue and print your labels directly!'
                                  : 'No inventory assets match the search criteria.'}
                              </div>
                              {allInventoryAssets.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('issue')}
                                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
                                >
                                  Open Upload Data (XLSX) Menu
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          currentInvAssets.map((asset, idx) => {
                            const hostKey = (asset.hostname || '').toUpperCase().trim();
                            const isChecked = selectedAssetHostnames.has(hostKey);
                            const activeTrace = activeTraceByHostname.get(hostKey);

                            return (
                              <tr
                                key={asset.serial_number || asset.hostname || idx}
                                className={`transition hover:bg-slate-50 ${isChecked ? 'bg-blue-50/40' : ''}`}
                              >
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const copy = new Set(selectedAssetHostnames);
                                      if (e.target.checked) copy.add(hostKey);
                                      else copy.delete(hostKey);
                                      setSelectedAssetHostnames(copy);
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-3.5 py-2 font-mono font-bold text-slate-900">
                                  {asset.hostname}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-700">
                                  {asset.serial_number || '—'}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-600">
                                  {asset.sid_sdwan ? String(asset.sid_sdwan) : '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-800 font-medium">
                                  {asset.witel_norm || asset.region_witel || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate" title={asset.tenant_name}>
                                  {asset.tenant_is_location === 1 || !asset.tenant_name ? '—' : asset.tenant_name}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                                    {asset.platform || 'CISCO'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {activeTrace ? (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      {activeTrace.trace}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-[10.5px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                                      Not Issued
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {activeTrace ? (
                                    <button
                                      onClick={() => {
                                        handleAddToPrintQueue(activeTrace);
                                        setActiveTab('print');
                                      }}
                                      className="px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded border border-purple-200 transition cursor-pointer"
                                      title="Reprint physical sticker"
                                    >
                                      Reprint
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleIssueAssetFromInventory(asset)}
                                      className="px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition cursor-pointer"
                                      title="Issue Trace ID and add to Print Queue"
                                    >
                                      Issue & Print
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Master Inventory Pagination */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Page <strong className="text-slate-800">{invPage}</strong> of{' '}
                      <strong className="text-slate-800">{totalInvPages}</strong> ({filteredInventoryAssets.length.toLocaleString()} total devices)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={invPage <= 1}
                        onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer font-medium"
                      >
                        Previous
                      </button>
                      <button
                        disabled={invPage >= totalInvPages}
                        onClick={() => setInvPage((p) => Math.min(totalInvPages, p + 1))}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer font-medium"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: TRACKED LABELS REGISTRY (ISSUED LABELS) */}
            {registrySubTab === 'issued' && (
              <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search trace (TLK-… or bare), hostname, serial, order..."
                    value={regSearch}
                    onChange={(e) => {
                      setRegSearch(e.target.value);
                      setRegPage(1);
                    }}
                    className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                  {regSearch && (
                    <button
                      onClick={() => setRegSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={regCustomer}
                  onChange={(e) => {
                    setRegCustomer(e.target.value);
                    setRegPage(1);
                  }}
                  className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                >
                  <option value="ALL">All Customers</option>
                  {filterOptions.customers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={regCampaign}
                  onChange={(e) => {
                    setRegCampaign(e.target.value);
                    setRegPage(1);
                  }}
                  className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                >
                  <option value="ALL">All Campaigns</option>
                  {filterOptions.campaigns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={regKota}
                  onChange={(e) => {
                    setRegKota(e.target.value);
                    setRegPage(1);
                  }}
                  className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium max-w-[150px] truncate"
                >
                  <option value="ALL">All Kota</option>
                  {filterOptions.kotas.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>

                <select
                  value={regStatus}
                  onChange={(e) => {
                    setRegStatus(e.target.value);
                    setRegPage(1);
                  }}
                  className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                >
                  <option value="ALL">All Status</option>
                  <option value="issued">Issued</option>
                  <option value="printed">Printed</option>
                  <option value="void">Void</option>
                </select>

                <select
                  value={regMatchFilter}
                  onChange={(e) => {
                    setRegMatchFilter(e.target.value as any);
                    setRegPage(1);
                  }}
                  className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium"
                >
                  <option value="ALL">Inventory: All</option>
                  <option value="YES">In Inventory</option>
                  <option value="NO">Not in Inventory</option>
                </select>
              </div>

              <button
                onClick={handleExportRegistryCsv}
                disabled={sortedMappings.length === 0}
                className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Export all filtered rows to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV · {sortedMappings.length.toLocaleString()} rows</span>
              </button>
            </div>

            {/* BULK ACTION & DOWNLOAD QR TOOLBAR */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Tag className="w-4 h-4 text-blue-400" />
                  <span>Bulk QR & Print Operations</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                  <span className="text-slate-300">
                    Selected: <strong className="text-white font-mono">{selectedTraceIds.size}</strong> of{' '}
                    <span className="text-slate-400 font-mono">{sortedMappings.length}</span>
                  </span>
                  {selectedTraceIds.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer ml-1"
                    >
                      Clear
                    </button>
                  )}
                  {selectedTraceIds.size < sortedMappings.length && sortedMappings.length > 0 && (
                    <button
                      onClick={selectAllFiltered}
                      className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer ml-1"
                    >
                      Select All Filtered ({sortedMappings.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons for Download QR and Queue */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Download QR ZIP Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-400 px-1.5 flex items-center gap-1">
                    <Archive className="w-3.5 h-3.5 text-purple-400" />
                    <span>Download QR (.zip):</span>
                  </span>

                  <button
                    onClick={() => handleBulkDownloadQrZip('selected')}
                    disabled={selectedTraceIds.size === 0 || isZippingQr}
                    className="h-7 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Download vector QR code SVGs for all checked rows as a ZIP file"
                  >
                    <Download className="w-3 h-3" />
                    <span>Selected ({selectedTraceIds.size})</span>
                  </button>

                  <button
                    onClick={() => handleBulkDownloadQrZip('campaign')}
                    disabled={sortedMappings.length === 0 || isZippingQr}
                    className="h-7 px-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title={`Download vector QR code SVGs for all ${sortedMappings.length} current filtered rows as a ZIP file`}
                  >
                    <Download className="w-3 h-3" />
                    <span>
                      {regCampaign !== 'ALL' ? `Campaign "${regCampaign}"` : 'Current Filter'} ({sortedMappings.length})
                    </span>
                  </button>

                  <button
                    onClick={() => handleBulkDownloadQrZip('all')}
                    disabled={mappings.length === 0 || isZippingQr}
                    className="h-7 px-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Download all registered QR codes as a ZIP file"
                  >
                    <Download className="w-3 h-3" />
                    <span>All ({mappings.length})</span>
                  </button>
                </div>

                {/* 2. Add to Print Queue Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-400 px-1.5 flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>Print Queue:</span>
                  </span>

                  <button
                    onClick={() => handleBulkAddToQueue('selected')}
                    disabled={selectedTraceIds.size === 0 || bulkQueueLoading}
                    className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Add all checked items directly to Print Queue"
                  >
                    <span>+ Add Selected ({selectedTraceIds.size})</span>
                  </button>

                  <button
                    onClick={() => handleBulkAddToQueue('campaign')}
                    disabled={sortedMappings.length === 0 || bulkQueueLoading}
                    className="h-7 px-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                    title="Add all current filtered items directly to Print Queue"
                  >
                    <span>+ Add Filtered ({sortedMappings.length})</span>
                  </button>
                </div>

                {/* 3. Delete Labels Group */}
                <div className="flex items-center gap-1.5 bg-rose-950/40 p-1 rounded-lg border border-rose-800/70">
                  <span className="text-[11px] font-semibold text-rose-300 px-1.5 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Labels:</span>
                  </span>

                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedTraceIds.size === 0 || isDeleting}
                    className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Permanently delete all selected/checked labels from database"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Selected ({selectedTraceIds.size})</span>
                  </button>

                  <button
                    onClick={handleDeleteFiltered}
                    disabled={sortedMappings.length === 0 || isDeleting}
                    className="h-7 px-2.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded font-semibold transition disabled:opacity-40 cursor-pointer flex items-center gap-1 border border-rose-700/80"
                    title={`Permanently delete all ${sortedMappings.length} current filtered labels from database`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>All Filtered ({sortedMappings.length})</span>
                  </button>
                </div>
              </div>

              {deleteSuccessMessage && (
                <div className="w-full bg-emerald-900/80 border border-emerald-500/80 text-emerald-100 rounded-lg p-2.5 flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{deleteSuccessMessage}</span>
                  </div>
                  <button
                    onClick={() => setDeleteSuccessMessage(null)}
                    className="text-emerald-300 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isZippingQr && (
                <div className="w-full bg-slate-800 rounded-lg p-2 flex items-center justify-between text-xs text-purple-300">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Generating & archiving QR code SVGs into ZIP...</span>
                  </div>
                  <span className="font-mono font-bold">
                    {zipProgress ? `${zipProgress.current} / ${zipProgress.total}` : 'Packaging...'}
                  </span>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isCurrentPageAllSelected && currentPageMappings.length > 0}
                          onChange={toggleSelectCurrentPage}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          title={isCurrentPageAllSelected ? 'Deselect all on this page' : 'Select all on this page'}
                        />
                      </th>
                      <th
                        onClick={() => handleRegSort('trace')}
                        className="px-3.5 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Trace ID
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('hostname')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[200px]"
                      >
                        <div className="flex items-center gap-1">
                          Hostname
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('customer')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Customer
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('kota')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Kota
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('siteCode')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Site
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('orderNumber')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Order
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('serial')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Serial
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('campaign')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Campaign
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleRegSort('status')}
                        className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center gap-1">
                          Status
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-center">Inventory Match</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registryLoading ? (
                      <tr>
                        <td colSpan={12} className="py-12 text-center text-slate-500">
                          Loading Trace ID Registry...
                        </td>
                      </tr>
                    ) : currentPageMappings.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-12 text-center text-slate-500">
                          No matching Trace IDs found in registry.
                        </td>
                      </tr>
                    ) : (
                      currentPageMappings.map((m) => (
                        <tr
                          key={m.trace}
                          onClick={() => setSelectedMapping(m)}
                          className={`hover:bg-blue-50/50 transition cursor-pointer ${
                            selectedTraceIds.has(m.trace) ? 'bg-blue-50/80' : ''
                          }`}
                        >
                          <td
                            className="px-3 py-2 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTraceIds.has(m.trace)}
                              onChange={() => toggleSelectTrace(m.trace)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-3.5 py-2 font-mono font-bold text-blue-700">
                            {m.trace}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-slate-800">
                            {m.hostname}
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-medium">
                            {m.customer}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{m.kota || '—'}</td>
                          <td
                            className="px-3 py-2 text-slate-600 truncate max-w-[140px]"
                            title={m.siteName || m.siteCode || ''}
                          >
                            {m.siteCode || m.siteName || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">
                            {m.orderNumber || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">
                            {m.serial || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                              {m.campaign || 'General'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                                m.status === 'printed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : m.status === 'void'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {m.inInventory ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3 stroke-[3]" /> in inventory
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10.5px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                not in inventory
                              </span>
                            )}
                          </td>
                          <td
                            className="px-3 py-2 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => setSelectedMapping(m)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition cursor-pointer inline-flex items-center gap-1"
                                title="View label details and download QR / sticker"
                              >
                                <Download className="w-3 h-3 text-slate-500" />
                                <span>QR Label</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await handleAddToPrintQueue(m);
                                  setActiveTab('print');
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition cursor-pointer"
                                title="Add to Print Queue (Reprint)"
                              >
                                Reprint
                              </button>
                              <button
                                onClick={() => handleDeleteSingle(m)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition cursor-pointer"
                                title={`Delete label ${m.trace} (${m.hostname})`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <span>
                  Showing <strong className="text-slate-800">{currentPageMappings.length}</strong> of{' '}
                  <strong className="text-slate-800">{sortedMappings.length.toLocaleString()}</strong> Trace IDs
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={regPage <= 1}
                    onClick={() => setRegPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-medium text-slate-700">
                    Page {regPage} of {totalPages}
                  </span>
                  <button
                    disabled={regPage >= totalPages}
                    onClick={() => setRegPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

        {/* ======================================================================================== */}
        {/* TAB 2: ISSUE (UPLOAD EXCEL WORKBOOK — AUTO PARSE, VERDICT & GENERATE) */}
        {/* ======================================================================================== */}
        {activeTab === 'issue' && (
          <div className="space-y-4 print:hidden">
            {!user?.email ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-base">Authentication Required</h3>
                  <p className="text-sm mt-1 text-amber-800">
                    Issuing new Trace IDs requires signing in. Every issued label records the operator's
                    authenticated email in the immutable audit trail.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: FILE DROPZONE */}
                {!workbook ? (
                  <div className="space-y-4">
                    {/* Top Hero & Action Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left: Drag and Drop Upload Zone */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="lg:col-span-7 bg-white border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition shadow-xs group flex flex-col items-center justify-center min-h-[280px]"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileInputChange}
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                        />
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                          <Upload className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          Upload Request Workbook (.xlsx, .xls, .csv)
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          Drag and drop your request spreadsheet here, or click to browse.
                          <strong> Parsed purely in-memory in your browser</strong> — site coordinates and customer data remain private.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-xs">
                          <FileSpreadsheet className="w-4 h-4" />
                          Browse Excel / CSV File
                        </div>
                      </div>

                      {/* Right: New Standard Template Download & Target Preview */}
                      <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                              New Format Template v4 (2026)
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              63.5 × 38.1 mm Layout
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-2">
                            Standard Telkom Field Sticker Template
                          </h4>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            Pre-configured Excel format with official column headers, sample data, and data dictionary.
                          </p>

                          <div className="mt-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-[11px] space-y-1 font-mono text-slate-300">
                            <div><strong className="text-white">A: Hostname</strong> (Wajib / Required)</div>
                            <div><strong className="text-white">B: Order SDWAN</strong> (Wajib / SID)</div>
                            <div><strong className="text-white">C: Kota</strong> (Disarankan / Witel)</div>
                            <div><strong className="text-white">D: No Pengadaan</strong> (Standard Telkom)</div>
                            <div><strong className="text-white">E: Serial Number</strong> (Hardware SN)</div>
                            <div><strong className="text-white">F: Customer</strong> & <strong>G: Campaign</strong></div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadStandardLabelExcelTemplate();
                            }}
                            className="w-full h-9 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Official .xlsx Template</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Explanatory FAQ / Dynamic Layout Guarantee Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Card 1: Dynamic Layout Explanation */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <RotateCw className="w-4 h-4 text-blue-600" />
                          <span>Are saved labels locked to the old design?</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-[11.5px]">
                          <strong>No.</strong> The database stores clean device records (Hostname, Order SDWAN, Kota, No Pengadaan, Serial Number). The physical layout is <strong>rendered dynamically</strong>. When you view or print stickers, all records — whether saved previously or newly uploaded — automatically adopt the newest Batch 4 design (20.5mm QR on the left, Telkom logo on the right, centered Arial bold text).
                        </p>
                      </div>

                      {/* Card 2: Re-upload & Overwrite Guidance */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Why re-uploading updates your stickers</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-[11.5px]">
                          Older spreadsheets often lacked the <em>No Pengadaan</em> column, leaving the bottom line blank. Uploading with the new format populates all required metadata. With <strong>Auto-sync existing records</strong> enabled, previous hostnames are immediately updated in the database and staged for printing.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* WORKBOOK LOADED: 5-STEP PIPELINE */
                  <div className="space-y-4">
                    {/* Top File Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center font-bold">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{fileName}</div>
                          <div className="text-slate-500 text-[11px]">
                            {sheetList.length} sheet{sheetList.length !== 1 ? 's' : ''} detected · Client-side parsed in memory
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setWorkbook(null);
                          setParsedRows([]);
                        }}
                        className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold transition cursor-pointer"
                      >
                        Upload Different File
                      </button>
                    </div>

                    {/* Step a & b: Pick Sheet & Header Row Configuration */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Step a: Pick the sheet */}
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                            a
                          </span>
                          Pick Request Sheet
                        </label>
                        <select
                          value={selectedSheet}
                          onChange={(e) => handleSheetChange(e.target.value)}
                          className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {sheetList.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.rowCount} rows)
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Defaulted to sheet with most data rows
                        </span>
                      </div>

                      {/* Step b: Find Header Row */}
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                            b
                          </span>
                          Header Row Position
                        </label>
                        <select
                          value={headerRowIdx}
                          onChange={(e) => handleHeaderRowIndexChange(parseInt(e.target.value, 10))}
                          className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {Array.from({ length: Math.min(10, rawSheetData.length) }, (_, i) => (
                            <option key={i} value={i}>
                              Row #{i + 1} {i === headerRowIdx ? '(Auto-detected best score)' : ''}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                          Header row {headerRowIdx + 1}, data from row {headerRowIdx + 2}, {parsedRows.length} rows
                        </span>
                      </div>

                      {/* Ignored columns note */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                        <span className="font-semibold text-slate-700">Column Parser Status</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Ignored <strong>{ignoredColumnsCount}</strong> non-essential column{ignoredColumnsCount !== 1 ? 's' : ''} (e.g. No, Main Link Order Status, REG, STO, Type Edge).
                        </div>
                      </div>
                    </div>

                    {/* Step c: Column Mapping Matrix */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                            c
                          </span>
                          <span>Column Mappings (Auto-detected from file headers)</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Matches serial first in inventory, then hostname
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                        {(
                          [
                            { field: 'hostname', label: 'Hostname *', required: true },
                            { field: 'orderNumber', label: 'Order Number *', required: true },
                            { field: 'kota', label: 'Kota', required: false },
                            { field: 'pengadaan', label: 'No Pengadaan', required: false },
                            { field: 'customer', label: 'Customer', required: false },
                            { field: 'campaign', label: 'Campaign', required: false },
                            { field: 'serial', label: 'Serial Number', required: false },
                            { field: 'siteCode', label: 'Site Code', required: false },
                            { field: 'siteName', label: 'Site Name', required: false },
                            { field: 'sid', label: 'SID SDWAN', required: false },
                          ] as { field: KnownField; label: string; required: boolean }[]
                        ).map(({ field, label, required }) => (
                          <div key={field} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1 truncate" title={label}>
                              {label}
                            </label>
                            <select
                              value={columnMapping[field] || ''}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [field]: e.target.value || null,
                                }))
                              }
                              className={`w-full h-7 text-xs bg-white border rounded px-1.5 font-medium ${
                                required && !columnMapping[field]
                                  ? 'border-rose-400 bg-rose-50 text-rose-800 font-bold'
                                  : 'border-slate-300 text-slate-800'
                              }`}
                            >
                              <option value="">(None / absent in file)</option>
                              {detectedHeaders.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>

                      {/* Default No Pengadaan Input Fallback */}
                      <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <label className="block text-xs font-bold text-blue-900">
                            Default No Pengadaan (Standard Telkom fallback):
                          </label>
                          <span className="text-[11px] text-blue-700">
                            Automatically applied to Row 3 when an uploaded row is missing a No Pengadaan value.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={defaultPengadaan}
                            onChange={(e) => setDefaultPengadaan(e.target.value)}
                            placeholder="K.TEL.000882/HK.810/GPP-000000/2026"
                            className="h-8 px-2.5 text-xs bg-white border border-blue-300 rounded-lg font-mono text-blue-950 font-semibold w-72 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setDefaultPengadaan('K.TEL.000882/HK.810/GPP-000000/2026')}
                            className="h-8 px-2.5 text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg font-bold transition cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step d: Split-Screen Pre-Execution Verdicts with LIVE STICKER PREVIEW */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left: Pre-execution table */}
                      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                        {/* Verdict Pill Filters Bar */}
                        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                              d
                            </span>
                            <span>Pre-Execution Verdicts ({parsedRows.length} Rows)</span>
                          </div>

                          {/* Filter pills */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => setVerdictFilter('ALL')}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                verdictFilter === 'ALL'
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              All ({parsedRows.length})
                            </button>
                            <button
                              onClick={() => setVerdictFilter('new')}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                verdictFilter === 'new'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              New ({verdictStats.newCount})
                            </button>
                            <button
                              onClick={() => setVerdictFilter('already_labelled')}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                verdictFilter === 'already_labelled'
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              Already labelled ({verdictStats.alreadyCount})
                            </button>
                            <button
                              onClick={() => setVerdictFilter('not_in_inventory')}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                verdictFilter === 'not_in_inventory'
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              Not in inventory ({verdictStats.notInInvCount})
                            </button>
                            <button
                              onClick={() => setVerdictFilter('UNPRINTABLE')}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                                verdictFilter === 'UNPRINTABLE'
                                  ? 'bg-rose-700 text-white'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              Not printable ({verdictStats.unprintableTotal})
                            </button>
                          </div>
                        </div>

                        {/* Verdict Table */}
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead className="sticky top-0 bg-slate-100 z-10 text-slate-600 font-semibold uppercase tracking-wider select-none">
                              <tr>
                                <th className="px-3 py-2 w-12">Row</th>
                                <th className="px-3 py-2">Hostname</th>
                                <th className="px-3 py-2">Order SDWAN</th>
                                <th className="px-3 py-2">Kota</th>
                                <th className="px-3 py-2">No Pengadaan</th>
                                <th className="px-3 py-2">Verdict</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {displayedParsedRows.map((r) => {
                                const isSelected = previewRow?.hostname === r.hostname;
                                return (
                                  <tr
                                    key={r.rowIndex}
                                    onClick={() => setPreviewRow(r)}
                                    className={`transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-100/70 border-l-4 border-blue-600 font-medium'
                                        : !r.isPrintable
                                        ? 'bg-rose-50/50 text-rose-900 hover:bg-rose-100/60'
                                        : r.verdict === 'already_labelled'
                                        ? 'bg-blue-50/40 hover:bg-blue-100/50'
                                        : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="px-3 py-2 font-mono text-slate-500 font-semibold">
                                      #{r.rowIndex}
                                    </td>
                                    <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                      {r.hostname || <span className="italic text-rose-600">(Missing)</span>}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-slate-700">
                                      {r.orderNumber || (
                                        <span className="font-bold text-rose-600 bg-rose-100 px-1 rounded">
                                          (Missing Order)
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-700">
                                      {r.kota || '—'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600 max-w-[150px] truncate" title={r.pengadaan}>
                                      {r.pengadaan || '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                      {r.verdict === 'new' && (
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                          <Check className="w-3 h-3 stroke-[3]" /> New
                                        </span>
                                      )}
                                      {r.verdict === 'already_labelled' && (
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                          Already labelled · Update
                                        </span>
                                      )}
                                      {r.verdict === 'not_in_inventory' && (
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          Not in inventory
                                        </span>
                                      )}
                                      {r.verdict === 'no_order' && (
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                          No Order No
                                        </span>
                                      )}
                                      {r.verdict === 'duplicate_in_file' && (
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                          Duplicate
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Sticky Live Physical Field Sticker Preview */}
                      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-3 text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-blue-600" />
                            <span>Live Sticker Preview</span>
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            63.5 × 38.1 mm
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center w-full">
                          <PhysicalStickerPreview
                            hostname={previewRow?.hostname || parsedRows[0]?.hostname || '0208-D5-SBY-IDM-T312'}
                            orderNumber={previewRow?.orderNumber || parsedRows[0]?.orderNumber || 'ORD-2026-SUB-001'}
                            kota={previewRow?.kota || parsedRows[0]?.kota || 'SURABAYA'}
                            pengadaan={previewRow?.pengadaan || parsedRows[0]?.pengadaan || defaultPengadaan}
                            traceId={previewRow?.existingTrace || 'TLK-PREVIEW'}
                            scale={1.0}
                            showDownloadButtons={true}
                          />
                        </div>

                        {/* Breakdown */}
                        <div className="w-full mt-3 pt-3 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">QR Code:</span>
                            <span className="font-mono text-[10px] text-slate-500">20.5 × 20.5 mm (Left)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Logo:</span>
                            <span className="font-mono text-[10px] text-slate-500">Telkom 19.0 × 10.4 mm (Right)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Line 1: Hostname:</span>
                            <span className="font-mono text-[10px] text-slate-900 font-bold truncate max-w-[160px]">
                              {previewRow?.hostname || parsedRows[0]?.hostname || '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Line 2: Order • Kota:</span>
                            <span className="font-mono text-[10px] text-slate-800 truncate max-w-[160px]">
                              {(previewRow?.orderNumber || parsedRows[0]?.orderNumber || '—')} • {(previewRow?.kota || parsedRows[0]?.kota || '—')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">Line 3: Pengadaan:</span>
                            <span className="font-mono text-[9.5px] text-slate-500 truncate max-w-[170px]" title={previewRow?.pengadaan || parsedRows[0]?.pengadaan || defaultPengadaan}>
                              {previewRow?.pengadaan || parsedRows[0]?.pengadaan || defaultPengadaan}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 p-2 bg-blue-50/70 border border-blue-100 rounded-lg text-[10.5px] text-blue-900 leading-relaxed w-full">
                          💡 <strong>Dynamic Design:</strong> Label designs are never permanently frozen into data rows. Saved and newly uploaded records always render in the official Telkom physical sticker standard.
                        </div>
                      </div>
                    </div>

                    {/* Step e: Confirm & Issue Button Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="text-sm font-bold text-slate-900">
                          Ready to proceed:{' '}
                          <span className="text-emerald-700 font-mono">
                            {verdictStats.newCount + verdictStats.notInInvCount} new Trace IDs
                          </span>
                          {' · '}
                          <span className="text-blue-700 font-mono">
                            {verdictStats.alreadyCount} updates / reprints
                          </span>
                          {verdictStats.unprintableTotal > 0 && (
                            <span className="text-rose-700 font-mono">
                              {' · '}
                              {verdictStats.unprintableTotal} not printable
                            </span>
                          )}
                        </div>

                        {/* Re-upload metadata auto-update toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                          <input
                            type="checkbox"
                            checked={autoUpdateExisting}
                            onChange={(e) => setAutoUpdateExisting(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span className="font-semibold text-slate-700">
                            Auto-sync existing records: update previously saved hostnames with new format data (No Pengadaan, Kota, Order No)
                          </span>
                        </label>
                      </div>

                      <button
                        onClick={() => setConfirmModalOpen(true)}
                        disabled={verdictStats.printableTotal === 0}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Confirm & Issue ({verdictStats.printableTotal} Labels)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* POST-ISSUE RESULT DOWNLOADS CARD */}
                {issuedResultSummary && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3 text-xs text-emerald-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold text-sm">
                          Completed run for campaign "{issuedResultSummary.campaign}":{' '}
                          {issuedResultSummary.newIssuedCount} issued, {issuedResultSummary.reprintCount} reprints,{' '}
                          {issuedResultSummary.unprintableCount} unprintable.
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveTab('print')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition cursor-pointer"
                      >
                        View Sticker Sheets ({printQueue.length}) →
                      </button>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="font-bold text-slate-700">Give the files back:</span>
                      <button
                        onClick={handleDownloadMappingWorkbook}
                        className="h-8 px-3 inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Mapping Trace ID - {issuedResultSummary.campaign}.xlsx</span>
                      </button>

                      {issuedResultSummary.unprintableCount > 0 && (
                        <button
                          onClick={handleDownloadUnprintableWorkbook}
                          className="h-8 px-3 inline-flex items-center gap-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg font-semibold hover:bg-rose-50 transition shadow-2xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-rose-600" />
                          <span>Download Tidak dicetak - {issuedResultSummary.campaign}.xlsx</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ======================================================================================== */}
        {/* TAB 3: PRINT QUEUE → THE STICKER SHEET */}
        {/* ======================================================================================== */}
        {activeTab === 'print' && (
          <div className="space-y-4">
            {/* Operator Controls Bar (Hidden during print) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    A4 3×7 Sticker Sheet (21 Labels per Sheet)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {orderedPrintQueue.length} stickers in queue · {printPages.length} sheet{printPages.length !== 1 ? 's' : ''} · Verified offline QR codes
                  </p>
                </div>

                {/* Start Position Offset (1 to 21) for partially used sheets */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold text-slate-700">Start Position:</span>
                  <select
                    value={printStartPos}
                    onChange={(e) => setPrintStartPos(parseInt(e.target.value, 10))}
                    className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800"
                    title="Start position on the first sheet (skip already peeled labels 1 to N-1)"
                  >
                    {Array.from({ length: 21 }, (_, i) => i + 1).map((pos) => (
                      <option key={pos} value={pos}>
                        Position #{pos} {pos > 1 ? `(skip first ${pos - 1})` : '(start top-left)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group by Kota Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={groupByKota}
                    onChange={(e) => setGroupByKota(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Group by Kota</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {printQueue.length > 0 && (
                  <button
                    onClick={() => setPrintQueue([])}
                    className="h-8 px-3 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition font-semibold cursor-pointer"
                  >
                    Clear Queue
                  </button>
                )}

                <button
                  onClick={handleMarkQueueAsPrinted}
                  disabled={printQueue.length === 0 || isMarkingPrinted || !user?.email}
                  className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Mark all queued labels as printed in Firestore"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isMarkingPrinted ? 'Updating...' : 'Mark as Printed'}</span>
                </button>

                <button
                  onClick={handleDownloadStickerSheetsPdf}
                  disabled={printQueue.length === 0 || isExportingSheetPdf}
                  className="h-8 px-4 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Download all generated sticker sheets as a print-ready A4 PDF file"
                >
                  {isExportingSheetPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {sheetPdfProgress
                          ? `Exporting PDF (${sheetPdfProgress.current}/${sheetPdfProgress.total})...`
                          : 'Generating PDF...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF ({printPages.length} Sheet{printPages.length !== 1 ? 's' : ''})</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handlePrintSheet}
                  disabled={printQueue.length === 0}
                  className="h-8 px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Print directly using browser print dialog"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print via Browser</span>
                </button>
              </div>
            </div>

            {/* Print Requirement Notice (Always visible on print screen) */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
              <div className="flex items-center gap-2.5">
                <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 px-2 py-0.5 rounded text-amber-800 shrink-0">
                  Printer Calibration
                </span>
                <span>
                  Print at <strong>100% / "Actual size"</strong>. Ensure <strong>"Fit to page" is OFF</strong> and <strong>"Print backgrounds" is OFF</strong> so stickers align with pre-cut physical stock.
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-600 shrink-0">
                A4 (210 × 297 mm) · 3×7 Grid · 63.5 × 38.1 mm labels
              </div>
            </div>

            {/* Empty state */}
            {printQueue.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-16 text-center text-slate-500 print:hidden">
                <Printer className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-base text-slate-700">Print Queue is Empty</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Drop a request workbook in the <strong>Issue (Upload Excel)</strong> tab to automatically
                  stage stickers, or click <strong>Reprint</strong> on any label in the <strong>Registry</strong> tab.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={() => setActiveTab('issue')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Upload Request Workbook
                  </button>
                  <button
                    onClick={() => setActiveTab('registry')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    View Registry
                  </button>
                </div>
              </div>
            ) : (
              /* A4 Sheet Container rendered with precise physical geometry */
              <div className="label-print-area space-y-8 flex flex-col items-center print:block print:space-y-0 print:m-0 print:p-0">
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                    @page {
                      size: A4 portrait;
                      margin: 0;
                    }
                    @media print {
                      @page {
                        size: A4 portrait;
                        margin: 0;
                      }
                      html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      /* Hide everything except the sticker print area */
                      header, nav, aside, .print\\:hidden {
                        display: none !important;
                      }
                      body * {
                        visibility: hidden !important;
                      }
                      .label-print-area, .label-print-area * {
                        visibility: visible !important;
                      }
                      .label-print-area {
                        position: static !important;
                        display: block !important;
                        width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        border: none !important;
                        box-shadow: none !important;
                      }
                      .a4-sheet {
                        position: relative !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        max-width: 210mm !important;
                        max-height: 297mm !important;
                        min-width: 210mm !important;
                        min-height: 297mm !important;
                        margin: 0 auto !important;
                        padding-top: 15.2mm !important;
                        padding-bottom: 9mm !important;
                        padding-left: 7.25mm !important;
                        padding-right: 7.25mm !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        border: none !important;
                        box-shadow: none !important;
                        overflow: hidden !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                      }
                      .a4-sheet:last-of-type {
                        page-break-after: auto !important;
                        break-after: auto !important;
                      }
                      .label-cell {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        box-sizing: border-box !important;
                        border: none !important;
                      }
                    }
                  `,
                  }}
                />

                {printPages.map((page, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="a4-sheet bg-white border border-slate-300 shadow-md relative overflow-hidden select-none print:shadow-none print:border-none"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      paddingTop: '15.2mm',
                      paddingBottom: '9mm',
                      paddingLeft: '7.25mm',
                      paddingRight: '7.25mm',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* 3 Columns x 7 Rows Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '63.5mm 63.5mm 63.5mm',
                        gridTemplateRows: 'repeat(7, 38.1mm)',
                        columnGap: '2.5mm',
                        rowGap: '0mm',
                        width: '195.5mm',
                        height: '266.7mm',
                      }}
                    >
                      {page.map((item, slotIdx) => {
                        if (!item) {
                          return (
                            <div
                              key={slotIdx}
                              className="label-cell border border-dashed border-slate-100 rounded-sm print:border-none"
                              style={{
                                width: '63.5mm',
                                height: '38.1mm',
                                minWidth: '63.5mm',
                                minHeight: '38.1mm',
                                maxWidth: '63.5mm',
                                maxHeight: '38.1mm',
                                boxSizing: 'border-box',
                              }}
                            />
                          );
                        }

                        // Hostname auto-fit font size if exceptionally long (>32 chars)
                        const hostLength = item.hostname ? item.hostname.length : 0;
                        const hostFontSize = hostLength > 32 ? '7.5pt' : '8.5pt';

                        return (
                          <div
                            key={slotIdx}
                            className="label-cell group relative bg-white flex flex-col justify-between overflow-hidden text-black print:border-none"
                            style={{
                              width: '63.5mm',
                              height: '38.1mm',
                              minWidth: '63.5mm',
                              minHeight: '38.1mm',
                              maxWidth: '63.5mm',
                              maxHeight: '38.1mm',
                              boxSizing: 'border-box',
                              paddingTop: '1.2mm',
                              paddingBottom: '1.0mm',
                              paddingLeft: '2.5mm',
                              paddingRight: '2.5mm',
                              border: '0.15mm solid rgba(226, 232, 240, 0.6)',
                            }}
                          >
                            {/* Hover quick download single sticker button (hidden on print) */}
                            <div className="absolute top-0.5 right-0.5 z-10 print:hidden opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 bg-white/95 backdrop-blur-xs p-0.5 rounded shadow-xs border border-slate-200">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cellEl = (e.currentTarget.closest('.label-cell')) as HTMLElement;
                                  if (cellEl) {
                                    downloadElementAsPng(cellEl, `Sticker_${item.hostname || item.trace}.png`, 3);
                                  }
                                }}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                                title="Download single sticker (PNG)"
                              >
                                <ImageIcon className="w-3 h-3 text-blue-600" />
                              </button>
                              {item.qrSvg && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadSvgFile(item.qrSvg!, `QR_${item.trace || item.hostname}.svg`);
                                  }}
                                  className="p-0.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
                                  title="Download QR code (SVG)"
                                >
                                  <QrCode className="w-3 h-3 text-purple-600" />
                                </button>
                              )}
                            </div>
                            {/* Top row: QR (20.5 x 20.5 mm, left) and Telkom Logo (19.0 x 10.4 mm, right) */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                height: '20.5mm',
                                minHeight: '20.5mm',
                                maxHeight: '20.5mm',
                              }}
                            >
                              {/* Plain text offline QR Code (SVG, verified, left, 20.5 x 20.5 mm) */}
                              <div
                                className="label-qr-box shrink-0 bg-white"
                                style={{
                                  width: '20.5mm',
                                  height: '20.5mm',
                                  minWidth: '20.5mm',
                                  minHeight: '20.5mm',
                                  maxWidth: '20.5mm',
                                  maxHeight: '20.5mm',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {item.qrSvg ? (
                                  <div
                                    style={{ width: '20.5mm', height: '20.5mm' }}
                                    className="[&>svg]:!w-[20.5mm] [&>svg]:!h-[20.5mm] [&>svg]:block"
                                    dangerouslySetInnerHTML={{ __html: item.qrSvg }}
                                  />
                                ) : (
                                  <div
                                    style={{ width: '20.5mm', height: '20.5mm' }}
                                    className="bg-slate-50 flex items-center justify-center text-[7pt] text-slate-400"
                                  >
                                    QR
                                  </div>
                                )}
                              </div>

                              {/* Telkom Indonesia Logo (19.0 x 10.4 mm, right, vertically aligned with QR) */}
                              <div
                                className="shrink-0 flex items-center justify-end"
                                style={{
                                  width: '19.0mm',
                                  height: '10.4mm',
                                  minWidth: '19.0mm',
                                  minHeight: '10.4mm',
                                  maxWidth: '19.0mm',
                                  maxHeight: '10.4mm',
                                }}
                              >
                                <img
                                  src="/telkom-indonesia-logo.png"
                                  alt="Telkom Indonesia"
                                  style={{
                                    width: '19.0mm',
                                    height: '10.4mm',
                                    objectFit: 'contain',
                                    display: 'block',
                                  }}
                                  onError={(e) => {
                                    // Fallback if image asset fails to load
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            </div>

                            {/* Label Body: 3 Centred Lines (Arial bold) */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                width: '100%',
                                marginTop: '0.8mm',
                              }}
                            >
                              {/* Line 1: Hostname - Arial bold 8.5 pt, black, centred */}
                              <div
                                style={{
                                  fontFamily: 'Arial, sans-serif',
                                  fontWeight: 'bold',
                                  fontSize: hostFontSize,
                                  color: '#000000',
                                  textAlign: 'center',
                                  lineHeight: '1.15',
                                  width: '100%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={item.hostname}
                              >
                                {item.hostname}
                              </div>

                              {/* Line 2: Order · kota - Arial bold 7.0 pt, black, centred */}
                              <div
                                style={{
                                  fontFamily: 'Arial, sans-serif',
                                  fontWeight: 'bold',
                                  fontSize: '7.0pt',
                                  color: '#000000',
                                  textAlign: 'center',
                                  lineHeight: '1.2',
                                  marginTop: '0.6mm',
                                  width: '100%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.orderNumber && item.kota
                                  ? `${item.orderNumber}  ·  ${item.kota}`
                                  : (item.orderNumber || item.kota || '')}
                              </div>

                              {/* Line 3: Pengadaan - Arial bold 5.0 pt, grey #9C9C9C, centred */}
                              <div
                                style={{
                                  fontFamily: 'Arial, sans-serif',
                                  fontWeight: 'bold',
                                  fontSize: '5.0pt',
                                  color: '#9C9C9C',
                                  textAlign: 'center',
                                  lineHeight: '1.2',
                                  marginTop: '0.5mm',
                                  width: '100%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={item.pengadaan}
                              >
                                {item.pengadaan || 'K.TEL.000882/HK.810/GPP-000000/2026'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================================================== */}
      {/* CONFIRM AND ISSUE MODAL */}
      {/* ======================================================================================== */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  Confirm Trace ID Issuance
                </h4>
                <p className="text-xs text-slate-500">
                  Writes new records in Firestore transactions. Signed in as <strong>{user?.email}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Campaign / Batch Identifier:
                </label>
                <input
                  type="text"
                  value={campaignInput}
                  onChange={(e) => setCampaignInput(e.target.value)}
                  className="w-full h-8 bg-white border border-slate-300 rounded px-2 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Customer:</label>
                <input
                  type="text"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  className="w-full h-8 bg-white border border-slate-300 rounded px-2 font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 text-slate-700">
                <div className="flex justify-between">
                  <span>New Trace IDs to issue:</span>
                  <strong className="text-emerald-700 font-mono">
                    {verdictStats.newCount + verdictStats.notInInvCount}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Existing Trace IDs (reprints):</span>
                  <strong className="text-blue-700 font-mono">{verdictStats.alreadyCount}</strong>
                </div>
                {verdictStats.unprintableTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Not printable (skipped):</span>
                    <strong className="font-mono">{verdictStats.unprintableTotal}</strong>
                  </div>
                )}
              </div>
            </div>

            {isProcessingIssue && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Issuing Trace IDs in transactions...</span>
                  <span className="font-mono font-bold">
                    {issueProgress?.current || 0} / {issueProgress?.total || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-200"
                    style={{
                      width: `${
                        issueProgress?.total
                          ? ((issueProgress.current || 0) / issueProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isProcessingIssue}
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isProcessingIssue}
                onClick={handleExecuteWorkbookIssue}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {isProcessingIssue ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm & Issue</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================================== */}
      {/* LABEL DETAIL MODAL */}
      {/* ======================================================================================== */}
      {selectedMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Label Details · {selectedMapping.trace}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMapping(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* 1:1 Physical Field Sticker Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Exact Physical Sticker Format (63.5 × 38.1 mm)
                </span>
                <PhysicalStickerPreview
                  hostname={selectedMapping.hostname}
                  orderNumber={selectedMapping.orderNumber}
                  kota={selectedMapping.kota}
                  pengadaan={selectedMapping.pengadaan}
                  traceId={selectedMapping.trace}
                  scale={1.0}
                  showDownloadButtons={true}
                />
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Customer:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedMapping.customer}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Campaign:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedMapping.campaign || 'General'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Serial Number:</span>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {selectedMapping.serial || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Site Code / Name:</span>
                  <div className="text-slate-800 mt-0.5">
                    {selectedMapping.siteCode || selectedMapping.siteName || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>
                  <div className="mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold text-[10.5px] ${
                        selectedMapping.status === 'printed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedMapping.status === 'void'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {selectedMapping.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Inventory Link:</span>
                  <div className="mt-0.5">
                    {selectedMapping.inInventory ? (
                      <span className="text-emerald-700 font-medium">✓ Found in inventory</span>
                    ) : (
                      <span className="text-slate-400">Not in inventory feed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-[11px] text-slate-500">
                <div>
                  Source: <strong>{selectedMapping.source}</strong>
                </div>
                {selectedMapping.issuedBy && (
                  <div>
                    Issued by: <strong>{selectedMapping.issuedBy}</strong> on{' '}
                    {String(selectedMapping.issuedAt || '').substring(0, 16).replace('T', ' ')}
                  </div>
                )}
                {selectedMapping.printedBy && (
                  <div>
                    Printed by: <strong>{selectedMapping.printedBy}</strong> on{' '}
                    {String(selectedMapping.printedAt || '').substring(0, 16).replace('T', ' ')}
                  </div>
                )}
                {selectedMapping.voidedBy && (
                  <div className="text-rose-700">
                    Voided by: <strong>{selectedMapping.voidedBy}</strong> on{' '}
                    {String(selectedMapping.voidedAt || '').substring(0, 16).replace('T', ' ')}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedMapping) {
                      handleDeleteSingle(selectedMapping);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                  title="Permanently delete this label record from cloud database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Label Data</span>
                </button>
                {selectedMapping.status !== 'void' && (
                  <button
                    onClick={() => setVoidConfirmOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Void Label
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelectedMapping(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    await handleAddToPrintQueue(selectedMapping);
                    setSelectedMapping(null);
                    setActiveTab('print');
                  }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint (Add to Queue)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION DIALOG */}
      {voidConfirmOpen && selectedMapping && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-slate-900">Void Trace ID?</h4>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to void <strong className="font-mono">{selectedMapping.trace}</strong>?
              Voiding records your email and timestamp. A voided Trace ID is retired and will never be
              reissued to another device.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedMapping || !user?.email) return;
                  setIsVoiding(true);
                  try {
                    await voidTraceLabel(selectedMapping.trace, user.email);
                    setSelectedMapping((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: 'void',
                            voidedAt: new Date().toISOString(),
                            voidedBy: user.email,
                          }
                        : null
                    );
                    setVoidConfirmOpen(false);
                  } catch (err: any) {
                    alert('Failed to void: ' + err.message);
                  } finally {
                    setIsVoiding(false);
                  }
                }}
                disabled={isVoiding}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
              >
                {isVoiding ? 'Voiding...' : 'Yes, Void Label'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================================== */}
      {/* PERMANENT DELETE CONFIRMATION DIALOG (SINGLE / BATCH / FILTERED) */}
      {/* ======================================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  {deleteTarget.title}
                </h4>
                <p className="text-xs text-slate-500">
                  Permanently remove from cloud database
                </p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {deleteTarget.type === 'single'
                    ? 'Are you sure you want to delete this label data?'
                    : `Are you sure you want to delete ${deleteTarget.traceIds.length.toLocaleString()} label records?`}
                </span>
              </p>
              <p className="text-slate-600 leading-relaxed">
                This action is <strong>permanent and cannot be undone</strong>. The Trace ID mapping, QR records, and label print status will be erased from Firestore.
              </p>
            </div>

            {/* Preview of sample items being deleted */}
            {deleteTarget.sampleItems && deleteTarget.sampleItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Items to be deleted ({deleteTarget.traceIds.length}):
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 text-xs">
                  {deleteTarget.sampleItems.map((item) => (
                    <div key={item.trace} className="p-2 flex items-center justify-between">
                      <div className="font-mono font-bold text-blue-700">{item.trace}</div>
                      <div className="font-mono text-slate-700 truncate max-w-[200px]" title={item.hostname}>
                        {item.hostname}
                      </div>
                    </div>
                  ))}
                  {deleteTarget.traceIds.length > deleteTarget.sampleItems.length && (
                    <div className="p-2 text-center text-slate-400 text-[11px] italic">
                      ...and {(deleteTarget.traceIds.length - deleteTarget.sampleItems.length).toLocaleString()} more labels
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress bar during active deletion */}
            {isDeleting && (
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                    Deleting from Firestore...
                  </span>
                  <span className="font-mono">
                    {deleteProgress ? `${deleteProgress.current} / ${deleteProgress.total}` : 'Processing...'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: deleteProgress
                        ? `${Math.round((deleteProgress.current / deleteProgress.total) * 100)}%`
                        : '10%',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmExecuteDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {deleteTarget.type === 'single'
                        ? 'Yes, Delete Label'
                        : `Yes, Delete ${deleteTarget.traceIds.length.toLocaleString()} Labels`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
