import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from '../lib/firebase';
import { Search, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { useCici } from '../cici/context/CiciContext';

export interface Edge {
  serial: string;
  hostname: string;
  platform: 'CISCO' | 'VELO';
  model: string;
  tenant: string;
  sid?: string;
  siteId: string;
  systemIp: string;
  softwareVersion: string;
  address: string;
  branch: string;
  witel?: string;
  health: 'UP' | 'DOWN' | 'LONG DOWN';
  controllerState: string;
  lastContact: string;
  daysSinceContact?: number;
  licenseStatus: string;
  lat: number;
  lng: number;
  geoSource: 'Controller GPS' | 'Master enrichment';
  geoExact: boolean;
  precision: 'EXACT' | 'CITY' | 'APPROX';
  sharedCount: number;
}

interface Meta {
  generated: string;
  source: string;
  listedInController: number;
  listedInMaster: number;
  mapped: number;
  unmapped: number;
  byPlatform: Record<string, number>;
  byHealth: Record<string, number>;
  byHealthMapped: Record<string, number>;
  byGeoSource: Record<string, number>;
  byPrecision: Record<string, number>;
  exact: number;
  tenants: Record<string, number>;
}

const HEALTH_COLORS = {
  'UP': '#059669',
  'DOWN': '#D97706',
  'LONG DOWN': '#DC2626'
};

const HEALTH_ORDER = {
  'UP': 0,
  'DOWN': 1,
  'LONG DOWN': 2
};

export default function MonitoringView() {
  const { askCici } = useCici();
  const [edges, setEdges] = useState<Edge[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(['CISCO', 'VELO']));
  const [healths, setHealths] = useState<Set<string>>(new Set(['UP', 'DOWN', 'LONG DOWN']));
  const [showApprox, setShowApprox] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setNeedsAuth(false);
        setLoading(true);
        try {
          const mapDataModule = await import('../../fleet/map.json');
          const mapMetaModule = await import('../../fleet/map-meta.json');
          const fetchedEdges = mapDataModule.default || mapDataModule;
          const fetchedMeta = mapMetaModule.default || mapMetaModule;

          // Validation
          if (!Array.isArray(fetchedEdges) || fetchedEdges.length !== 2309) {
            throw new Error("Invalid edge array");
          }

          const validSerials = /^(FGL|FDO|FJC|VC0)/;
          const tenantSet = new Set();
          const metaTenants = Object.keys(fetchedMeta.tenants);

          for (const edge of fetchedEdges) {
            if (!validSerials.test(edge.serial)) throw new Error("Invalid serial");
            if (edge.platform !== 'CISCO' && edge.platform !== 'VELO') throw new Error("Invalid platform");
            if (edge.address.includes('Sample') || /^Branch \d+$/.test(edge.branch)) throw new Error("Sample address/branch");
            if (edge.softwareVersion === '1.0.0') throw new Error("Fake software version");
            tenantSet.add(edge.tenant);
          }

          if (tenantSet.size !== 15) throw new Error("Invalid tenant size");
          for (const t of Array.from(tenantSet)) {
            if (!metaTenants.includes(t as string)) throw new Error("Tenant absent from meta");
          }

          console.log(`Loaded ${fetchedEdges.length} edges. First serial: ${fetchedEdges[0].serial}`);

          setEdges(fetchedEdges);
          setMeta(fetchedMeta);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setError("Monitoring data unavailable: map.json could not be loaded. The map is intentionally blank rather than showing placeholder data.");
          setLoading(false);
        }
      } else {
        setNeedsAuth(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const tenantsList = useMemo(() => {
    if (!meta) return [];
    return Object.entries(meta.tenants).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  }, [meta]);

  const togglePlatform = (p: string) => {
    setPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleHealth = (h: string) => {
    setHealths(prev => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setTenantFilter('');
    setPlatforms(new Set(['CISCO', 'VELO']));
    setHealths(new Set(['UP', 'DOWN', 'LONG DOWN']));
    setShowApprox(true);
  };

  const filteredEdges = useMemo(() => {
    if (!edges) return [];
    const s = search.toLowerCase();
    
    // Filter
    let result = edges.filter(edge => {
      if (!showApprox && edge.precision !== 'EXACT') return false;
      if (!platforms.has(edge.platform)) return false;
      if (!healths.has(edge.health)) return false;
      if (tenantFilter && edge.tenant !== tenantFilter) return false;
      if (s) {
        if (![
          edge.serial,
          edge.hostname,
          edge.sid,
          edge.tenant,
          edge.branch,
          edge.siteId
        ].some(val => val && val.toLowerCase().includes(s))) {
          return false;
        }
      }
      return true;
    });

    // Sort for draw order: UP, DOWN, LONG DOWN, then EXACT last
    result.sort((a, b) => {
      if (HEALTH_ORDER[a.health] !== HEALTH_ORDER[b.health]) {
        return HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
      }
      const aExact = a.precision === 'EXACT' ? 1 : 0;
      const bExact = b.precision === 'EXACT' ? 1 : 0;
      return aExact - bExact;
    });

    return result;
  }, [edges, search, tenantFilter, platforms, healths, showApprox]);

  if (needsAuth) {
    return (
      <div className="p-8 w-full flex items-center justify-center h-full">
        <p className="text-slate-500 font-medium">Sign in to view monitoring data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 w-full h-full flex flex-col space-y-4">
        <div className="h-10 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="flex gap-4">
          <div className="h-24 bg-slate-200 rounded flex-1 animate-pulse"></div>
          <div className="h-24 bg-slate-200 rounded flex-1 animate-pulse"></div>
          <div className="h-24 bg-slate-200 rounded flex-1 animate-pulse"></div>
          <div className="h-24 bg-slate-200 rounded flex-1 animate-pulse"></div>
        </div>
        <div className="h-[520px] bg-slate-200 rounded-lg animate-pulse mt-4"></div>
      </div>
    );
  }

  if (error || !edges || !meta) {
    return (
      <div className="p-8 w-full flex items-center justify-center h-full">
        <p className="text-slate-500 font-medium text-center">{error || "Monitoring data unavailable"}</p>
      </div>
    );
  }

  return (
    <div className="p-8 w-full space-y-6 flex flex-col bg-slate-50 min-h-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Monitoring</h2>
        <p className="text-sm text-slate-500 mt-1">
          {meta.listedInMaster} edges in controller &middot; data as of {meta.generated}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">In controller</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{meta.listedInController}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">On the map</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{meta.mapped}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <p className="text-sm text-amber-700 font-medium pl-2">Down</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 pl-2">{meta.byHealthMapped['DOWN']}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-sm text-red-700 font-medium pl-2">Long down</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 pl-2">{meta.byHealthMapped['LONG DOWN']}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm shrink-0 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center w-full">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search edges..."
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 max-w-[200px]"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
          >
            <option value="">All Tenants</option>
            {tenantsList.map(([t]) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 border border-slate-200 rounded-md p-1 bg-slate-50">
            {['CISCO', 'VELO'].map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1 text-xs font-medium rounded-sm ${platforms.has(p) ? 'bg-white shadow-sm text-slate-800 border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p === 'CISCO' ? 'Cisco' : 'Velo'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border border-slate-200 rounded-md p-1 bg-slate-50">
            {['UP', 'DOWN', 'LONG DOWN'].map(h => (
              <button
                key={h}
                onClick={() => toggleHealth(h)}
                className={`px-3 py-1 text-xs font-medium rounded-sm ${healths.has(h) ? 'bg-white shadow-sm text-slate-800 border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {h === 'UP' ? 'Up' : h === 'DOWN' ? 'Down' : 'Long down'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 ml-auto whitespace-nowrap">
            <input 
              type="checkbox" 
              checked={showApprox} 
              onChange={(e) => setShowApprox(e.target.checked)} 
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Show approximate locations (geocoded, not device GPS)
          </label>
        </div>
        
        <div className="w-full flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
          <span className="text-xs text-slate-500">Showing {filteredEdges.length} of {edges.length} edges</span>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="relative h-[520px] rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-white">
        <MapContainer 
          center={[-2.5, 118]} 
          zoom={5} 
          style={{ height: '100%', width: '100%' }}
          preferCanvas={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredEdges.map(edge => {
            const isExact = edge.precision === 'EXACT';
            const isCity = edge.precision === 'CITY';
            return (
              <CircleMarker
                key={edge.serial}
                center={[edge.lat, edge.lng]}
                radius={5}
                pathOptions={{
                  color: HEALTH_COLORS[edge.health],
                  fillColor: HEALTH_COLORS[edge.health],
                  fillOpacity: isExact ? 1 : 0.15,
                  weight: isExact ? 0 : 2,
                  dashArray: isCity ? '3 3' : undefined
                }}
              >
                <Popup className="monitoring-popup">
                  <div className="min-w-[240px] text-sm font-sans">
                    {!isExact && (
                      <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs flex gap-2 items-start leading-tight">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Approximate location</strong> &mdash; geocoded, not the device's GPS.
                          {edge.sharedCount > 1 && ` Shared with ${edge.sharedCount - 1} other edge${edge.sharedCount - 1 === 1 ? '' : 's'} at this exact point.`}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="font-bold text-slate-800 break-all leading-tight pr-2">{edge.hostname}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shrink-0`} style={{ backgroundColor: HEALTH_COLORS[edge.health] }}>
                        {edge.health}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 mb-3 text-xs">
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Serial</span>
                        <span className="text-slate-800 font-medium">{edge.serial}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Model</span>
                        <span className="text-slate-800">{edge.platform} {edge.model}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Tenant</span>
                        <span className="text-slate-800">{edge.tenant}</span>
                      </div>
                      {edge.sid && (
                        <div className="grid grid-cols-[80px_1fr] gap-2">
                          <span className="text-slate-500">SID</span>
                          <span className="text-slate-800">{edge.sid}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Site ID</span>
                        <span className="text-slate-800">{edge.siteId}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">System IP</span>
                        <span className="text-slate-800">{edge.systemIp}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Version</span>
                        <span className="text-slate-800">{edge.softwareVersion}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Address</span>
                        <span className="text-slate-800 leading-snug">{edge.address}</span>
                      </div>
                    </div>
                    
                    <div className="border-t pt-2 space-y-1 text-center">
                      <div className="text-xs font-medium text-slate-700">
                        {edge.health === 'UP' 
                          ? `Last seen ${edge.lastContact}`
                          : (edge.daysSinceContact !== undefined 
                              ? `Down ${edge.daysSinceContact} days` 
                              : `Down since ${edge.lastContact}`)
                        }
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Location from {edge.geoSource === 'Controller GPS' ? 'controller GPS' : 'address enrichment'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => askCici(edge.health === 'DOWN' || edge.health === 'LONG DOWN' ? 'Kenapa ini down?' : 'Ringkas perangkat ini', {
                          menu: 'monitoring',
                          selectedItemType: 'device',
                          selectedItemId: edge.serial,
                          selectedItemData: edge,
                        })}
                        className="w-full py-1 px-2.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Tanya Cici</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          
          <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control bg-white p-3 rounded-md shadow border border-slate-200 text-xs mb-4 mr-4 flex flex-col gap-3">
              <div>
                <div className="font-semibold text-slate-700 mb-1.5">Health</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#059669]"></div>
                    <span className="text-slate-600">Up ({meta.byHealthMapped['UP']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#D97706]"></div>
                    <span className="text-slate-600">Down ({meta.byHealthMapped['DOWN']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#DC2626]"></div>
                    <span className="text-slate-600">Long Down ({meta.byHealthMapped['LONG DOWN']})</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-2">
                <div className="font-semibold text-slate-700 mb-1.5">Precision</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                    <span className="text-slate-600">Exact GPS ({meta.byPrecision['EXACT']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-slate-500 bg-slate-500 bg-opacity-20"></div>
                    <span className="text-slate-600">Approximate point ({meta.byPrecision['APPROX']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-slate-500 bg-slate-500 bg-opacity-20 border-dashed" style={{ borderStyle: 'dashed' }}></div>
                    <span className="text-slate-600">City centroid ({meta.byPrecision['CITY']})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MapContainer>

        {filteredEdges.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm pointer-events-none">
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 text-center pointer-events-auto">
              <p className="text-slate-800 font-medium mb-2">No edges match these filters</p>
              <button 
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-2 shrink-0">
        {meta.unmapped} edges are in a controller but have no coordinate and are not shown.
      </p>

      {/* Tenant Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden shrink-0 mt-2">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">Tenant Distribution</h3>
        </div>
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 font-semibold w-1/3">Tenant</th>
                <th className="px-6 py-3 font-semibold w-24">Edges</th>
                <th className="px-6 py-3 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenantsList.map(([tenant, count]) => {
                const percent = (count / meta.listedInController) * 100;
                return (
                  <tr key={tenant} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-800 truncate">{tenant}</td>
                    <td className="px-6 py-3 text-slate-600">{count}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 flex-1 max-w-[200px]">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.max(percent, 1)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-slate-400 w-10 text-right">{percent < 1 ? '<1' : Math.round(percent)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
