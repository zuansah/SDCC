import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, getBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { RefreshCw, Download, AlertTriangle, ChevronDown, Check, Server, Activity, Database, AlertCircle, CloudOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -- types --
type TileKey = 'total' | 'up' | 'down' | 'critical' | 'license';

interface Device {
  name?: string; serial?: string; site?: string; model?: string; version?: string;
  id: string; ip?: string; up?: boolean;
  state?: string; status?: string; tenant?: string;
  critical?: boolean; why?: string[];
  downFor?: string; downHours?: number; downSince?: string;
  before?: string; lastContact?: string;
  tunUp?: number; tunTotal?: number; tunDown?: number;
  loss?: number; latency?: number; jitter?: number; score?: number;
  configSynced?: boolean;
}

interface Tenant {
  name: string;
  devices: number;
}

interface Controller {
  key: string; label: string; ownership: string; host: string;
  kind: string; platform: string; status: string; reason?: string;
  lastPoll: string;
  tiles: Record<TileKey, number>;
  license: any;
  tenants: Tenant[];
  tenantsLoadedAt?: string;
  devices: Device[];
}

interface Meta {
  generatedAt: string; source: string;
  totals: Record<string, number>;
  byOwnership: Record<string, Record<string, number>>;
  thresholds: any;
}

interface DataPayload {
  meta: Meta;
  controllers: Controller[];
}

export default function ControllerView() {
  const [data, setData] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const [filterScope, setFilterScope] = useState<string>(() => {
    return localStorage.getItem('controllerFilter') || 'All';
  });

  const fetchData = async () => {
    try {
      const storageRef = ref(storage, "controllers/live.json");
      let text = '';
      try {
        const bytes = await getBytes(storageRef, 15 * 1024 * 1024);
        text = new TextDecoder('utf-8').decode(bytes);
        const payload: DataPayload = JSON.parse(text);
        if (payload?.controllers) {
          payload.controllers.forEach((c) => {
            if (c.reason && (c.reason.includes('HTTPSConnectionPool') || c.reason.includes('ConnectTimeoutError') || c.reason.includes('urllib3') || c.reason.includes('Max retries'))) {
              c.reason = '';
            }
          });
        }
        setData(payload);
        setError('');
      } catch (bytesErr) {
        try {
          const url = await getDownloadURL(storageRef);
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const payload: DataPayload = await res.json();
            if (payload?.controllers) {
              payload.controllers.forEach((c) => {
                if (c.reason && (c.reason.includes('HTTPSConnectionPool') || c.reason.includes('ConnectTimeoutError') || c.reason.includes('urllib3') || c.reason.includes('Max retries'))) {
                  c.reason = '';
                }
              });
            }
            setData(payload);
            setError('');
          }
        } catch (fetchErr: any) {
          console.warn('Controller live data not directly accessible from storage:', fetchErr?.message);
        }
      }
      setLastFetch(new Date());
    } catch (err: any) {
      console.warn('Error fetching controllers:', err?.message);
      if (!data) {
        setError(err.message || 'Error fetching controllers');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('controllerFilter', filterScope);
  }, [filterScope]);

  const { visibleControllers, summary } = useMemo(() => {
    if (!data) return { visibleControllers: [], summary: null };
    let filtered = data.controllers;
    let sum = data.meta.totals;
    let desc = `across ${data.controllers.length} of ${data.controllers.length} controllers`;

    if (filterScope !== 'All') {
      if (filterScope.startsWith('GROUP:')) {
        const groupName = filterScope.substring(6);
        filtered = data.controllers.filter(c => c.ownership === groupName);
        sum = data.meta.byOwnership[groupName] || { devices: 0, up: 0, down: 0, critical: 0, license: 0, controllers: 0 };
        desc = `across ${filtered.length} of ${data.controllers.length} controllers in ${groupName}`;
      } else {
        filtered = data.controllers.filter(c => c.key === filterScope);
        if (filtered.length > 0) {
          sum = {
            devices: filtered[0].tiles.total,
            up: filtered[0].tiles.up,
            down: filtered[0].tiles.down,
            critical: filtered[0].tiles.critical,
            license: filtered[0].tiles.license || 0,
            controllers: 1
          };
          desc = `showing ${filtered[0].label}`;
        }
      }
    }

    return { visibleControllers: filtered, summary: { sum, desc } };
  }, [data, filterScope]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Activity className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p>Fetching latest controller telemetry...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 z-10 relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Controller Health
              {data?.meta?.source === 'cache' && (
                <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                  <AlertTriangle className="w-3 h-3" />
                  Cached Data
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {summary?.desc} 
              {lastFetch && ` · Last checked: ${lastFetch.toLocaleTimeString()}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {error && <span className="text-red-500 text-sm font-medium">{error}</span>}
            <button onClick={fetchData} disabled={loading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            
            <FilterDropdown 
              data={data} 
              filterScope={filterScope} 
              setFilterScope={setFilterScope} 
            />
          </div>
        </div>

        {/* Fleet Header KPIs */}
        {summary && (
          <div className="grid grid-cols-5 gap-4">
            <KpiCard label="Total Devices" value={summary.sum.devices} />
            <KpiCard label="Total Up" value={summary.sum.up} color="text-emerald-600" />
            <KpiCard label="Total Down" value={summary.sum.down} color="text-rose-600" />
            <KpiCard label="Critical" value={summary.sum.critical} color="text-amber-600" />
            <KpiCard label="License" value={summary.sum.license} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && !data && (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {visibleControllers.map(controller => (
          <ControllerCard key={controller.key} controller={controller} />
        ))}
        
        {!loading && visibleControllers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200 shadow-sm">
            <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No controllers found</h3>
            <p className="text-slate-500 text-sm">Adjust your filters to see more results.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "text-slate-900" }: { label: string, value: number, color?: string }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-2xl font-bold mt-1", color)}>
        {value != null ? value.toLocaleString() : '—'}
      </span>
    </div>
  );
}

function FilterDropdown({ data, filterScope, setFilterScope }: { data: DataPayload | null, filterScope: string, setFilterScope: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!data) return null;

  const groups = Object.keys(data.meta.byOwnership || {});

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span>{filterScope === 'All' ? 'All controllers' : filterScope.startsWith('GROUP:') ? filterScope.substring(6) : data.controllers.find(c => c.key === filterScope)?.label || 'Filter'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 max-h-96 overflow-y-auto">
          <button
            onClick={() => { setFilterScope('All'); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center justify-between"
          >
            All controllers ({data.controllers.length})
            {filterScope === 'All' && <Check className="w-4 h-4 text-blue-600" />}
          </button>
          
          {groups.map(group => {
            const groupMeta = data.meta.byOwnership[group];
            const groupControllers = data.controllers.filter(c => c.ownership === group);
            return (
              <div key={group}>
                <div className="bg-slate-50 border-y border-slate-100 mt-1">
                  <button
                    onClick={() => { setFilterScope(`GROUP:${group}`); setOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-900 font-semibold hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>{group} <span className="text-slate-500 font-normal ml-1">· {groupMeta.controllers} controllers · {groupMeta.devices?.toLocaleString()} devices</span></span>
                    {filterScope === `GROUP:${group}` && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                </div>
                {groupControllers.map(c => (
                  <button
                    key={c.key}
                    onClick={() => { setFilterScope(c.key); setOpen(false); }}
                    className="w-full text-left px-4 py-2 pl-8 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between"
                  >
                    <span>{c.label} <span className="text-slate-400 ml-1">· {c.tiles.total?.toLocaleString()}</span></span>
                    {filterScope === c.key && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControllerCard({ controller }: { controller: Controller; key?: React.Key }) {
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [tenantOpen, setTenantOpen] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tenantRef.current && !tenantRef.current.contains(event.target as Node)) {
        setTenantOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasTenants = controller.tenants && controller.tenants.length > 1;

  const toggleTenant = (t: string) => {
    if (selectedTenants.includes(t)) {
      setSelectedTenants(prev => prev.filter(x => x !== t));
    } else {
      setSelectedTenants(prev => [...prev, t]);
    }
  };

  const filteredDevices = useMemo(() => {
    if (selectedTenants.length === 0) return controller.devices;
    return controller.devices.filter(d => d.tenant && selectedTenants.includes(d.tenant));
  }, [controller.devices, selectedTenants]);

  // Recompute tiles if tenant filter applied
  const tiles = useMemo(() => {
    if (selectedTenants.length === 0) return controller.tiles;
    return {
      total: filteredDevices.length,
      up: filteredDevices.filter(d => d.up).length,
      down: filteredDevices.filter(d => !d.up).length,
      critical: filteredDevices.filter(d => d.critical).length,
      license: controller.tiles.license // Not recomputed per tenant for now as it might not map easily
    };
  }, [filteredDevices, controller.tiles, selectedTenants]);

  const handleCsvDownload = () => {
    if (filteredDevices.length === 0) return;
    const headers = ["Identity", "Status", "Tenant", "Site", "Model", "Down For", "Before", "Critical", "Why"];
    const rows = filteredDevices.map(d => [
      d.name || d.serial || d.id || '',
      d.up ? 'Up' : 'Down',
      d.tenant || '',
      d.site || '',
      d.model || '',
      d.downFor || '',
      d.before || '',
      d.critical ? 'Yes' : 'No',
      (d.why || []).join('; ')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${controller.key}-devices.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isStale = controller.status !== 'ok';

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800">{controller.label}</h2>
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full border",
              controller.ownership === 'IBL Procurement' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"
            )}>
              {controller.ownership}
            </span>
            {isStale && (
              <span className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                {controller.status}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span>{controller.platform}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasTenants && (
            <div className="relative" ref={tenantRef}>
              <button 
                onClick={() => setTenantOpen(!tenantOpen)}
                className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>{selectedTenants.length === 0 ? 'All Tenants' : `${selectedTenants.length} Selected`}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {tenantOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 max-h-64 overflow-y-auto">
                  <div 
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 border-b border-slate-100"
                    onClick={() => { setSelectedTenants([]); setTenantOpen(false); }}
                  >
                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center", selectedTenants.length === 0 ? "bg-blue-600 border-blue-600" : "border-slate-300")}>
                      {selectedTenants.length === 0 && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-700">All Tenants</span>
                  </div>
                  {controller.tenants.map(t => (
                    <div 
                      key={t.name}
                      className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                      onClick={() => toggleTenant(t.name)}
                    >
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center", selectedTenants.includes(t.name) ? "bg-blue-600 border-blue-600" : "border-slate-300")}>
                        {selectedTenants.includes(t.name) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-slate-700 truncate" title={t.name}>{t.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{t.devices}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={handleCsvDownload} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Download CSV">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 bg-white grid grid-cols-5 gap-3">
        <TileButton label="Total Devices" value={tiles.total} active={activeTile === 'total'} onClick={() => setActiveTile(activeTile === 'total' ? null : 'total')} />
        <TileButton label="Total Up" value={tiles.up} active={activeTile === 'up'} onClick={() => setActiveTile(activeTile === 'up' ? null : 'up')} color="text-emerald-600" />
        <TileButton label="Total Down" value={tiles.down} active={activeTile === 'down'} onClick={() => setActiveTile(activeTile === 'down' ? null : 'down')} color="text-rose-600" />
        <TileButton label="Critical" value={tiles.critical} active={activeTile === 'critical'} onClick={() => setActiveTile(activeTile === 'critical' ? null : 'critical')} color="text-amber-600" />
        <TileButton label="License" value={tiles.license} active={activeTile === 'license'} onClick={() => setActiveTile(activeTile === 'license' ? null : 'license')} />
      </div>

      {activeTile && (
        <div className="border-t border-slate-100 bg-white">
          <DeviceList type={activeTile} devices={filteredDevices} kind={controller.kind} />
        </div>
      )}
    </div>
  );
}

function TileButton({ label, value, active, onClick, color = "text-slate-900" }: { label: string, value: number | null, active: boolean, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border text-left transition-all",
        active ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={cn("text-xl font-bold mt-1", color)}>
        {value != null ? value.toLocaleString() : '—'}
      </div>
    </button>
  );
}

function DeviceList({ type, devices, kind }: { type: TileKey, devices: Device[], kind: string }) {
  const isVelo = kind === 'velocloud';

  const list = useMemo(() => {
    let res = [...devices];
    if (type === 'up') res = res.filter(d => d.up);
    if (type === 'down') res = res.filter(d => !d.up);
    if (type === 'critical') res = res.filter(d => d.critical);
    
    if (type === 'down') {
      res.sort((a, b) => (b.downHours || 0) - (a.downHours || 0));
    }
    return res;
  }, [devices, type]);

  if (list.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500">
        <Check className="w-8 h-8 text-slate-300 mb-2" />
        <p>No devices in this category.</p>
        {type === 'critical' && !isVelo && (
          <p className="text-xs mt-1 text-slate-400">Note: Missing metrics for this platform type.</p>
        )}
      </div>
    );
  }

  const renderMetric = (val: number | undefined, suffix: string = '') => {
    if (!isVelo || val == null) return <span className="text-slate-300">—</span>;
    return <span>{val}{suffix}</span>;
  };

  return (
    <div className="h-[420px] overflow-y-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-500">Device</th>
            {type === 'down' ? (
              <>
                <th className="px-4 py-3 font-medium text-slate-500">Down For</th>
                <th className="px-4 py-3 font-medium text-slate-500">Last Contact</th>
                <th className="px-4 py-3 font-medium text-slate-500">Before</th>
                <th className="px-4 py-3 font-medium text-slate-500">Site</th>
              </>
            ) : type === 'critical' ? (
              <>
                <th className="px-4 py-3 font-medium text-slate-500">Issue</th>
                <th className="px-4 py-3 font-medium text-slate-500">Loss</th>
                <th className="px-4 py-3 font-medium text-slate-500">Latency</th>
                <th className="px-4 py-3 font-medium text-slate-500">Jitter</th>
                <th className="px-4 py-3 font-medium text-slate-500">Tunnels</th>
              </>
            ) : (
              <>
                <th className="px-4 py-3 font-medium text-slate-500">State</th>
                <th className="px-4 py-3 font-medium text-slate-500">Model</th>
                <th className="px-4 py-3 font-medium text-slate-500">Tunnels</th>
                <th className="px-4 py-3 font-medium text-slate-500">Loss / Latency</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((d, i) => (
            <tr key={d.id || i} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{d.name || d.serial || d.id}</div>
                {d.tenant && <div className="text-xs text-slate-500">{d.tenant}</div>}
              </td>
              
              {type === 'down' ? (
                <>
                  <td className="px-4 py-3 text-rose-600 font-medium">{d.downFor || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{d.lastContact || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={d.before || 'not observed — first seen already down'}>
                    {d.before || <span className="italic text-slate-400">not observed — first seen already down</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.site || '—'}</td>
                </>
              ) : type === 'critical' ? (
                <>
                  <td className="px-4 py-3">
                    {(d.why || []).map((w, j) => (
                      <div key={j} className="text-amber-700 text-xs flex items-center gap-1 bg-amber-50 rounded px-2 py-0.5 w-fit mb-1 last:mb-0 border border-amber-100">
                        <AlertCircle className="w-3 h-3" />
                        {w}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{renderMetric(d.loss, '%')}</td>
                  <td className="px-4 py-3 text-slate-600">{renderMetric(d.latency, 'ms')}</td>
                  <td className="px-4 py-3 text-slate-600">{renderMetric(d.jitter, 'ms')}</td>
                  <td className="px-4 py-3 text-slate-600">{d.tunUp != null ? `${d.tunUp}/${d.tunTotal}` : '—'}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                      d.up ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      {d.state || (d.up ? 'UP' : 'DOWN')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.model || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{d.tunUp != null ? `${d.tunUp}/${d.tunTotal}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {isVelo ? (
                      <span>{d.loss ?? 0}% / {d.latency ?? 0}ms</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
