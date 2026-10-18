import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Download,
  ArrowUpDown,
  Layers,
  Calendar,
  Check,
  FileText,
  Sparkles
} from 'lucide-react';
import { useCici } from '../cici/context/CiciContext';
import { useOrdersData } from '../hooks/useOrdersData';
import {
  OrderItem,
  OrderType,
  OrderState,
  OrderStep,
  PeriodFilter,
  SegmentDimension,
  AgingThreshold
} from '../types/orders';
import {
  parseWibDate,
  formatWibDateTime,
  formatWibDateOnly,
  formatWibTime,
  formatWibMinute,
  getDataAsOfSlug,
  formatDuration,
  getWaitTime,
  isDateInPeriod,
  formatRupiah,
  formatWholeDays,
  TOP_7_COLORS,
  OTHER_COLOR
} from '../utils/orderUtils';

const ORDER_TYPES: OrderType[] = ['AO', 'SO', 'DO', 'MO', 'RO'];
const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  AO: 'Activation',
  SO: 'Suspend',
  DO: 'Deactivation',
  MO: 'Modification',
  RO: 'Reactivation'
};

const AGING_OPTIONS: AgingThreshold[] = [14, 30, 60, 90];
const PERIOD_OPTIONS: { id: PeriodFilter; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
];
const SEGMENT_OPTIONS: { id: SegmentDimension; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'project', label: 'Project' },
  { id: 'segment', label: 'Segment' },
  { id: 'region', label: 'Region' },
  { id: 'witel', label: 'Witel' },
  { id: 'principal', label: 'Principal (edge vendor)' },
];

const PRINCIPAL_SRC_LABELS: Record<string, string> = {
  ncx: 'NCX live',
  snapshot: 'monthly snapshot',
  nf: 'billed service'
};

export default function OrderStatusView() {
  const { data, loading, refreshing, error, isStale, staleMinutes, refetch } = useOrdersData();

  // Filters persisted in localStorage
  const [period, setPeriod] = useState<PeriodFilter>(() => {
    return (localStorage.getItem('orderStatus_period') as PeriodFilter) || '30d';
  });
  const [segmentBy, setSegmentBy] = useState<SegmentDimension>(() => {
    return (localStorage.getItem('orderStatus_segmentBy') as SegmentDimension) || 'customer';
  });
  const [customerFilter, setCustomerFilter] = useState<string>(() => {
    return localStorage.getItem('orderStatus_customer') || 'ALL';
  });
  const [principalFilter, setPrincipalFilter] = useState<string>(() => {
    return localStorage.getItem('orderStatus_principal') || 'ALL';
  });
  const [agingFlag, setAgingFlag] = useState<AgingThreshold>(() => {
    const saved = localStorage.getItem('orderStatus_agingFlag');
    return saved ? (parseInt(saved, 10) as AgingThreshold) : 30;
  });

  // Interactive selection states
  const [selectedType, setSelectedType] = useState<OrderType>('AO');
  const [filterStep, setFilterStep] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [stateTab, setStateTab] = useState<'All' | OrderState>('In progress');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllGroups, setShowAllGroups] = useState<boolean>(false);
  const [rowLimit, setRowLimit] = useState<number>(100);

  // Hidden groups from step chart legend toggle
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());

  // Sorting
  const [sortField, setSortField] = useState<'days' | 'age' | 'id' | 'customer' | 'site' | 'state'>('days');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Selected order for right-hand slide-over detail panel
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Filter change handlers that clear selected step and breakdown group
  const handleCustomerChange = (newVal: string) => {
    setCustomerFilter(newVal);
    setFilterStep(null);
    setFilterGroup(null);
  };

  const handlePrincipalChange = (newVal: string) => {
    setPrincipalFilter(newVal);
    setFilterStep(null);
    setFilterGroup(null);
  };

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('orderStatus_period', period);
  }, [period]);
  useEffect(() => {
    localStorage.setItem('orderStatus_segmentBy', segmentBy);
  }, [segmentBy]);
  useEffect(() => {
    localStorage.setItem('orderStatus_customer', customerFilter);
  }, [customerFilter]);
  useEffect(() => {
    localStorage.setItem('orderStatus_principal', principalFilter);
  }, [principalFilter]);
  useEffect(() => {
    localStorage.setItem('orderStatus_agingFlag', agingFlag.toString());
  }, [agingFlag]);

  // Clear step and group filter when switching type
  useEffect(() => {
    setFilterStep(null);
    setFilterGroup(null);
    setHiddenGroups(new Set());
  }, [selectedType]);

  // Anchor date for period calculations (from parsed file meta.dataAsOf, fallback to now)
  const anchorDate = useMemo(() => {
    if (data?.meta?.dataAsOf) {
      const parsed = parseWibDate(data.meta.dataAsOf);
      if (parsed) return parsed;
    }
    return new Date();
  }, [data?.meta?.dataAsOf]);

  const allOrders = useMemo(() => data?.orders || [], [data?.orders]);
  const meta = useMemo(() => data?.meta || {}, [data?.meta]);

  // Unique list of customers with counts for the dropdown
  const customerOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of allOrders) {
      const c = order.customer?.trim() || 'Unknown';
      counts[c] = (counts[c] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted;
  }, [allOrders]);

  // Unique list of principals with counts for the dropdown
  const principalOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of allOrders) {
      const p = order.principal?.trim() || '(unknown)';
      counts[p] = (counts[p] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted;
  }, [allOrders]);

  // Filter orders by global Principal and Customer filters
  const scopedOrders = useMemo(() => {
    return allOrders.filter(o => {
      if (principalFilter !== 'ALL') {
        const p = o.principal?.trim() || '(unknown)';
        if (p !== principalFilter) return false;
      }
      if (customerFilter !== 'ALL') {
        const c = o.customer?.trim() || 'Unknown';
        if (c !== customerFilter) return false;
      }
      return true;
    });
  }, [allOrders, principalFilter, customerFilter]);

  // Executive summary counts
  const summary = useMemo(() => {
    let inProgress = 0;
    let agingOverThreshold = 0;
    let completedInPeriod = 0;

    for (const o of scopedOrders) {
      if (o.state === 'In progress') {
        inProgress++;
        if (o.days !== undefined && o.days >= agingFlag) {
          agingOverThreshold++;
        }
      } else if (o.state === 'Completed') {
        if (isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)) {
          completedInPeriod++;
        }
      }
    }

    return { inProgress, agingOverThreshold, completedInPeriod };
  }, [scopedOrders, agingFlag, period, anchorDate]);

  // 5 KPI cards data (AO, SO, DO, MO, RO)
  const kpiData = useMemo(() => {
    const map: Record<OrderType, {
      inProgress: number;
      completedPeriod: number;
      cancelledPeriod: number;
      agingCount: number;
    }> = {
      AO: { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 },
      SO: { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 },
      DO: { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 },
      MO: { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 },
      RO: { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 },
    };

    for (const o of scopedOrders) {
      const t = o.type;
      if (!map[t]) continue;

      if (o.state === 'In progress') {
        map[t].inProgress++;
        if (o.days !== undefined && o.days >= agingFlag) {
          map[t].agingCount++;
        }
      } else if (o.state === 'Completed') {
        if (isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)) {
          map[t].completedPeriod++;
        }
      } else if (o.state === 'Cancelled') {
        if (isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)) {
          map[t].cancelledPeriod++;
        }
      }
    }
    return map;
  }, [scopedOrders, agingFlag, period, anchorDate]);

  // Standard stages for the currently selected type
  const typeStages = useMemo(() => {
    const list = meta.stages?.[selectedType] || [];
    return [...list];
  }, [meta.stages, selectedType]);

  // Helper to extract the segment-by dimension value from an order
  const getGroupValue = (order: OrderItem): string => {
    switch (segmentBy) {
      case 'customer':
        return order.customer?.trim() || 'Unknown Customer';
      case 'project':
        return order.project?.trim() || order.customer?.trim() || 'Unknown Project';
      case 'segment':
        return order.segment?.trim() || 'Unknown Segment';
      case 'region':
        return order.region?.trim() || 'Unknown Region';
      case 'witel':
        return order.witel?.trim() || 'Unknown Witel';
      case 'principal':
        return order.principal?.trim() || '(unknown)';
      default:
        return 'Other';
    }
  };

  // Top 7 groups by in-progress orders of selected type and deterministic colors
  const topGroupsForType = useMemo(() => {
    const inProgressOfType = scopedOrders.filter(o => o.type === selectedType && o.state === 'In progress');
    const counts: Record<string, number> = {};
    for (const o of inProgressOfType) {
      const g = getGroupValue(o);
      counts[g] = (counts[g] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top7 = sorted.slice(0, 7).map(([name, count], index) => ({
      name,
      count,
      color: TOP_7_COLORS[index],
    }));

    const colorMap: Record<string, string> = {};
    for (const item of top7) {
      colorMap[item.name] = item.color;
    }

    const otherCount = sorted.slice(7).reduce((sum, [, c]) => sum + c, 0);

    return {
      top7,
      colorMap,
      otherCount,
      hasOther: sorted.length > 7 || otherCount > 0,
    };
  }, [scopedOrders, selectedType, segmentBy]);

  const getGroupColor = (groupName: string | undefined | null): string => {
    if (!groupName || groupName === 'Other' || groupName === 'Unknown' || groupName === '-') {
      return OTHER_COLOR;
    }
    return topGroupsForType.colorMap[groupName] || OTHER_COLOR;
  };

  // "Where are the orders now" calculation for selected type
  const stageBreakdown = useMemo(() => {
    const ordersOfType = scopedOrders.filter(o => o.type === selectedType);
    const inProgressOfType = ordersOfType.filter(o => o.state === 'In progress');

    // Check if any order is on otherStage
    const hasOther = inProgressOfType.some(o => 
      o.stageIdx === typeStages.length || o.stage === meta.otherStage || (o.stage && !typeStages.includes(o.stage))
    );

    const stagesToList = [...typeStages];
    if (hasOther) {
      stagesToList.push(meta.otherStage || 'Other task');
    }

    const rows = stagesToList.map((stageName, stageIndex) => {
      const matchingOrders = inProgressOfType.filter(o => {
        if (stageIndex < typeStages.length) {
          return o.stageIdx === stageIndex || o.stage === stageName;
        }
        return o.stageIdx === typeStages.length || o.stage === meta.otherStage || !typeStages.includes(o.stage || '');
      });

      const count = matchingOrders.length;
      const totalDays = matchingOrders.reduce((sum, o) => sum + (o.days || 0), 0);
      const avgDays = count > 0 ? totalDays / count : 0;

      // Group distribution for stacked bar
      const groupCounts: Record<string, number> = {};
      for (const o of matchingOrders) {
        const g = getGroupValue(o);
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      }

      // Group segments based on top 7 groups for type + Other
      const segments: { name: string; count: number; color: string }[] = [];
      let rowOtherCount = 0;

      for (const [gName, gCount] of Object.entries(groupCounts)) {
        if (topGroupsForType.colorMap[gName]) {
          segments.push({
            name: gName,
            count: gCount,
            color: topGroupsForType.colorMap[gName],
          });
        } else {
          rowOtherCount += gCount;
        }
      }

      // Sort segments matching top 7 order
      segments.sort((a, b) => {
        const idxA = topGroupsForType.top7.findIndex(t => t.name === a.name);
        const idxB = topGroupsForType.top7.findIndex(t => t.name === b.name);
        return idxA - idxB;
      });

      if (rowOtherCount > 0) {
        segments.push({
          name: 'Other',
          count: rowOtherCount,
          color: OTHER_COLOR,
        });
      }

      return {
        stageName,
        stageIndex,
        count,
        avgDays,
        segments,
      };
    });

    // Completed in period count
    const completedPeriodCount = ordersOfType.filter(
      o => o.state === 'Completed' && isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)
    ).length;

    const maxCount = Math.max(...rows.map(r => r.count), 1);

    return { rows, completedPeriodCount, maxCount };
  }, [scopedOrders, selectedType, typeStages, meta.otherStage, segmentBy, period, anchorDate, topGroupsForType]);

  // Completed per month (last 12 months)
  const completedPerMonth = useMemo(() => {
    const months: { key: string; label: string; year: number; month: number; count: number }[] = [];
    const aYear = anchorDate.getFullYear();
    const aMonth = anchorDate.getMonth();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(aYear, aMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = `${monthNames[m]} '${String(y).slice(-2)}`;
      months.push({ key, label, year: y, month: m, count: 0 });
    }

    const monthMap = new Map<string, number>();
    for (const m of months) monthMap.set(m.key, 0);

    const relevantCompleted = scopedOrders.filter(
      o => o.type === selectedType && o.state === 'Completed'
    );

    for (const o of relevantCompleted) {
      const dateStr = o.statusDate || o.stepStart;
      if (!dateStr) continue;
      const parsed = parseWibDate(dateStr);
      if (!parsed) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
    }

    const result = months.map(m => ({
      ...m,
      count: monthMap.get(m.key) || 0,
    }));

    const maxCount = Math.max(...result.map(m => m.count), 1);
    return { months: result, maxCount };
  }, [scopedOrders, selectedType, anchorDate]);

  // Breakdown table by Segment Dimension
  const breakdownTable = useMemo(() => {
    const ordersOfType = scopedOrders.filter(o => o.type === selectedType);
    const groupsMap = new Map<string, {
      name: string;
      stepCounts: number[];
      inProgress: number;
      completedPeriod: number;
      cancelledPeriod: number;
      maxDays: number;
    }>();

    for (const o of ordersOfType) {
      const g = getGroupValue(o);
      if (!groupsMap.has(g)) {
        groupsMap.set(g, {
          name: g,
          stepCounts: new Array(typeStages.length).fill(0),
          inProgress: 0,
          completedPeriod: 0,
          cancelledPeriod: 0,
          maxDays: 0,
        });
      }

      const item = groupsMap.get(g)!;

      if (o.state === 'In progress') {
        item.inProgress++;
        if (o.stageIdx !== undefined && o.stageIdx >= 0 && o.stageIdx < typeStages.length) {
          item.stepCounts[o.stageIdx]++;
        }
        if (o.days !== undefined && o.days > item.maxDays) {
          item.maxDays = o.days;
        }
      } else if (o.state === 'Completed') {
        if (isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)) {
          item.completedPeriod++;
        }
      } else if (o.state === 'Cancelled') {
        if (isDateInPeriod(o.statusDate || o.stepStart, period, anchorDate)) {
          item.cancelledPeriod++;
        }
      }
    }

    const sorted = Array.from(groupsMap.values()).sort((a, b) => b.inProgress - a.inProgress);
    return sorted;
  }, [scopedOrders, selectedType, typeStages, period, anchorDate, segmentBy]);

  // Filtered orders for the Order List table
  const filteredOrderList = useMemo(() => {
    return scopedOrders.filter(o => {
      // Must match selected order type
      if (o.type !== selectedType) return false;

      // Tab filter
      if (stateTab !== 'All' && o.state !== stateTab) return false;

      // Step filter from "Where are orders now" click
      if (filterStep) {
        if (filterStep === (meta.otherStage || 'Other task')) {
          const isOther = o.stageIdx === typeStages.length || o.stage === meta.otherStage || !typeStages.includes(o.stage || '');
          if (!isOther) return false;
        } else {
          if (o.stage !== filterStep) return false;
        }
      }

      // Group filter from breakdown table click
      if (filterGroup) {
        if (getGroupValue(o) !== filterGroup) return false;
      }

      // Search box filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          o.id?.toLowerCase().includes(q) ||
          o.wo?.toLowerCase().includes(q) ||
          o.customer?.toLowerCase().includes(q) ||
          o.site?.toLowerCase().includes(q) ||
          o.sid?.toLowerCase().includes(q) ||
          o.contract?.toLowerCase().includes(q) ||
          o.task?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [scopedOrders, selectedType, stateTab, filterStep, filterGroup, searchQuery, meta.otherStage, typeStages, segmentBy]);

  // Sort orders
  const sortedOrderList = useMemo(() => {
    return [...filteredOrderList].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'days':
          valA = a.days ?? -1;
          valB = b.days ?? -1;
          break;
        case 'age':
          valA = a.age ?? -1;
          valB = b.age ?? -1;
          break;
        case 'id':
          valA = a.id || '';
          valB = b.id || '';
          break;
        case 'customer':
          valA = a.customer || '';
          valB = b.customer || '';
          break;
        case 'site':
          valA = a.site || '';
          valB = b.site || '';
          break;
        case 'state':
          valA = a.state || '';
          valB = b.state || '';
          break;
        default:
          valA = a.days ?? -1;
          valB = b.days ?? -1;
      }

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB as string);
        return sortAsc ? comp : -comp;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredOrderList, sortField, sortAsc]);

  const displayedOrders = useMemo(() => {
    return sortedOrderList.slice(0, rowLimit);
  }, [sortedOrderList, rowLimit]);

  const toggleSort = (field: 'days' | 'age' | 'id' | 'customer' | 'site' | 'state') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default longest / descending
    }
  };

  const toggleGroupHide = (groupName: string) => {
    setHiddenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // CSV Export state & logic
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    }
    if (downloadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [downloadMenuOpen]);

  // Total steps across all filtered orders for the dropdown count
  const totalStepsCount = useMemo(() => {
    return sortedOrderList.reduce((acc, o) => acc + (o.steps?.length || 1), 0);
  }, [sortedOrderList]);

  // CSV helpers
  const escapeCsvCell = (val: any): string => {
    if (val === undefined || val === null) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const triggerDownload = (content: string, filename: string) => {
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
  };

  const buildOrdersCsv = (orders: OrderItem[]): string => {
    const headers = [
      'Order ID',
      'WO',
      'Type',
      'Status',
      'Current step',
      'WFM task',
      'Task status',
      'Days at step',
      'Order age (days)',
      'Step started (WIB)',
      'Customer',
      'Principal',
      'Principal source',
      'Project',
      'Contract',
      'Segment',
      'Region',
      'Witel',
      'STO',
      'Site',
      'SID',
      'NCX milestone',
      'NCX milestone date (WIB)',
      'Monthly price (Rp)',
      'Entered WFM (WIB)',
      'Last status change (WIB)'
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];

    for (const o of orders) {
      const row = [
        escapeCsvCell(o.id || ''),
        escapeCsvCell(o.wo || ''),
        escapeCsvCell(o.type || ''),
        escapeCsvCell(o.state || ''),
        escapeCsvCell(o.stage || ''),
        escapeCsvCell(o.task || ''),
        escapeCsvCell(o.taskStatus || ''),
        escapeCsvCell(o.days !== undefined && o.days !== null ? Math.round(o.days) : ''),
        escapeCsvCell(o.age !== undefined && o.age !== null ? Math.round(o.age) : ''),
        escapeCsvCell(formatWibMinute(o.stepStart)),
        escapeCsvCell(o.customer || ''),
        escapeCsvCell(o.principal || '(unknown)'),
        escapeCsvCell(o.principalSrc && PRINCIPAL_SRC_LABELS[o.principalSrc] ? PRINCIPAL_SRC_LABELS[o.principalSrc] : (o.principalSrc || '')),
        escapeCsvCell(o.project || ''),
        escapeCsvCell(o.contract || ''),
        escapeCsvCell(o.segment || ''),
        escapeCsvCell(o.region || ''),
        escapeCsvCell(o.witel || ''),
        escapeCsvCell(o.sto || ''),
        escapeCsvCell(o.site || ''),
        escapeCsvCell(o.sid || ''),
        escapeCsvCell(o.milestone || ''),
        escapeCsvCell(formatWibMinute(o.milestoneDate)),
        escapeCsvCell(o.mrc !== undefined && o.mrc !== null ? Math.round(o.mrc) : ''),
        escapeCsvCell(formatWibMinute(o.inWfm)),
        escapeCsvCell(formatWibMinute(o.statusDate))
      ];
      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  };

  const buildStepsCsv = (orders: OrderItem[], metaData: any): string => {
    const headers = [
      'Order ID',
      'Type',
      'Customer',
      'Principal',
      'Principal source',
      'Contract',
      'Site',
      'Order status',
      'Step no.',
      'Step name',
      'WFM task',
      'Step state (Done / In progress / Cancelled / Failed)',
      'Started (WIB)',
      'Finished (WIB)',
      'Duration (minutes)',
      'Waited before step (minutes)'
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];

    for (const o of orders) {
      const steps = o.steps;
      if (!steps || steps.length === 0) {
        const row = [
          escapeCsvCell(o.id || ''),
          escapeCsvCell(o.type || ''),
          escapeCsvCell(o.customer || ''),
          escapeCsvCell(o.principal || '(unknown)'),
          escapeCsvCell(o.principalSrc && PRINCIPAL_SRC_LABELS[o.principalSrc] ? PRINCIPAL_SRC_LABELS[o.principalSrc] : (o.principalSrc || '')),
          escapeCsvCell(o.contract || ''),
          escapeCsvCell(o.site || ''),
          escapeCsvCell(o.state || ''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell(''),
          escapeCsvCell('')
        ];
        lines.push(row.join(','));
        continue;
      }

      const standardStages: string[] = metaData?.stages?.[o.type] || [];
      const otherStageName: string = metaData?.otherStage || 'Other task';

      for (let sIdx = 0; sIdx < steps.length; sIdx++) {
        const step = steps[sIdx];
        const stageIdx = step[0];
        const rawTask = step[1] || '';
        const stateCode = step[2];
        const startStr = step[4];
        const finishStr = step[5];

        let stepName = standardStages[stageIdx];
        if (!stepName || stageIdx >= standardStages.length) {
          stepName = otherStageName || rawTask;
        }

        let stepState = '';
        if (stateCode === 'D') stepState = 'Done';
        else if (stateCode === 'P') stepState = 'In progress';
        else if (stateCode === 'C') stepState = 'Cancelled';
        else if (stateCode === 'F') stepState = 'Failed';
        else stepState = stateCode || '';

        // Duration (minutes): finish - start
        let durMin = '';
        if (startStr && finishStr) {
          const dStart = parseWibDate(startStr);
          const dFinish = parseWibDate(finishStr);
          if (dStart && dFinish) {
            const diffMs = dFinish.getTime() - dStart.getTime();
            if (diffMs >= 0) {
              durMin = String(Math.round(diffMs / 60000));
            }
          }
        }

        // Waited before step (minutes): start - previous step finish (empty for first step or when negative)
        let waitMin = '';
        if (sIdx > 0) {
          const prevStep = steps[sIdx - 1];
          const prevFinishStr = prevStep[5] || prevStep[4];
          if (prevFinishStr && startStr) {
            const dPrev = parseWibDate(prevFinishStr);
            const dCur = parseWibDate(startStr);
            if (dPrev && dCur) {
              const gapMs = dCur.getTime() - dPrev.getTime();
              if (gapMs >= 0) {
                waitMin = String(Math.round(gapMs / 60000));
              }
            }
          }
        }

        const row = [
          escapeCsvCell(o.id || ''),
          escapeCsvCell(o.type || ''),
          escapeCsvCell(o.customer || ''),
          escapeCsvCell(o.principal || '(unknown)'),
          escapeCsvCell(o.principalSrc && PRINCIPAL_SRC_LABELS[o.principalSrc] ? PRINCIPAL_SRC_LABELS[o.principalSrc] : (o.principalSrc || '')),
          escapeCsvCell(o.contract || ''),
          escapeCsvCell(o.site || ''),
          escapeCsvCell(o.state || ''),
          escapeCsvCell(sIdx + 1),
          escapeCsvCell(stepName),
          escapeCsvCell(rawTask),
          escapeCsvCell(stepState),
          escapeCsvCell(formatWibMinute(startStr)),
          escapeCsvCell(formatWibMinute(finishStr)),
          escapeCsvCell(durMin),
          escapeCsvCell(waitMin)
        ];
        lines.push(row.join(','));
      }
    }

    return lines.join('\r\n');
  };

  const handleDownload = (mode: 'orders' | 'steps') => {
    setDownloadMenuOpen(false);
    setIsExporting(true);

    setTimeout(() => {
      try {
        const stateSlug = stateTab.toLowerCase().replace(/\s+/g, '-');
        const dateSlug = getDataAsOfSlug(meta.dataAsOf);

        if (mode === 'orders') {
          const csv = buildOrdersCsv(sortedOrderList);
          const filename = `order-status_sdwan_${selectedType}_${stateSlug}_${dateSlug}.csv`;
          triggerDownload(csv, filename);
        } else {
          const csv = buildStepsCsv(sortedOrderList, meta);
          const filename = `order-status_sdwan_${selectedType}_${stateSlug}_${dateSlug}_steps.csv`;
          triggerDownload(csv, filename);
        }
      } catch (err) {
        console.error('Error generating CSV export:', err);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading order status...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 p-8 bg-slate-50">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-base text-red-900">Unable to load Order Status</h3>
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

  const periodLabel = PERIOD_OPTIONS.find(p => p.id === period)?.label || 'Last 30 days';

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-full pb-16 font-sans">
      {/* 1. Header + filters in one sticky bar (~64px tall) */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3 shadow-2xs">
        <div className="w-full max-w-[1760px] mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Title + Badge + Freshness line */}
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Order Status: SD-WAN</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                WFM Live
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Data as of {formatWibDateTime(meta.dataAsOf)} · latest WFM task {formatWibTime(meta.sourceLatestTask)} · refreshes every 5 min
            </p>
          </div>

          {/* Right, same row: the four filters as compact selects (h-8 text-xs) + Refresh button */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Completed/cancelled in */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Completed in:</span>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as PeriodFilter)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PERIOD_OPTIONS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Segment by */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Segment by:</span>
              <select
                value={segmentBy}
                onChange={e => setSegmentBy(e.target.value as SegmentDimension)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SEGMENT_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Principal */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Principal:</span>
              <select
                value={principalFilter}
                onChange={e => handlePrincipalChange(e.target.value)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium max-w-[210px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All principals</option>
                {principalOptions.map(([pName, count]) => (
                  <option key={pName} value={pName}>
                    {pName} ({count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Customer:</span>
              <select
                value={customerFilter}
                onChange={e => handleCustomerChange(e.target.value)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium max-w-[200px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Customers ({allOrders.length.toLocaleString()})</option>
                {customerOptions.map(([cName, count]) => (
                  <option key={cName} value={cName}>
                    {cName} ({count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Aging flag */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Aging:</span>
              <select
                value={agingFlag}
                onChange={e => setAgingFlag(parseInt(e.target.value, 10) as AgingThreshold)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {AGING_OPTIONS.map(a => (
                  <option key={a} value={a}>{a} days</option>
                ))}
              </select>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => refetch()}
              disabled={refreshing}
              className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Refresh order data"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* Stale Warning Banner if > 20 min old */}
      {isStale && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
          <div className="w-full max-w-[1760px] mx-auto flex items-center gap-3 text-amber-800 text-xs md:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">Feed data is stale ({staleMinutes} minutes old).</span>{' '}
              The publishing Mac on the Telkom VPN may be offline or disconnected. Figures may not reflect the latest live state.
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-[1760px] mx-auto px-6 pt-4 space-y-4">
        {/* Executive summary sentence directly under bar (plain text, no box) */}
        <div className="text-sm text-slate-600">
          <strong className="text-slate-900">{summary.inProgress.toLocaleString()}</strong> SD-WAN orders are in progress
          {principalFilter !== 'ALL' && (
            <> with principal <strong className="text-slate-900">{principalFilter}</strong></>
          )}
          ;{' '}
          <strong className="text-amber-700">{summary.agingOverThreshold.toLocaleString()}</strong> have been on their current step for more than {agingFlag} days.{' '}
          <strong className="text-emerald-700">{summary.completedInPeriod.toLocaleString()}</strong> completed in {periodLabel.toLowerCase()}.
        </div>

        {/* 2. Five KPI Cards: AO, SO, DO, MO, RO (~112px tall) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {ORDER_TYPES.map(type => {
            const isSelected = selectedType === type;
            const card = kpiData[type] || { inProgress: 0, completedPeriod: 0, cancelledPeriod: 0, agingCount: 0 };
            const label = ORDER_TYPE_LABELS[type];

            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                {/* 1. Header: Type · Label, selected dot on the right */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide">
                    {type} · {label}
                  </span>
                  {isSelected ? (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                  )}
                </div>

                {/* 2. Big number with in progress on the same baseline */}
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">
                    {card.inProgress.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 font-normal">in progress</span>
                </div>

                {/* 3. One row of three small pills */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
                    title={`Completed in ${periodLabel.toLowerCase()}`}
                  >
                    <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                    {card.completedPeriod.toLocaleString()} completed
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                    title={`Cancelled in ${periodLabel.toLowerCase()}`}
                  >
                    – {card.cancelledPeriod.toLocaleString()} cancelled
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      card.agingCount > 0 ? 'text-amber-700 bg-amber-50 font-semibold' : 'text-slate-400 bg-slate-50'
                    }`}
                    title={`In progress on current step for more than ${agingFlag} days`}
                  >
                    ⏱ {card.agingCount.toLocaleString()} &gt; {agingFlag}d
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3. Step Chart + Monthly Chart Side by Side (~400px height) */}
        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* Step Chart: col-span-12 xl:col-span-7 */}
          <div className="col-span-12 xl:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    Where are the orders now · {selectedType} ({ORDER_TYPE_LABELS[selectedType]})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pipeline step distribution. Click any step to filter the order list.
                  </p>
                </div>
                {filterStep && (
                  <button
                    onClick={() => setFilterStep(null)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Clear step filter: <span className="font-semibold">{filterStep}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Legend above the bars: top 7 groups + Other */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-0.5 pb-2 text-[11px]">
                {topGroupsForType.top7.map(item => {
                  const isHidden = hiddenGroups.has(item.name);
                  return (
                    <button
                      key={item.name}
                      onClick={() => toggleGroupHide(item.name)}
                      className={`inline-flex items-center gap-1.5 transition cursor-pointer select-none ${
                        isHidden ? 'opacity-40 line-through text-slate-400' : 'text-slate-700 hover:text-slate-900'
                      }`}
                      title={isHidden ? `Show ${item.name}` : `Hide ${item.name}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium truncate max-w-[130px]">{item.name}</span>
                    </button>
                  );
                })}
                {topGroupsForType.hasOther && (
                  <button
                    onClick={() => toggleGroupHide('Other')}
                    className={`inline-flex items-center gap-1.5 transition cursor-pointer select-none ${
                      hiddenGroups.has('Other') ? 'opacity-40 line-through text-slate-400' : 'text-slate-700 hover:text-slate-900'
                    }`}
                    title={hiddenGroups.has('Other') ? 'Show Other' : 'Hide Other'}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: OTHER_COLOR }}
                    />
                    <span className="font-medium">Other</span>
                  </button>
                )}
              </div>

              {/* Step Rows: 28px each grid-cols-[160px_1fr_110px] */}
              <div className="mt-2 space-y-1">
                {stageBreakdown.rows.map((row, rIdx) => {
                  const isFiltered = filterStep === row.stageName;
                  const activeSegments = row.segments.filter(s => !hiddenGroups.has(s.name));
                  const activeCount = activeSegments.reduce((sum, s) => sum + s.count, 0);
                  const barWidthPercent = stageBreakdown.maxCount > 0
                    ? (row.count / stageBreakdown.maxCount) * 100
                    : 0;

                  return (
                    <div
                      key={row.stageName}
                      onClick={() => setFilterStep(filterStep === row.stageName ? null : row.stageName)}
                      className={`grid grid-cols-[160px_1fr_110px] items-center gap-3 h-7 px-2 rounded cursor-pointer transition select-none ${
                        isFiltered
                          ? 'bg-blue-50 ring-1 ring-blue-300'
                          : 'hover:bg-slate-50'
                      }`}
                      title={`Filter by ${row.stageName}`}
                    >
                      {/* Col 1: Step Name */}
                      <div className="text-xs font-medium text-slate-800 truncate" title={row.stageName}>
                        <span className="text-slate-400 font-semibold mr-1.5">{rIdx + 1}</span>
                        {row.stageName}
                      </div>

                      {/* Col 2: Bar (14px high, 4px radius) scaled to max count */}
                      <div className="w-full flex items-center h-full">
                        <div
                          style={{ width: `${Math.max(barWidthPercent, row.count > 0 ? 1 : 0)}%` }}
                          className="h-3.5 rounded-[4px] bg-slate-100 overflow-hidden flex transition-all duration-300 shadow-2xs"
                        >
                          {row.count === 0 ? null : (
                            activeSegments.map((seg, sIdx) => {
                              const segWidth = activeCount > 0 ? (seg.count / activeCount) * 100 : 0;
                              return (
                                <div
                                  key={sIdx}
                                  style={{
                                    width: `${segWidth}%`,
                                    backgroundColor: seg.color,
                                  }}
                                  className="h-full transition-all group relative hover:opacity-90"
                                  title={`${seg.name}: ${seg.count.toLocaleString()} (${((seg.count / row.count) * 100).toFixed(1)}%)`}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Col 3: Count · Avg Days right-aligned */}
                      <div className="text-right text-xs font-semibold tabular-nums text-slate-700 whitespace-nowrap">
                        {row.count.toLocaleString()} · {Math.round(row.avgDays)}d avg
                      </div>
                    </div>
                  );
                })}

                {/* Last row: Completed in period */}
                <div className="grid grid-cols-[160px_1fr_110px] items-center gap-3 h-7 px-2 rounded bg-emerald-50/40 border border-emerald-100/60 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">✓ Completed ({periodLabel.toLowerCase()})</span>
                  </div>
                  <div className="w-full flex items-center h-full">
                    <div
                      style={{
                        width: `${Math.min(100, (stageBreakdown.completedPeriodCount / stageBreakdown.maxCount) * 100)}%`,
                      }}
                      className="h-3.5 rounded-[4px] bg-emerald-500 transition-all duration-300"
                    />
                  </div>
                  <div className="text-right font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                    {stageBreakdown.completedPeriodCount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Completed per month: col-span-12 xl:col-span-5 */}
          <div className="col-span-12 xl:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
            <div className="pb-2 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">
                Completed per month · {selectedType}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders reaching Completed by statusDate over the last 12 months
              </p>
            </div>

            {/* Monthly bars fill the card body */}
            <div className="flex-1 flex items-end justify-between gap-1.5 pt-6 pb-1 min-h-[220px]">
              {completedPerMonth.months.map(m => {
                const heightPercent = completedPerMonth.maxCount > 0
                  ? Math.max(m.count > 0 ? 8 : 2, Math.round((m.count / completedPerMonth.maxCount) * 100))
                  : 0;

                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[11px] font-semibold text-slate-700 tabular-nums mb-1 opacity-90 group-hover:opacity-100">
                      {m.count > 0 ? m.count.toLocaleString() : '-'}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[32px] bg-blue-600 group-hover:bg-blue-700 rounded-t transition-all shadow-2xs"
                      title={`${m.label}: ${m.count.toLocaleString()} completed`}
                    />
                    <span className="text-[10px] text-slate-500 font-medium mt-2 whitespace-nowrap">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Breakdown Table (max 440px height) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  Breakdown by {SEGMENT_OPTIONS.find(s => s.id === segmentBy)?.label} · {selectedType}
                </h2>
                {filterGroup && (
                  <button
                    onClick={() => setFilterGroup(null)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Clear {segmentBy}: <span className="font-semibold">{filterGroup}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {/* One-line key under the card title */}
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                {typeStages.map((s, idx) => `${idx + 1} ${s}`).join(' · ')}
              </p>
            </div>

            {breakdownTable.length > 15 && (
              <button
                onClick={() => setShowAllGroups(!showAllGroups)}
                className="text-xs text-slate-700 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                {showAllGroups ? 'Show top 15' : `Show all (${breakdownTable.length})`}
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200 shadow-2xs">
                <tr className="text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="sticky left-0 bg-white z-20 px-3 py-2 border-r border-slate-100 min-w-[200px]">
                    {SEGMENT_OPTIONS.find(s => s.id === segmentBy)?.label}
                  </th>
                  {typeStages.map((stageName, idx) => (
                    <th
                      key={idx}
                      className="px-2 py-2 text-right w-14 min-w-[56px] tabular-nums"
                      title={`${idx + 1} ${stageName}`}
                    >
                      {idx + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right tabular-nums bg-blue-50/50 text-blue-900 font-bold whitespace-nowrap min-w-[85px]">
                    In progress
                  </th>
                  <th className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-emerald-800 min-w-[85px]">
                    Completed
                  </th>
                  <th className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700 min-w-[80px]">
                    Cancelled
                  </th>
                  <th className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-amber-800 min-w-[80px]">
                    Oldest (d)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {breakdownTable.length === 0 ? (
                  <tr>
                    <td colSpan={typeStages.length + 5} className="px-4 py-8 text-center text-slate-500">
                      No orders found for this selection.
                    </td>
                  </tr>
                ) : (
                  (showAllGroups ? breakdownTable : breakdownTable.slice(0, 15)).map(row => {
                    const isSelected = filterGroup === row.name;
                    const groupColor = getGroupColor(row.name);

                    return (
                      <tr
                        key={row.name}
                        onClick={() => setFilterGroup(isSelected ? null : row.name)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer h-8 ${
                          isSelected ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="sticky left-0 bg-white z-10 px-3 py-1.5 text-slate-900 flex items-center gap-2 border-r border-slate-100">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: groupColor }}
                          />
                          <span className="truncate max-w-[180px]" title={row.name}>{row.name}</span>
                        </td>
                        {row.stepCounts.map((count, cIdx) => (
                          <td key={cIdx} className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                            {count > 0 ? (
                              <span className="font-semibold text-slate-900">{count}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right font-bold text-blue-700 bg-blue-50/30 tabular-nums">
                          {row.inProgress.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">
                          {row.completedPeriod.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                          {row.cancelledPeriod.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-amber-700 tabular-nums">
                          {row.inProgress > 0 ? `${formatWholeDays(row.maxDays)}` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Order List: Fixed height 560px, one-line rows, no jump on filter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Title Row: Title left; state chips + search right */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Orders List · {selectedType} ({sortedOrderList.length.toLocaleString()})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Active Filter Badges */}
              {(filterStep || filterGroup) && (
                <div className="flex items-center gap-1.5 text-xs">
                  {filterStep && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      Step: {filterStep}
                      <button onClick={() => setFilterStep(null)} className="hover:text-blue-900 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterGroup && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                      {segmentBy}: {filterGroup}
                      <button onClick={() => setFilterGroup(null)} className="hover:text-indigo-900 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* State Chips */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                {(['In progress', 'Completed', 'Cancelled', 'Failed', 'All'] as const).map(tab => {
                  const isCurrent = stateTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setStateTab(tab)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                        isCurrent
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search order ID, WO, customer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Download Button + Dropdown Menu */}
              <div className="relative" ref={downloadMenuRef}>
                <button
                  onClick={() => setDownloadMenuOpen(prev => !prev)}
                  disabled={isExporting || sortedOrderList.length === 0}
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Download filtered orders as CSV"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce text-blue-600' : 'text-slate-500'}`} />
                  <span>{isExporting ? 'Preparing…' : 'Download'}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${downloadMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {downloadMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30 text-xs">
                    <button
                      onClick={() => handleDownload('orders')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-800 transition cursor-pointer"
                    >
                      <span className="font-medium">Orders (CSV)</span>
                      <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                        {sortedOrderList.length.toLocaleString()} rows
                      </span>
                    </button>
                    <button
                      onClick={() => handleDownload('steps')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-800 transition cursor-pointer border-t border-slate-100"
                    >
                      <span className="font-medium">Orders + step history (CSV)</span>
                      <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                        {totalStepsCount.toLocaleString()} rows
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed-Height Scroll Area (h-[560px]) with sticky header */}
          <div className="h-[560px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200 shadow-2xs">
                <tr className="text-slate-600 font-semibold uppercase tracking-wider">
                  <th
                    onClick={() => toggleSort('id')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Order / WO
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('customer')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Customer
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">Contract</th>
                  <th
                    onClick={() => toggleSort('site')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Site / SID
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 min-w-[200px]">Current Step</th>
                  <th
                    onClick={() => toggleSort('state')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('days')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Days at step
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('age')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Order age
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">NCX Milestone</th>
                  <th className="px-3 py-2.5">Witel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map(order => {
                    const isAging = order.days !== undefined && order.days >= agingFlag;
                    const stageIdx = order.stageIdx ?? -1;

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group h-10"
                      >
                        {/* Order + WO */}
                        <td className="px-3 py-1.5">
                          <div className="font-mono font-medium text-blue-600 group-hover:text-blue-800 flex items-center gap-1 leading-tight">
                            {order.id}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono leading-tight">{order.wo || '-'}</div>
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5 max-w-[240px]">
                            <span className="font-medium text-slate-800 truncate" title={order.customer}>
                              {order.customer || '-'}
                            </span>
                            {(order.newFortinet || order.principal === 'New Fortinet (Capex Based)') && (
                              <span
                                className="text-[10.5px] font-semibold px-1.5 py-0.2 rounded-full border bg-orange-50 border-orange-200 text-slate-800 shrink-0 select-none"
                                title="Principal: New Fortinet (Capex Based)"
                              >
                                New Fortinet
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Contract */}
                        <td className="px-3 py-1.5">
                          <div className="text-slate-600 truncate max-w-[140px]" title={order.contract}>
                            {order.contract || '-'}
                          </div>
                        </td>

                        {/* Site + SID */}
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-slate-800 truncate max-w-[160px]" title={order.site}>
                            {order.site || '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono leading-tight">
                            {order.sid || '-'}
                          </div>
                        </td>

                        {/* Current step with mini progress dots + step name */}
                        <td className="px-3 py-1.5">
                          <div
                            className="flex items-center gap-2"
                            title={`${order.stage || ''} · ${order.task || ''} ${order.taskStatus ? `(${order.taskStatus})` : ''}`}
                          >
                            <div className="flex items-center gap-0.5 shrink-0">
                              {typeStages.map((_, dotIdx) => {
                                let dotColor = 'bg-slate-200';
                                if (order.state === 'Completed' || dotIdx < stageIdx) {
                                  dotColor = 'bg-emerald-500';
                                } else if (dotIdx === stageIdx && order.state === 'In progress') {
                                  dotColor = 'bg-blue-600 ring-1 ring-blue-200';
                                }
                                return (
                                  <span
                                    key={dotIdx}
                                    className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                                  />
                                );
                              })}
                            </div>
                            <span className="text-slate-700 font-medium truncate max-w-[150px]">
                              {order.stage || order.task || '-'}
                            </span>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              order.state === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : order.state === 'In progress'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : order.state === 'Cancelled'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {order.state}
                          </span>
                        </td>

                        {/* Days at step (whole days, no decimals) */}
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {isAging ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                              {formatWholeDays(order.days)}
                            </span>
                          ) : (
                            <span className="text-slate-700">
                              {formatWholeDays(order.days)}
                            </span>
                          )}
                        </td>

                        {/* Order age (whole days, no decimals) */}
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 font-medium">
                          {formatWholeDays(order.age)}
                        </td>

                        {/* NCX milestone */}
                        <td className="px-3 py-1.5">
                          <span className="text-slate-600 truncate max-w-[150px] block" title={order.milestone}>
                            {order.milestone || '-'}
                          </span>
                        </td>

                        {/* Witel */}
                        <td className="px-3 py-1.5 text-slate-600">
                          {order.witel || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Card Footer: Showing N of Total · Show more */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {Math.min(displayedOrders.length, sortedOrderList.length).toLocaleString()} of {sortedOrderList.length.toLocaleString()} orders
            </span>
            {displayedOrders.length < sortedOrderList.length && (
              <button
                onClick={() => setRowLimit(prev => prev + 100)}
                className="text-blue-600 hover:text-blue-800 font-semibold transition cursor-pointer"
              >
                Show more (+100)
              </button>
            )}
          </div>
        </div>
      </main>

      {/* 6. Order Detail: The Step Timeline (Right-hand slide-over) */}
      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          meta={meta}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Order Detail Drawer Component (Step Timeline) - Preserved exactly as requested
// ------------------------------------------------------------------------------------------------

interface OrderDetailDrawerProps {
  order: OrderItem;
  meta: any;
  onClose: () => void;
}

function OrderDetailDrawer({ order, meta, onClose }: OrderDetailDrawerProps) {
  const { askCici } = useCici();
  const steps: OrderStep[] = order.steps || [];
  const standardStages: string[] = meta?.stages?.[order.type] || [];
  const otherStageName: string = meta?.otherStage || 'Other task';

  // 1. Total time (first step start -> last finish, or -> now if still open)
  const totalTimeBadge = useMemo(() => {
    if (steps.length === 0) {
      if (order.days !== undefined) return `Open for ${order.days}d`;
      return null;
    }

    const firstStart = parseWibDate(steps[0][4]);
    if (!firstStart) return null;

    if (order.state === 'Completed') {
      const lastStep = steps[steps.length - 1];
      const lastFinish = parseWibDate(lastStep[5] || lastStep[4]);
      if (lastFinish) {
        const diff = lastFinish.getTime() - firstStart.getTime();
        return `Completed in ${formatDuration(diff)}`;
      }
    }

    // Still open -> now vs firstStart
    const diff = Date.now() - firstStart.getTime();
    return `Open for ${formatDuration(diff)}`;
  }, [steps, order.state, order.days]);

  // 2. N of M WFM tasks done
  const tasksDoneBadge = useMemo(() => {
    if (steps.length === 0) return null;
    const doneCount = steps.filter(s => s[2] === 'D').length;
    return `${doneCount} of ${steps.length} WFM tasks done`;
  }, [steps]);

  // 3. First task date
  const firstTaskBadge = useMemo(() => {
    if (steps.length === 0) return null;
    return `First task ${formatWibDateOnly(steps[0][4])}`;
  }, [steps]);

  // Remaining standard steps (for orders still in progress)
  const pendingStages = useMemo(() => {
    if (order.state !== 'In progress' || standardStages.length === 0) return [];
    
    // Furthest stage index reached in actual steps
    const reachedIndices = steps.map(s => s[0]).filter(idx => idx >= 0 && idx < standardStages.length);
    const maxReached = reachedIndices.length > 0 ? Math.max(...reachedIndices) : -1;

    // Remaining are those after maxReached not already present
    const remaining: string[] = [];
    for (let i = maxReached + 1; i < standardStages.length; i++) {
      remaining.push(standardStages[i]);
    }
    return remaining;
  }, [order.state, standardStages, steps]);

  // Skipped standard steps
  const skippedStages = useMemo(() => {
    if (order.state !== 'In progress' || standardStages.length === 0) return [];
    const performedIndices = new Set(steps.map(s => s[0]));
    const reachedIndices = steps.map(s => s[0]).filter(idx => idx >= 0 && idx < standardStages.length);
    const maxReached = reachedIndices.length > 0 ? Math.max(...reachedIndices) : -1;

    if (maxReached <= 0) return [];
    const skipped: string[] = [];
    for (let i = 0; i < maxReached; i++) {
      if (!performedIndices.has(i)) {
        skipped.push(standardStages[i]);
      }
    }
    return skipped;
  }, [order.state, standardStages, steps]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-10 overflow-y-auto">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {order.type} · {ORDER_TYPE_LABELS[order.type] || order.type}
                </span>
                <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                  {order.id}
                </h2>
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {order.customer || 'Unknown Customer'}
              </div>
              {order.site && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {order.site} {order.sid ? `(${order.sid})` : ''}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Three Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-medium">
            {totalTimeBadge && (
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {totalTimeBadge}
              </span>
            )}
            {tasksDoneBadge && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {tasksDoneBadge}
              </span>
            )}
            {firstTaskBadge && (
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {firstTaskBadge}
              </span>
            )}
            <button
              onClick={() => askCici(`Ringkas status order ${order.id} untuk customer ${order.customer || ''}`, {
                menu: 'orders',
                selectedItemType: 'order',
                selectedItemId: order.id,
                selectedItemData: order,
              })}
              className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 transition text-xs font-semibold cursor-pointer shadow-2xs ml-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tanya Cici</span>
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-8 flex-1">
          {/* Step Timeline */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              WFM Step History (Actual Order)
            </h3>

            {steps.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center text-slate-500 text-xs">
                <p className="font-semibold text-slate-700">No WFM task history for this order</p>
                <p className="mt-1">Current stage: {order.stage || order.task || 'Unknown'}</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {steps.map((step, idx) => {
                  const stageIdx = step[0];
                  const rawTask = step[1];
                  const state = step[2]; // 'D' | 'P' | 'C' | 'F'
                  const statusLabel = step[3];
                  const startStr = step[4];
                  const finishStr = step[5];

                  // Step name resolution
                  let stepName = standardStages[stageIdx];
                  if (!stepName || stageIdx >= standardStages.length) {
                    stepName = otherStageName || rawTask;
                  }

                  // Waiting time from previous step finish
                  let waitTimeText: string | null = null;
                  if (idx > 0) {
                    const prevStep = steps[idx - 1];
                    const prevFinish = prevStep[5] || prevStep[4];
                    waitTimeText = getWaitTime(prevFinish, startStr);
                  }

                  const startDate = parseWibDate(startStr);
                  const finishDate = parseWibDate(finishStr);

                  return (
                    <div key={idx} className="relative flex items-start justify-between gap-4 text-xs group">
                      {/* Left icon on vertical line */}
                      <div className="absolute -left-[31px] top-0.5 flex items-center justify-center">
                        {state === 'D' && (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-700 flex items-center justify-center shadow-2xs">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </div>
                        )}
                        {state === 'P' && (
                          <div className="w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                          </div>
                        )}
                        {(state === 'C' || state === 'F') && (
                          <div className="w-5 h-5 rounded-full bg-rose-100 border-2 border-rose-500 text-rose-700 flex items-center justify-center shadow-2xs">
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </div>
                        )}
                      </div>

                      {/* Middle: Step name, raw task, waiting time */}
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-slate-900 text-sm">
                          {stepName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {rawTask}
                        </div>
                        {waitTimeText && (
                          <div className="mt-1 text-[11px] text-amber-700 font-medium">
                            ⏳ waited {waitTimeText} after previous step
                          </div>
                        )}
                      </div>

                      {/* Right (aligned right): Times and durations */}
                      <div className="text-right shrink-0">
                        {state === 'D' && (
                          <div>
                            <div className="font-bold text-slate-900">
                              {finishStr ? formatWibDateTime(finishStr) : '-'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              start {formatWibDateTime(startStr, false)}
                            </div>
                            {startDate && finishDate && (
                              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                                took {formatDuration(finishDate.getTime() - startDate.getTime())}
                              </div>
                            )}
                          </div>
                        )}

                        {state === 'P' && (
                          <div>
                            <div className="font-bold text-blue-600">
                              {statusLabel || 'In Progress'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              since {formatWibDateTime(startStr)}
                            </div>
                            {startDate && (
                              <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
                                {formatDuration(Date.now() - startDate.getTime())} so far
                              </div>
                            )}
                          </div>
                        )}

                        {(state === 'C' || state === 'F') && (
                          <div>
                            <div className="font-bold text-rose-600">
                              {state === 'C' ? 'Cancelled' : 'Failed'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {finishStr ? formatWibDateTime(finishStr) : formatWibDateTime(startStr)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Remaining Pending Steps */}
                {pendingStages.map((stageName, pIdx) => (
                  <div key={pIdx} className="relative flex items-center justify-between gap-4 text-xs opacity-60">
                    <div className="absolute -left-[31px] top-0 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-white border-2 border-dashed border-slate-300 flex items-center justify-center" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-600">{stageName}</div>
                      <div className="text-[11px] text-slate-400">Pending next step</div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 italic">
                      Pending
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped Steps Notice */}
            {skippedStages.length > 0 && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Not performed for this order:</span>{' '}
                {skippedStages.join(', ')}.
              </div>
            )}
          </div>

          {/* Order Attributes Key/Value List */}
          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              Order Attributes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Order Type</span>
                <span className="font-semibold text-slate-800">
                  {order.type} ({ORDER_TYPE_LABELS[order.type] || order.type})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-semibold text-slate-800">{order.customer || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Principal</span>
                <span className="font-semibold text-slate-800">
                  {order.principal
                    ? `${order.principal}${order.principalSrc && PRINCIPAL_SRC_LABELS[order.principalSrc] ? ` · ${PRINCIPAL_SRC_LABELS[order.principalSrc]}` : ''}`
                    : '(unknown)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Contract</span>
                <span className="font-semibold text-slate-800">{order.contract || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Site</span>
                <span className="font-semibold text-slate-800">{order.site || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">SID</span>
                <span className="font-semibold text-slate-800 font-mono">{order.sid || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Segment</span>
                <span className="font-semibold text-slate-800">{order.segment || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Region / Witel</span>
                <span className="font-semibold text-slate-800">
                  {order.region || '-'} / {order.witel || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">STO</span>
                <span className="font-semibold text-slate-800">{order.sto || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Work Order (WO)</span>
                <span className="font-semibold text-slate-800 font-mono">{order.wo || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Entered WFM</span>
                <span className="font-semibold text-slate-800">{formatWibDateTime(order.inWfm)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Order Age</span>
                <span className="font-semibold text-slate-800">{formatWholeDays(order.age)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">NCX Milestone</span>
                <span className="font-semibold text-slate-800">{order.milestone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Monthly Price (MRC)</span>
                <span className="font-semibold text-blue-700">{formatRupiah(order.mrc)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
