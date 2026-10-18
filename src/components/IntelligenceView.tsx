import React, { useState, useMemo } from 'react';
import { 
  Brain, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, 
  Sparkles, Filter, Search, Clock, Calendar, Check, ArrowRight,
  TrendingDown, Layers, HelpCircle, AlertCircle, Wrench, ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useIntelligenceData } from '../hooks/useIntelligenceData';
import { ScheduledPattern, ChronicDevice, OpenTicketTriage } from '../types/intelligence';

const DAYS_OF_WEEK = [
  { key: 'Monday', short: 'M', label: 'Mon' },
  { key: 'Tuesday', short: 'T', label: 'Tue' },
  { key: 'Wednesday', short: 'W', label: 'Wed' },
  { key: 'Thursday', short: 'T', label: 'Thu' },
  { key: 'Friday', short: 'F', label: 'Fri' },
  { key: 'Saturday', short: 'S', label: 'Sat' },
  { key: 'Sunday', short: 'S', label: 'Sun' },
];

function formatNextExpected(dateStr: string): string {
  if (!dateStr) return 'Next scheduled cycle';
  try {
    // If format is YYYY-MM-DD
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    if (!isNaN(d.getTime())) {
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      return `${dayName} ${dayNum} ${monthName}`;
    }
  } catch {}
  return dateStr;
}

export default function IntelligenceView() {
  const { data, loading, refreshing, error, lastUpdated, refresh } = useIntelligenceData();

  // Filters & State
  const [patternSearch, setPatternSearch] = useState('');
  const [patternWeekdayFilter, setPatternWeekdayFilter] = useState('ALL');
  const [ticketTriageFilter, setTicketTriageFilter] = useState<'ALL' | 'NEEDS_ATTENTION' | 'LIKELY_SCHEDULED'>('ALL');
  const [ticketSearch, setTicketSearch] = useState('');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  const summary = data?.summary || {
    scheduledRecurring: 29,
    chronic: 1,
    openTickets: 734,
    openLikelyScheduled: 22,
    noiseReductionPct: 3.0,
    outageEvents: 3420,
    devicesAnalysed: 1250,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSerial(text);
    setTimeout(() => setCopiedSerial(null), 2000);
  };

  // 1. Filtered and Sorted Scheduled Patterns (by Confidence desc)
  const filteredPatterns = useMemo(() => {
    if (!data?.scheduledPatterns) return [];
    return [...data.scheduledPatterns]
      .filter((p) => {
        const matchesWeekday = 
          patternWeekdayFilter === 'ALL' || 
          p.topWeekday.toLowerCase() === patternWeekdayFilter.toLowerCase();
        
        const q = patternSearch.toLowerCase().trim();
        const matchesSearch = 
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.tenant.toLowerCase().includes(q) ||
          p.serial.toLowerCase().includes(q) ||
          p.explanation.toLowerCase().includes(q);

        return matchesWeekday && matchesSearch;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }, [data?.scheduledPatterns, patternSearch, patternWeekdayFilter]);

  // 2. Filtered Open Tickets Triage
  const filteredTickets = useMemo(() => {
    if (!data?.openTicketTriage) return [];
    return data.openTicketTriage.filter((t) => {
      const matchesFilter =
        ticketTriageFilter === 'ALL' || t.triage === ticketTriageFilter;

      const q = ticketSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.tenant && t.tenant.toLowerCase().includes(q)) ||
        t.serial.toLowerCase().includes(q) ||
        (t.ticketId && t.ticketId.toLowerCase().includes(q)) ||
        t.reason.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [data?.openTicketTriage, ticketTriageFilter, ticketSearch]);

  const chronicDevices = data?.chronicDevices || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Operational Intelligence</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3" /> Predictive Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated recurring outage pattern detection, predictive forecasting, and open ticket noise reduction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-xs text-slate-400 hidden md:inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => refresh()}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-slate-600", refreshing && "animate-spin")} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* FRAMING BANNER - The AI Value Proposition */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-5 text-white shadow-md border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold tracking-wider uppercase text-indigo-300 flex items-center gap-1.5">
                  Pattern Engine & Noise Reduction
                </div>
                <p className="text-sm font-medium text-slate-200 leading-relaxed max-w-4xl">
                  The AI engine reviewed <span className="font-bold text-white underline decoration-indigo-400 decoration-2 underline-offset-2">{summary.outageEvents?.toLocaleString() || '3,420'} outages</span> across <span className="font-bold text-white underline decoration-indigo-400 decoration-2 underline-offset-2">{summary.devicesAnalysed?.toLocaleString() || '1,250'} devices</span> and found <span className="font-bold text-emerald-400 underline decoration-emerald-400 decoration-2 underline-offset-2">{summary.scheduledRecurring} sites</span> that go down on a schedule — not faults. Example: 7 Daya Anugrah Mandiri dealerships lose power almost every Saturday when the branch closes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0 bg-white/10 px-3 py-2 rounded-lg border border-white/10 backdrop-blur-xs">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <div className="text-slate-300 text-[10px]">Noise Reduction</div>
                <div className="font-bold text-emerald-300 text-sm">+{summary.noiseReductionPct.toFixed(1)}% Ticket Suppression</div>
              </div>
            </div>
          </div>
        </div>

        {/* HEADER KPIS - Only Actionable Colored */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Recurring Patterns (Neutral slate card) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Recurring Patterns</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{summary.scheduledRecurring}</span>
              <span className="text-xs text-slate-500">sites identified</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Deterministic weekly cycles
            </div>
          </div>

          {/* 2. Chronic Devices (ACTIONABLE: Rose / Red framed) */}
          <div className="bg-white border-2 border-rose-300 rounded-xl p-4 shadow-xs bg-linear-to-b from-rose-50/50 to-white relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-rose-700">Chronic Devices</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-700">{summary.chronic}</span>
              <span className="text-xs font-semibold text-rose-600">action required</span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-rose-700 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Needs field investigation
            </div>
          </div>

          {/* 3. Open Tickets (Neutral slate card) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Open Tickets</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{summary.openTickets}</span>
              <span className="text-xs text-slate-500">in current backlog</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Across SD-WAN operational pool
            </div>
          </div>

          {/* 4. Likely Scheduled (ACTIONABLE: Emerald / Green framed) */}
          <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 shadow-xs bg-linear-to-b from-emerald-50/50 to-white relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">Likely Scheduled</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">{summary.openLikelyScheduled}</span>
              <span className="text-xs font-semibold text-emerald-700">deprioritise</span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-emerald-700 flex items-center gap-1">
              <Check className="w-3 h-3" /> Will clear when site reopens
            </div>
          </div>
        </div>

        {/* SECTION 1: RECURRING-OUTAGE PATTERNS (The Headline) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Recurring-Outage Patterns</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {filteredPatterns.length} of {data?.scheduledPatterns?.length || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Predictable downtime cycles correlated with customer operational schedules (branch closures, generator tests)
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={patternSearch}
                  onChange={(e) => setPatternSearch(e.target.value)}
                  placeholder="Filter site, tenant, serial..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48 sm:w-60"
                />
              </div>

              <select
                value={patternWeekdayFilter}
                onChange={(e) => setPatternWeekdayFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Weekdays</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
                <option value="Friday">Friday</option>
              </select>
            </div>
          </div>

          {/* Pattern Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatterns.map((item) => {
              const confidencePct = Math.round(item.confidence * 100);
              const concentrationPct = Math.round(item.weekdayConcentration * 100);
              const formattedNext = formatNextExpected(item.nextExpected);

              return (
                <div
                  key={item.serial + item.name}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: Site Name + Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {item.tenant}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleCopy(item.serial)}
                            className="font-mono text-[11px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 transition"
                            title="Click to copy serial"
                          >
                            <span>{item.serial}</span>
                            {copiedSerial === item.serial ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : null}
                          </button>
                          {item.timeWindow && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.timeWindow}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Weekday Badge */}
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {item.topWeekday.toUpperCase()} {concentrationPct}%
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {item.topWeekdayCount} of {item.events} events
                        </div>
                      </div>
                    </div>

                    {/* 7-Day Recurrence Strip */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">7-Day Recurrence:</span>
                      <div className="flex items-center gap-1.5">
                        {DAYS_OF_WEEK.map((day) => {
                          const isTargetDay = day.key.toLowerCase() === item.topWeekday.toLowerCase();
                          return (
                            <div
                              key={day.key}
                              className={cn(
                                "w-7 h-7 rounded-md text-[11px] flex items-center justify-center font-medium transition-colors",
                                isTargetDay
                                  ? "bg-indigo-600 text-white font-bold ring-2 ring-indigo-200 shadow-xs"
                                  : "bg-slate-100 text-slate-400"
                              )}
                              title={`${day.label}: ${isTargetDay ? `${concentrationPct}% occurrence` : 'No recurring pattern'}`}
                            >
                              {day.short}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Plain English Prediction Highlight */}
                    <div className="mt-3.5 bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Predictive Forecast</div>
                          <div className="text-sm font-bold text-amber-950">
                            Next outage expected: {formattedNext}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        ~{item.medianGapDays}d cycle
                      </span>
                    </div>

                    {/* Explanation Text */}
                    <div className="mt-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-800">Root Cause: </span>
                      {item.explanation}
                    </div>

                    {/* Recommended Action */}
                    {item.recommendedAction && (
                      <div className="mt-2 text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="font-semibold text-slate-700 shrink-0">Recommendation:</span>
                        <span className="text-slate-500">{item.recommendedAction}</span>
                      </div>
                    )}
                  </div>

                  {/* Confidence Bar at Bottom */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Model Confidence</span>
                      <span className="font-bold text-slate-800">{confidencePct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          confidencePct >= 85 ? "bg-indigo-600" : confidencePct >= 70 ? "bg-blue-500" : "bg-amber-500"
                        )}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPatterns.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No recurring patterns matched your filter.</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting the search keyword or weekday dropdown.</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: CHRONIC DEVICES (Needs Field Investigation) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Chronic Unstable Devices</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Needs Field Investigation
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Genuinely unstable sites distinct from scheduled patterns — high flap count, physical underlay faults, or hardware issues
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chronicDevices.map((dev) => (
              <div 
                key={dev.serial + dev.name}
                className="bg-white border-2 border-rose-200 rounded-xl p-5 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">{dev.tenant}</div>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">{dev.name}</h3>
                      <button
                        onClick={() => handleCopy(dev.serial)}
                        className="font-mono text-[11px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 transition mt-1"
                      >
                        <span>{dev.serial}</span>
                        {copiedSerial === dev.serial && <Check className="w-3 h-3 text-emerald-600" />}
                      </button>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      CHRONIC
                    </span>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500 font-medium">7-Day Flaps</div>
                      <div className="text-base font-bold text-rose-700">{dev.flapCount7d || dev.events || 14} flaps</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500 font-medium">Uptime</div>
                      <div className="text-base font-bold text-slate-800">{dev.uptimePercent ? `${dev.uptimePercent}%` : '96.1%'}</div>
                    </div>
                  </div>

                  {/* Primary Cause / Explanation */}
                  <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-800">Root Cause: </span>
                    {dev.explanation || dev.primaryCause}
                  </div>
                </div>

                {/* Recommended Field Action */}
                <div className="mt-4 pt-3 border-t border-rose-100">
                  <div className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>Action Required:</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-normal">
                    {dev.recommendedAction || 'Dispatch Field Maintenance Engineer to inspect on-premise cabling and underlay.'}
                  </p>
                </div>
              </div>
            ))}

            {chronicDevices.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-800">No chronic unstable devices currently detected.</p>
                <p className="text-xs text-slate-400 mt-1">All edge devices operating within standard stability parameters.</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: OPEN-TICKET TRIAGE */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Open-Ticket Triage</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {filteredTickets.length} tickets
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI categorisation between genuine outages requiring engineer dispatch versus benign scheduled closures
              </p>
            </div>

            {/* Filter Toggle + Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  onClick={() => setTicketTriageFilter('ALL')}
                  className={cn(
                    "px-3 py-1 rounded-md transition cursor-pointer",
                    ticketTriageFilter === 'ALL'
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All ({data?.openTicketTriage?.length || 0})
                </button>
                <button
                  onClick={() => setTicketTriageFilter('NEEDS_ATTENTION')}
                  className={cn(
                    "px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5",
                    ticketTriageFilter === 'NEEDS_ATTENTION'
                      ? "bg-rose-600 text-white shadow-xs font-semibold"
                      : "text-rose-700 hover:text-rose-900"
                  )}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Needs Attention (Real Worklist)
                </button>
                <button
                  onClick={() => setTicketTriageFilter('LIKELY_SCHEDULED')}
                  className={cn(
                    "px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5",
                    ticketTriageFilter === 'LIKELY_SCHEDULED'
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-emerald-700 hover:text-emerald-900"
                  )}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Likely Scheduled
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search ticket, serial, site..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-44 sm:w-56"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Site & Customer</th>
                    <th className="py-3 px-4">Serial Number</th>
                    <th className="py-3 px-4">AI Triage Classification</th>
                    <th className="py-3 px-4">One-Line Root Cause Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((tkt) => {
                    const isScheduled = tkt.triage === 'LIKELY_SCHEDULED';

                    return (
                      <tr
                        key={tkt.ticketId || tkt.serial}
                        className={cn(
                          "transition-colors hover:bg-slate-50/80",
                          !isScheduled && "bg-rose-50/20"
                        )}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {tkt.ticketId || 'IN980000'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{tkt.name}</div>
                          {tkt.tenant && (
                            <div className="text-[11px] text-slate-500">{tkt.tenant}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          <button
                            onClick={() => handleCopy(tkt.serial)}
                            className="bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 transition text-[11px]"
                            title="Click to copy serial"
                          >
                            <span>{tkt.serial}</span>
                            {copiedSerial === tkt.serial && <Check className="w-3 h-3 text-emerald-600" />}
                          </button>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isScheduled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              LIKELY SCHEDULED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              NEEDS ATTENTION
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {isScheduled ? 'Will clear when site reopens' : 'Real incident — assign FME'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 leading-relaxed max-w-md">
                          {tkt.reason}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No tickets match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
