import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  RotateCw,
  AlertTriangle,
  Info,
  Search,
  X,
  ArrowUpDown,
  Download,
  CheckCircle2,
  Calendar,
  Filter,
  Check,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Layers,
  Building2
} from 'lucide-react';
import { useAssuranceData } from '../hooks/useAssuranceData';
import { MonthlyAssurance, AssuranceTicket } from '../types/assurance';
import {
  formatWibDateTime,
  formatMonthLabel,
  getDataAsOfSlug,
  buildAssuranceTicketsCsv,
  triggerCsvDownload
} from '../utils/assuranceUtils';

export default function AssuranceView() {
  const { data, loading, refreshing, error, isStale, staleMinutes, refetch } = useAssuranceData();

  // Global filters
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');

  // Ticket list local filters (only filters the ticket table & ticket export)
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [ticketStatusTab, setTicketStatusTab] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'REOPENED'>('ALL');
  const [ticketMonthFilter, setTicketMonthFilter] = useState<string>('ALL');
  const [ticketDateFrom, setTicketDateFrom] = useState<string>('');
  const [ticketDateTo, setTicketDateTo] = useState<string>('');
  const [ticketCategory, setTicketCategory] = useState<string>('ALL');

  // Customer table sorting
  const [custSortField, setCustSortField] = useState<keyof MonthlyAssurance>('tickets');
  const [custSortAsc, setCustSortAsc] = useState<boolean>(false);

  // Tickets table sorting
  const [ticketSortField, setTicketSortField] = useState<keyof AssuranceTicket>('created');
  const [ticketSortAsc, setTicketSortAsc] = useState<boolean>(false);

  // CSV export state
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Extract distinct months from monthly data (newest first)
  const availableMonths = useMemo(() => {
    if (!data?.monthly || data.monthly.length === 0) return [];
    const months = [...data.monthly.map(m => m.month)];
    // Sort descending: e.g. "2026-09", "2026-08"
    return months.sort((a, b) => b.localeCompare(a));
  }, [data?.monthly]);

  // Set default selected month when data arrives
  const currentMonth = useMemo(() => {
    if (selectedMonth && availableMonths.includes(selectedMonth)) {
      return selectedMonth;
    }
    if (data?.meta?.nfLatestPeriod && availableMonths.includes(data.meta.nfLatestPeriod)) {
      return data.meta.nfLatestPeriod;
    }
    return availableMonths[0] || '2026-09';
  }, [selectedMonth, availableMonths, data?.meta?.nfLatestPeriod]);

  // Extract distinct customer groups from byCustomer
  const customerOptions = useMemo(() => {
    if (!data?.byCustomer) return [];
    const set = new Set<string>();
    for (const c of data.byCustomer) {
      if (c.group) set.add(c.group);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data?.byCustomer]);

  // Get active KPI record for current selection
  const activeKpi = useMemo(() => {
    if (!data) return null;
    if (selectedCustomer === 'ALL') {
      const match = data.monthly.find(m => m.month === currentMonth);
      return match || data.meta.current || null;
    } else {
      const match = data.byCustomer.find(
        c => c.month === currentMonth && c.group === selectedCustomer
      );
      return match || null;
    }
  }, [data, currentMonth, selectedCustomer]);

  // Get previous month KPI record for delta comparison
  const prevKpi = useMemo(() => {
    if (!data) return null;
    const curIdx = availableMonths.indexOf(currentMonth);
    if (curIdx === -1 || curIdx >= availableMonths.length - 1) return null;
    const prevMonthStr = availableMonths[curIdx + 1];

    if (selectedCustomer === 'ALL') {
      return data.monthly.find(m => m.month === prevMonthStr) || null;
    } else {
      return data.byCustomer.find(
        c => c.month === prevMonthStr && c.group === selectedCustomer
      ) || null;
    }
  }, [data, currentMonth, availableMonths, selectedCustomer]);

  // Customers table for the selected month
  const customersInMonth = useMemo(() => {
    if (!data?.byCustomer) return [];
    return data.byCustomer.filter(c => c.month === currentMonth);
  }, [data?.byCustomer, currentMonth]);

  const sortedCustomers = useMemo(() => {
    return [...customersInMonth].sort((a, b) => {
      let valA: any = a[custSortField];
      let valB: any = b[custSortField];

      if (valA === undefined || valA === null) valA = -999999;
      if (valB === undefined || valB === null) valB = -999999;

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(String(valB));
        return custSortAsc ? comp : -comp;
      }
      return custSortAsc ? valA - valB : valB - valA;
    });
  }, [customersInMonth, custSortField, custSortAsc]);

  const handleCustSort = (field: keyof MonthlyAssurance) => {
    if (custSortField === field) {
      setCustSortAsc(!custSortAsc);
    } else {
      setCustSortField(field);
      setCustSortAsc(false); // default descending
    }
  };

  // Distinct ticket months for ticket filter
  const ticketMonths = useMemo(() => {
    if (!data?.tickets) return [];
    const set = new Set<string>();
    for (const t of data.tickets) {
      if (t.created) {
        const str = String(t.created);
        const m = str.substring(0, 7); // "YYYY-MM"
        if (m.length === 7) set.add(m);
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data?.tickets]);

  // Handle ticket month change: fills From and To dates with that month's bounds
  const handleTicketMonthSelect = (m: string) => {
    setTicketMonthFilter(m);
    if (m === 'ALL') {
      setTicketDateFrom('');
      setTicketDateTo('');
    } else {
      const [yearStr, monthStr] = m.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      // Last day of month
      const lastDay = new Date(year, month, 0).getDate();
      setTicketDateFrom(`${m}-01`);
      setTicketDateTo(`${m}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // When editing date inputs directly, clear the month dropdown
  const handleDateFromChange = (val: string) => {
    setTicketDateFrom(val);
    setTicketMonthFilter('ALL');
  };
  const handleDateToChange = (val: string) => {
    setTicketDateTo(val);
    setTicketMonthFilter('ALL');
  };

  const handleClearTicketFilters = () => {
    setTicketSearch('');
    setTicketStatusTab('ALL');
    setTicketMonthFilter('ALL');
    setTicketDateFrom('');
    setTicketDateTo('');
    setTicketCategory('ALL');
  };

  // Filtered tickets list
  const filteredTickets = useMemo(() => {
    if (!data?.tickets) return [];
    const q = ticketSearch.trim().toLowerCase();

    return data.tickets.filter(t => {
      // Status tab
      if (ticketStatusTab === 'OPEN') {
        const st = t.status?.toUpperCase();
        if (st === 'CLOSED' || st === 'RESOLVED') return false;
      } else if (ticketStatusTab === 'CLOSED') {
        const st = t.status?.toUpperCase();
        if (st !== 'CLOSED' && st !== 'RESOLVED') return false;
      } else if (ticketStatusTab === 'REOPENED') {
        if (!t.reopened) return false;
      }

      // Date range on created date
      if (ticketDateFrom) {
        const tDate = t.created ? String(t.created).substring(0, 10) : '';
        if (!tDate || tDate < ticketDateFrom) return false;
      }
      if (ticketDateTo) {
        const tDate = t.created ? String(t.created).substring(0, 10) : '';
        if (!tDate || tDate > ticketDateTo) return false;
      }

      // Category filter
      if (ticketCategory !== 'ALL') {
        if (ticketCategory === 'C_PROACTIVE') {
          if (!t.proactive && t.category !== 'C_PROACTIVE') return false;
        } else if (t.category !== ticketCategory) {
          return false;
        }
      }

      // Customer filter if selected in header
      if (selectedCustomer !== 'ALL') {
        if (t.customer?.toLowerCase() !== selectedCustomer.toLowerCase()) {
          return false;
        }
      }

      // Search box substring
      if (q) {
        const matchId = t.id?.toLowerCase().includes(q);
        const matchSid = t.svc?.toLowerCase().includes(q) || t.sid?.toLowerCase().includes(q);
        const matchCust = t.customer?.toLowerCase().includes(q);
        const matchWitel = t.witel?.toLowerCase().includes(q);
        const matchHeadline = t.headline?.toLowerCase().includes(q);
        const matchSolution = t.solution?.toLowerCase().includes(q);

        if (!matchId && !matchSid && !matchCust && !matchWitel && !matchHeadline && !matchSolution) {
          return false;
        }
      }

      return true;
    });
  }, [
    data?.tickets,
    ticketStatusTab,
    ticketDateFrom,
    ticketDateTo,
    ticketCategory,
    selectedCustomer,
    ticketSearch
  ]);

  // Sort tickets
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      let valA: any = a[ticketSortField];
      let valB: any = b[ticketSortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(String(valB));
        return ticketSortAsc ? comp : -comp;
      }
      return ticketSortAsc ? valA - valB : valB - valA;
    });
  }, [filteredTickets, ticketSortField, ticketSortAsc]);

  const handleTicketSort = (field: keyof AssuranceTicket) => {
    if (ticketSortField === field) {
      setTicketSortAsc(!ticketSortAsc);
    } else {
      setTicketSortField(field);
      setTicketSortAsc(false); // default descending (newest first)
    }
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const csv = buildAssuranceTicketsCsv(sortedTickets);
        const filename = `assurance_sdwan_tickets_${getDataAsOfSlug(data?.meta?.dataAsOf)}.csv`;
        triggerCsvDownload(csv, filename);
      } catch (err) {
        console.error('CSV export failed:', err);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  // Monthly timeline for trend charts (Jan 2026 -> now in chronological order)
  const monthlyTrend = useMemo(() => {
    if (!data?.monthly) return [];
    return [...data.monthly].sort((a, b) => a.month.localeCompare(b.month));
  }, [data?.monthly]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading InSERA SD-WAN assurance data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 w-full max-w-[1760px] mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-base text-red-900">Failed to load SD-WAN Assurance feed</h3>
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

  const meta = data?.meta;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-full pb-16 font-sans">
      {/* 1. Header Bar (Sticky) */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3.5 shadow-2xs">
        <div className="w-full max-w-[1760px] mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Title + InSERA Badge + Freshness */}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                SD-WAN Assurance
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                InSERA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Data as of {formatWibDateTime(meta?.dataAsOf)} · latest ticket{' '}
              {meta?.latestTicket ? meta.latestTicket.split(' ')[1] : '—'} · refreshes every 15 min
            </p>
          </div>

          {/* Right: Month & Customer Filters + Refresh */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Month Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Month:</span>
              <select
                value={currentMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Customer:</span>
              <select
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-slate-800 font-medium max-w-[220px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All customers (National)</option>
                {customerOptions.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              disabled={refreshing}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Refresh InSERA feed"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-[1760px] mx-auto px-6 pt-4 space-y-4">
        {/* Amber Stale Banner if > 45 minutes */}
        {isStale && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-lg flex items-center justify-between text-xs font-medium shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                InSERA assurance feed is stale ({staleMinutes} minutes since last snapshot at{' '}
                {formatWibDateTime(meta?.dataAsOf)}). Automated VPN poller may be delayed.
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="underline font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
            >
              Try re-fetch
            </button>
          </div>
        )}

        {/* Scope Subtitle Notice */}
        <div className="text-[11.5px] text-slate-500 bg-slate-100/70 border border-slate-200/80 px-3.5 py-2 rounded-lg flex items-center justify-between">
          <span>
            <strong>Scope (revised 2026-09-25):</strong> tickets on NF-billed SD-WAN services in
            categories <code className="text-slate-800 font-semibold">C_SDWAN</code>,{' '}
            <code className="text-slate-800 font-semibold">C_REQ</code> and{' '}
            <code className="text-slate-800 font-semibold">C_PROACTIVE</code> only. Proactive (SQM-generated) tickets are included in all KPIs. Underlay connectivity faults (C_CONN) excluded.
          </span>
          {selectedCustomer !== 'ALL' && (
            <span className="ml-3 shrink-0 inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Filtered: {selectedCustomer}
              <button
                onClick={() => setSelectedCustomer('ALL')}
                className="hover:text-blue-900 cursor-pointer ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* 2. KPI Row: 8 Cards for Selected Month */}
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
          {/* Card 1: Q */}
          <KpiCard
            title="Q"
            value={activeKpi?.q != null ? `${activeKpi.q.toFixed(2)}%` : '—'}
            caption={`${activeKpi?.tickets?.toLocaleString() ?? 0} tickets / ${activeKpi?.billed?.toLocaleString() ?? 0} services`}
            delta={getDeltaInfo(activeKpi?.q, prevKpi?.q, false)}
            tooltipTitle="Quality Ratio (Q)"
            tooltipText={
              meta?.definitions?.q ||
              'Tickets created in month ÷ billed SD-WAN services in NF that month × 100. Lower is better.'
            }
          />

          {/* Card 2: TTR 3h */}
          <KpiCard
            title="TTR 3h"
            value={activeKpi?.ttr3 != null ? `${activeKpi.ttr3.toFixed(1)}%` : '—'}
            caption={
              activeKpi?.ttr3 != null && activeKpi?.closed
                ? `${Math.round((activeKpi.closed * activeKpi.ttr3) / 100)} of ${activeKpi.closed} closed`
                : '≤ 3 hours'
            }
            delta={getDeltaInfo(activeKpi?.ttr3, prevKpi?.ttr3, true)}
            tooltipTitle="Time To Resolve ≤ 3h"
            tooltipText={
              meta?.definitions?.ttr ||
              '% of tickets closed in month resolved within 3 hours. Higher is better.'
            }
          />

          {/* Card 3: TTR 6h */}
          <KpiCard
            title="TTR 6h"
            value={activeKpi?.ttr6 != null ? `${activeKpi.ttr6.toFixed(1)}%` : '—'}
            caption="≤ 6 hours"
            delta={getDeltaInfo(activeKpi?.ttr6, prevKpi?.ttr6, true)}
            tooltipTitle="Time To Resolve ≤ 6h"
            tooltipText="% of tickets closed in month resolved within 6 hours. Higher is better."
          />

          {/* Card 4: TTR 12h */}
          <KpiCard
            title="TTR 12h"
            value={activeKpi?.ttr12 != null ? `${activeKpi.ttr12.toFixed(1)}%` : '—'}
            caption="≤ 12 hours"
            delta={getDeltaInfo(activeKpi?.ttr12, prevKpi?.ttr12, true)}
            tooltipTitle="Time To Resolve ≤ 12h"
            tooltipText="% of tickets closed in month resolved within 12 hours. Higher is better."
          />

          {/* Card 5: TTR 24h */}
          <KpiCard
            title="TTR 24h"
            value={activeKpi?.ttr24 != null ? `${activeKpi.ttr24.toFixed(1)}%` : '—'}
            caption="≤ 24 hours"
            delta={getDeltaInfo(activeKpi?.ttr24, prevKpi?.ttr24, true)}
            tooltipTitle="Time To Resolve ≤ 24h"
            tooltipText="% of tickets closed in month resolved within 24 hours. Higher is better."
          />

          {/* Card 6: AG (Assurance Guarantee) */}
          <KpiCard
            title="AG"
            value={activeKpi?.ag != null ? `${activeKpi.ag.toFixed(1)}%` : '—'}
            caption={
              activeKpi?.closed != null && activeKpi?.reopened != null
                ? `${activeKpi.closed - activeKpi.reopened} of ${activeKpi.closed} not re-opened`
                : '30-day guarantee'
            }
            provisional={activeKpi?.agProvisional}
            delta={getDeltaInfo(activeKpi?.ag, prevKpi?.ag, true)}
            tooltipTitle="Assurance Guarantee (AG)"
            tooltipText={
              meta?.definitions?.ag ||
              '(closed − re-opened) ÷ closed, where re-opened = same SD-WAN service received another ticket within 30 days after resolution. Higher is better.'
            }
          />

          {/* Card 7: Uptime */}
          <KpiCard
            title="Uptime"
            value={activeKpi?.uptime != null ? `${activeKpi.uptime.toFixed(3)}%` : '—'}
            caption={`${activeKpi?.downtimeH != null ? Math.round(activeKpi.downtimeH).toLocaleString() : 0} h down / ${
              activeKpi?.hours && activeKpi?.billed
                ? Math.round(activeKpi.hours * activeKpi.billed).toLocaleString()
                : '—'
            } service-h`}
            delta={getDeltaInfo(activeKpi?.uptime, prevKpi?.uptime, true, 3)}
            tooltipTitle="SD-WAN Fleet Uptime"
            tooltipText={
              meta?.definitions?.uptime ||
              '(hours in month × billed services − downtime hours) ÷ (hours in month × billed services). Overlapping downtime counted once. Higher is better.'
            }
          />

          {/* Card 8: Open Tickets */}
          <KpiCard
            title="Open"
            value={activeKpi?.open != null ? activeKpi.open.toLocaleString() : '0'}
            caption="currently in progress"
            delta={getDeltaInfo(activeKpi?.open, prevKpi?.open, false, 0)}
            tooltipTitle="Open Trouble Tickets"
            tooltipText="Tickets currently unresolved and in progress."
          />
        </div>

        {/* 3. Trend Section: TTR/AG Line Chart & Q Bar Chart */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left (col-span-7): TTR 3/6/12/24 and AG Line Chart (0-100% axis) */}
          <div className="col-span-12 lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  TTR & Assurance Guarantee (AG) Trend
                </h2>
                <p className="text-[11px] text-slate-500">
                  Monthly resolution speed & 30-day reliability rates (0–100%)
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" />
                  TTR 3h
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  TTR 6h
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                  TTR 12h
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  TTR 24h
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  AG
                </span>
              </div>
            </div>

            {/* SVG Line Chart */}
            <div className="w-full h-56 pt-2">
              <TtrAgLineChart data={monthlyTrend} selectedMonth={currentMonth} onSelectMonth={setSelectedMonth} />
            </div>
          </div>

          {/* Right (col-span-5): Q (%) Bar Chart */}
          <div className="col-span-12 lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  Quality Ratio (Q) per Month
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tickets created ÷ billed services × 100 (Lower is better)
                </p>
              </div>
            </div>

            {/* SVG Bar Chart */}
            <div className="w-full h-56 pt-2">
              <QBarChart data={monthlyTrend} selectedMonth={currentMonth} onSelectMonth={setSelectedMonth} />
            </div>
          </div>
        </div>

        {/* 4. "By Customer" Table for Selected Month */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Assurance by Customer · {formatMonthLabel(currentMonth)}
              </h2>
              <p className="text-[11px] text-slate-500">
                Click any customer row to filter the entire view
              </p>
            </div>

            {selectedCustomer !== 'ALL' && (
              <button
                onClick={() => setSelectedCustomer('ALL')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                Reset to All Customers
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleCustSort('group')}
                    className="px-3.5 py-2.5 cursor-pointer hover:text-slate-900 min-w-[200px]"
                  >
                    <div className="flex items-center gap-1">
                      Customer
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('billed')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Billed
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('tickets')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Tickets
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('q')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Q (%)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('closed')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Closed
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('ttr3')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      TTR 3h
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('ttr6')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      TTR 6h
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('ttr12')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      TTR 12h
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('ttr24')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      TTR 24h
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('ag')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      AG (%)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('downtimeH')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Down (h)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('uptime')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Uptime (%)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleCustSort('open')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Open
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                      No customer breakdown recorded for {formatMonthLabel(currentMonth)}.
                    </td>
                  </tr>
                ) : (
                  sortedCustomers.map(row => {
                    const isSelected = selectedCustomer === row.group;

                    return (
                      <tr
                        key={row.group}
                        onClick={() =>
                          setSelectedCustomer(prev => (prev === row.group ? 'ALL' : row.group || 'ALL'))
                        }
                        className={`hover:bg-slate-50 transition cursor-pointer ${
                          isSelected ? 'bg-blue-50/70 font-semibold' : ''
                        }`}
                      >
                        <td className="px-3.5 py-2 text-slate-900 font-medium truncate max-w-[240px]">
                          {row.group || 'Unknown'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.billed?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {row.tickets?.toLocaleString() ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-blue-700 font-medium">
                          {row.q != null ? `${row.q.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {row.closed?.toLocaleString() ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.ttr3 != null ? `${row.ttr3.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.ttr6 != null ? `${row.ttr6.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.ttr12 != null ? `${row.ttr12.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.ttr24 != null ? `${row.ttr24.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          <span className="inline-flex items-center gap-1 justify-end">
                            {row.ag != null ? `${row.ag.toFixed(1)}%` : '—'}
                            {row.agProvisional && (
                              <span className="text-[9.5px] px-1 py-0.1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                prov
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {row.downtimeH != null ? row.downtimeH.toFixed(1) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">
                          {row.uptime != null ? `${row.uptime.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                          {row.open?.toLocaleString() ?? 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Tickets List Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Title Row + Status Chips + Export */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Trouble Tickets ({sortedTickets.length.toLocaleString()})
              </h2>
              <p className="text-[11px] text-slate-500">
                In-scope tickets (C_SDWAN, C_REQ, C_PROACTIVE) since Jan 2026 plus all active open
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                {(['ALL', 'OPEN', 'CLOSED', 'REOPENED'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTicketStatusTab(tab)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      ticketStatusTab === tab
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'ALL'
                      ? 'All'
                      : tab === 'OPEN'
                      ? 'Open'
                      : tab === 'CLOSED'
                      ? 'Closed'
                      : 'Re-opened'}
                  </button>
                ))}
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCsv}
                disabled={isExporting || sortedTickets.length === 0}
                className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Export all matching tickets to CSV"
              >
                <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce text-blue-600' : 'text-slate-500'}`} />
                <span>
                  {isExporting ? 'Preparing…' : `Export CSV · ${sortedTickets.length.toLocaleString()} rows`}
                </span>
              </button>
            </div>
          </div>

          {/* Ticket Filter Bar (Search + Month + From/To Date + Category + Clear) */}
          <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center gap-2.5 text-xs">
            {/* Search Box */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search ticket, SID, customer..."
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {ticketSearch && (
                <button
                  onClick={() => setTicketSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Ticket Month Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Month:</span>
              <select
                value={ticketMonthFilter}
                onChange={e => handleTicketMonthSelect(e.target.value)}
                className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All months</option>
                {ticketMonths.map(m => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* From / To Date Inputs */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={ticketDateFrom}
                onChange={e => handleDateFromChange(e.target.value)}
                className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={ticketDateTo}
                onChange={e => handleDateToChange(e.target.value)}
                className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Category:</span>
              <select
                value={ticketCategory}
                onChange={e => setTicketCategory(e.target.value)}
                className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All categories</option>
                <option value="C_SDWAN">C_SDWAN</option>
                <option value="C_REQ">C_REQ</option>
                <option value="C_PROACTIVE">Proactive (C_PROACTIVE)</option>
              </select>
            </div>

            {/* Clear Button */}
            {(ticketSearch ||
              ticketStatusTab !== 'ALL' ||
              ticketMonthFilter !== 'ALL' ||
              ticketDateFrom ||
              ticketDateTo ||
              ticketCategory !== 'ALL') && (
              <button
                onClick={handleClearTicketFilters}
                className="h-8 px-2.5 inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Tickets Scroll Table (h-[520px]) */}
          <div className="h-[520px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200 shadow-2xs text-slate-600 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleTicketSort('id')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[140px]"
                  >
                    <div className="flex items-center gap-1">
                      Ticket
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('status')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('created')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      Created (WIB)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('resolved')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      Resolved (WIB)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('ttrH')}
                    className="px-3 py-2.5 text-right cursor-pointer hover:text-slate-900 min-w-[80px]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      TTR (h)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('customer')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[160px]"
                  >
                    <div className="flex items-center gap-1">
                      Customer
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('svc')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[130px]"
                  >
                    <div className="flex items-center gap-1">
                      SD-WAN SID
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('witel')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Witel
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('category')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Category
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('solution')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900 min-w-[200px]"
                  >
                    <div className="flex items-center gap-1">
                      Solution
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleTicketSort('reopened')}
                    className="px-3 py-2.5 cursor-pointer hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      Re-opened
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-slate-500">
                      No matching trouble tickets found.
                    </td>
                  </tr>
                ) : (
                  sortedTickets.map(t => {
                    const isOpen = t.status?.toUpperCase() === 'OPEN' || !t.resolved;

                    // TTR coloring rule: amber when > 3h, red when > 24h
                    let ttrColor = 'text-slate-700';
                    if (t.ttrH != null) {
                      if (t.ttrH > 24) ttrColor = 'text-rose-700 font-bold';
                      else if (t.ttrH > 3) ttrColor = 'text-amber-700 font-semibold';
                    }

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Ticket ID + proactive tag */}
                        <td className="px-3 py-2 font-mono font-medium text-blue-600">
                          <span className="flex items-center gap-1.5">
                            {t.id}
                            {t.proactive && (
                              <span
                                className="text-[10px] font-semibold px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200"
                                title="Proactive SQM-generated ticket"
                              >
                                proactive
                              </span>
                            )}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${
                              isOpen
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {t.status || (isOpen ? 'OPEN' : 'CLOSED')}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-3 py-2 text-slate-600 tabular-nums">
                          {t.created || '—'}
                        </td>

                        {/* Resolved */}
                        <td className="px-3 py-2 text-slate-600 tabular-nums">
                          {t.resolved || (isOpen ? <span className="text-amber-600 italic">In progress</span> : '—')}
                        </td>

                        {/* TTR (h) */}
                        <td className={`px-3 py-2 text-right tabular-nums ${ttrColor}`}>
                          {t.ttrH != null ? `${t.ttrH.toFixed(1)} h` : '—'}
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[170px]" title={t.customer}>
                          {t.customer || '—'}
                        </td>

                        {/* SD-WAN SID */}
                        <td className="px-3 py-2 font-mono text-slate-700" title={`Ticketed: ${t.sid || '—'}`}>
                          {t.svc || t.sid || '—'}
                        </td>

                        {/* Witel */}
                        <td className="px-3 py-2 text-slate-600">
                          {t.witel || '—'}
                        </td>

                        {/* Category */}
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-mono">
                            {t.category || '—'}
                          </span>
                        </td>

                        {/* Solution */}
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[240px]" title={t.solution || t.headline}>
                          {t.solution || t.headline || '—'}
                        </td>

                        {/* Re-opened with tooltip & provisional */}
                        <td className="px-3 py-2">
                          {t.reopened ? (
                            <span
                              className="inline-flex items-center gap-1 font-semibold text-rose-700"
                              title={t.nextTicket ? `Next ticket: ${t.nextTicket}` : 'Re-opened within 30 days'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              {t.nextTicket && <span className="font-mono text-[10px]">{t.nextTicket}</span>}
                              {t.provisional && (
                                <span className="text-[9.5px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  prov
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Range */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
            <span>
              Showing <strong className="text-slate-900">{sortedTickets.length.toLocaleString()}</strong> of{' '}
              <strong className="text-slate-900">{data?.tickets?.length?.toLocaleString() ?? 0}</strong> tickets
              {ticketDateFrom || ticketDateTo ? (
                <>
                  {' '}· created{' '}
                  <strong className="text-slate-800">
                    {ticketDateFrom || 'start'} → {ticketDateTo || 'latest'}
                  </strong>
                </>
              ) : ticketMonthFilter !== 'ALL' ? (
                <> · month <strong className="text-slate-800">{formatMonthLabel(ticketMonthFilter)}</strong></>
              ) : null}
            </span>

            <span className="text-[11px] text-slate-400">
              Times in WIB (Asia/Jakarta)
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Subcomponent: KPI Card with Delta & Info Tooltip
// ------------------------------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  caption: string;
  provisional?: boolean;
  delta?: { text: string; isBetter: boolean; symbol: string; desc: string } | null;
  tooltipTitle: string;
  tooltipText: string;
}

function KpiCard({
  title,
  value,
  caption,
  provisional,
  delta,
  tooltipTitle,
  tooltipText,
}: KpiCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative group hover:border-slate-300 transition">
      {/* Title + ⓘ Info Icon */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-1.5">
          <span>{title}</span>
          {provisional && (
            <span
              className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold"
              title="Some tickets closed less than 30 days ago; AG rate can still decline."
            >
              provisional
            </span>
          )}
        </div>

        <div
          className="relative cursor-pointer text-slate-400 hover:text-slate-600"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info className="w-3.5 h-3.5" />
          {showTooltip && (
            <div className="absolute right-0 top-5 w-64 bg-slate-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-30 font-normal leading-relaxed pointer-events-none">
              <p className="font-semibold text-white mb-1">{tooltipTitle}</p>
              <p className="text-slate-300">{tooltipText}</p>
            </div>
          )}
        </div>
      </div>

      {/* Big Number */}
      <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1 tracking-tight">
        {value}
      </div>

      {/* Raw counts caption + Delta vs previous month */}
      <div className="mt-1 flex flex-col gap-0.5">
        <span className="text-[11px] text-slate-500 truncate" title={caption}>
          {caption}
        </span>

        {delta && (
          <span
            className="text-[10.5px] text-slate-500 flex items-center gap-1 tabular-nums"
            title={delta.desc}
          >
            <span>{delta.symbol}</span>
            <span>{delta.text}</span>
            <span className="text-slate-400">vs prev mo</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Delta Calculator Helper
// ------------------------------------------------------------------------------------------------

function getDeltaInfo(
  current: number | null | undefined,
  previous: number | null | undefined,
  higherIsBetter = true,
  decimals = 1
) {
  if (current == null || previous == null || isNaN(current) || isNaN(previous)) {
    return null;
  }

  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) return null;

  const symbol = diff > 0 ? '▲' : '▼';
  const isBetter = higherIsBetter ? diff > 0 : diff < 0;
  const absText = Math.abs(diff).toFixed(decimals);
  const text = `${diff > 0 ? '+' : '-'}${absText}%`;
  const desc = `${text} vs previous month (${isBetter ? 'better' : 'worse'})`;

  return { text, isBetter, symbol, desc };
}

// ------------------------------------------------------------------------------------------------
// Subcomponent: TTR / AG Line Chart (SVG, 0-100% axis)
// ------------------------------------------------------------------------------------------------

interface TtrAgLineChartProps {
  data: MonthlyAssurance[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
}

function TtrAgLineChart({ data, selectedMonth, onSelectMonth }: TtrAgLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400">
        No monthly trend data available
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = 200;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const pointsCount = data.length;
  const getX = (idx: number) => {
    if (pointsCount <= 1) return padLeft + chartW / 2;
    return padLeft + (idx / (pointsCount - 1)) * chartW;
  };

  // Y is 0% to 100%
  const getY = (val: number | null | undefined) => {
    if (val == null) return null;
    const clamped = Math.max(0, Math.min(100, val));
    return padTop + chartH - (clamped / 100) * chartH;
  };

  // Build path strings for each series
  const buildPath = (key: 'ttr3' | 'ttr6' | 'ttr12' | 'ttr24' | 'ag') => {
    let d = '';
    data.forEach((row, i) => {
      const val = row[key];
      const y = getY(val);
      if (y != null) {
        const x = getX(i);
        if (!d) d = `M ${x} ${y}`;
        else d += ` L ${x} ${y}`;
      }
    });
    return d;
  };

  const pathTtr3 = buildPath('ttr3');
  const pathTtr6 = buildPath('ttr6');
  const pathTtr12 = buildPath('ttr12');
  const pathTtr24 = buildPath('ttr24');
  const pathAg = buildPath('ag');

  return (
    <div className="w-full h-full relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines: 0%, 25%, 50%, 75%, 100% */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = padTop + chartH - (pct / 100) * chartH;
          return (
            <g key={pct}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={pct === 0 || pct === 100 ? undefined : '3,3'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                fontSize={9}
                textAnchor="end"
                fill="#94a3b8"
                fontFamily="sans-serif"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Vertical lines and month labels */}
        {data.map((row, i) => {
          const x = getX(i);
          const isSelected = row.month === selectedMonth;

          return (
            <g key={row.month} onClick={() => onSelectMonth(row.month)} className="cursor-pointer group">
              <line
                x1={x}
                y1={padTop}
                x2={x}
                y2={padTop + chartH}
                stroke={isSelected ? '#3b82f6' : '#f1f5f9'}
                strokeWidth={isSelected ? 1.5 : 1}
              />
              <text
                x={x}
                y={svgHeight - 6}
                fontSize={9}
                textAnchor="middle"
                fontWeight={isSelected ? 'bold' : 'normal'}
                fill={isSelected ? '#1e293b' : '#64748b'}
              >
                {String(row.month || '').substring(5)}
              </text>
            </g>
          );
        })}

        {/* Line paths */}
        <path d={pathTtr3} fill="none" stroke="#8b5cf6" strokeWidth={2} />
        <path d={pathTtr6} fill="none" stroke="#3b82f6" strokeWidth={2} />
        <path d={pathTtr12} fill="none" stroke="#0d9488" strokeWidth={2} />
        <path d={pathTtr24} fill="none" stroke="#10b981" strokeWidth={2} />
        <path d={pathAg} fill="none" stroke="#f59e0b" strokeWidth={2.5} />

        {/* Dots for the active selected month */}
        {data.map((row, i) => {
          if (row.month !== selectedMonth) return null;
          const x = getX(i);

          return (
            <g key={row.month}>
              {row.ttr3 != null && (
                <circle cx={x} cy={getY(row.ttr3)!} r={4} fill="#8b5cf6" stroke="#fff" strokeWidth={2} />
              )}
              {row.ttr6 != null && (
                <circle cx={x} cy={getY(row.ttr6)!} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
              )}
              {row.ttr12 != null && (
                <circle cx={x} cy={getY(row.ttr12)!} r={4} fill="#0d9488" stroke="#fff" strokeWidth={2} />
              )}
              {row.ttr24 != null && (
                <circle cx={x} cy={getY(row.ttr24)!} r={4} fill="#10b981" stroke="#fff" strokeWidth={2} />
              )}
              {row.ag != null && (
                <circle cx={x} cy={getY(row.ag)!} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Subcomponent: Q (%) Bar Chart
// ------------------------------------------------------------------------------------------------

interface QBarChartProps {
  data: MonthlyAssurance[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
}

function QBarChart({ data, selectedMonth, onSelectMonth }: QBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400">
        No monthly Q data available
      </div>
    );
  }

  // Max Q value to scale bars cleanly (min 5%)
  const maxQ = Math.max(5, ...data.map(d => d.q || 0)) * 1.15;

  const svgWidth = 400;
  const svgHeight = 200;
  const padLeft = 35;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 25;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const barCount = data.length;
  const slotWidth = chartW / barCount;
  const barWidth = Math.min(28, slotWidth * 0.65);

  return (
    <div className="w-full h-full relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        {[0, Math.round(maxQ / 2), Math.round(maxQ)].map((val, idx) => {
          const y = padTop + chartH - (val / maxQ) * chartH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={val === 0 ? undefined : '3,3'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={y + 3.5}
                fontSize={9}
                textAnchor="end"
                fill="#94a3b8"
                fontFamily="sans-serif"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((row, i) => {
          const qVal = row.q || 0;
          const barH = (qVal / maxQ) * chartH;
          const x = padLeft + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = padTop + chartH - barH;
          const isSelected = row.month === selectedMonth;

          return (
            <g
              key={row.month}
              onClick={() => onSelectMonth(row.month)}
              className="cursor-pointer group"
            >
              {/* Bar rectangle */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barH)}
                rx={3}
                fill={isSelected ? '#2563eb' : '#93c5fd'}
                className="group-hover:fill-blue-700 transition"
              />

              {/* Value on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 4}
                fontSize={8.5}
                textAnchor="middle"
                fontWeight={isSelected ? 'bold' : 'normal'}
                fill={isSelected ? '#1e40af' : '#475569'}
              >
                {qVal.toFixed(1)}%
              </text>

              {/* X Axis Month Label */}
              <text
                x={x + barWidth / 2}
                y={svgHeight - 6}
                fontSize={9}
                textAnchor="middle"
                fontWeight={isSelected ? 'bold' : 'normal'}
                fill={isSelected ? '#1e293b' : '#64748b'}
              >
                {String(row.month || '').substring(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
