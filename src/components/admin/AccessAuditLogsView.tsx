import React, { useState, useMemo } from 'react';
import { 
  Activity, Search, Filter, Download, Calendar, Shield, AlertTriangle, 
  CheckCircle2, LogIn, LogOut, Clock, Eye, KeyRound, Globe, RefreshCw, X
} from 'lucide-react';
import { AccessLogItem, AccessActionType } from '../../services/accessLogger';

interface AccessAuditLogsViewProps {
  logs: AccessLogItem[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AccessAuditLogsView({
  logs,
  loading,
  onRefresh,
}: AccessAuditLogsViewProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days'>('all');

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    return logs.filter((item) => {
      // Date filter
      if (dateFilter !== 'all') {
        const itemTime = new Date(item.timestamp).getTime();
        if (dateFilter === 'today' && now - itemTime > oneDayMs) return false;
        if (dateFilter === '7days' && now - itemTime > sevenDaysMs) return false;
      }

      // Action filter
      if (actionFilter !== 'ALL' && item.action !== actionFilter) {
        return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesEmail = item.userEmail?.toLowerCase().includes(q);
        const matchesName = item.userName?.toLowerCase().includes(q);
        const matchesDetails = item.details?.toLowerCase().includes(q);
        const matchesIp = item.ipAddress?.toLowerCase().includes(q);
        const matchesAction = item.action?.toLowerCase().includes(q);
        if (!matchesEmail && !matchesName && !matchesDetails && !matchesIp && !matchesAction) {
          return false;
        }
      }

      return true;
    });
  }, [logs, search, actionFilter, dateFilter]);

  // Action badge styling helper
  const renderActionBadge = (action: AccessActionType) => {
    switch (action) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <LogIn className="w-3 h-3 text-emerald-600" />
            LOGIN
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <LogOut className="w-3 h-3 text-slate-500" />
            LOGOUT
          </span>
        );
      case 'SESSION_TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            TIMEOUT
          </span>
        );
      case 'VIEW_NAVIGATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Eye className="w-3 h-3 text-blue-600" />
            NAVIGATE
          </span>
        );
      case 'PERMISSION_UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <KeyRound className="w-3 h-3 text-indigo-600" />
            PERMISSIONS
          </span>
        );
      case 'GEO_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300">
            <Globe className="w-3 h-3 text-red-600" />
            GEO BLOCKED
          </span>
        );
      case 'DEVTOOLS_BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            INSPECT BLOCKED
          </span>
        );
      case 'FORCE_TERMINATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Shield className="w-3 h-3 text-purple-600" />
            FORCE LOGOUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'User Email', 'User Name', 'Role', 'Action', 'Details', 'IP Address', 'Country', 'User Agent'];
    const rows = filteredLogs.map((log) => [
      `"${log.timestamp}"`,
      `"${log.userEmail || ''}"`,
      `"${log.userName || ''}"`,
      `"${log.role || ''}"`,
      `"${log.action || ''}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      `"${log.ipAddress || ''}"`,
      `"${log.country || ''}"`,
      `"${(log.userAgent || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telkom_access_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 1. Header & Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari log email, IP, aktivitas, atau modul..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action & Date Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Semua Tindakan ({logs.length})</option>
              <option value="LOGIN">Masuk (LOGIN)</option>
              <option value="LOGOUT">Keluar (LOGOUT)</option>
              <option value="SESSION_TIMEOUT">Batas Waktu (TIMEOUT)</option>
              <option value="VIEW_NAVIGATE">Navigasi Halaman (NAVIGATE)</option>
              <option value="PERMISSION_UPDATE">Ubah Izin (PERMISSIONS)</option>
              <option value="GEO_BLOCKED">Blokir Wilayah (GEO BLOCKED)</option>
              <option value="DEVTOOLS_BLOCKED">Blokir Inspect (DEVTOOLS)</option>
              <option value="FORCE_TERMINATED">Putus Paksa (FORCE LOGOUT)</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">24 Jam Terakhir</option>
              <option value="7days">7 Hari Terakhir</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="Ekspor log audit ke format CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV ({filteredLogs.length})</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
              title="Segarkan log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Logs Stream Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rekam Jejak Audit Akses Pengguna (Access Audit Logs)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Menampilkan {filteredLogs.length} dari {logs.length} catatan log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none text-[11px]">
                <th className="px-5 py-3 whitespace-nowrap">Waktu & Tanggal</th>
                <th className="px-4 py-3 whitespace-nowrap">Pengguna</th>
                <th className="px-4 py-3 whitespace-nowrap">Tindakan</th>
                <th className="px-5 py-3">Rincian Aktivitas</th>
                <th className="px-4 py-3 whitespace-nowrap">IP & Wilayah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Memuat catatan log audit akses...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Tidak ada catatan log yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => (
                  <tr key={log.id || index} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      <div className="font-semibold text-slate-800">
                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      <div className="text-slate-400 text-[10.5px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{log.userName || log.userEmail?.split('@')[0] || 'User'}</span>
                        {log.role && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600">
                            {log.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {log.userEmail}
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderActionBadge(log.action)}
                    </td>

                    {/* Details */}
                    <td className="px-5 py-3.5 text-slate-700 leading-snug">
                      <div className="font-medium text-xs">
                        {log.details || '—'}
                      </div>
                      {log.userAgent && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-sm" title={log.userAgent}>
                          {log.userAgent}
                        </div>
                      )}
                    </td>

                    {/* IP & Location */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      <div className="font-semibold text-slate-800">
                        {log.ipAddress || '—'}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        {log.country || 'Indonesia 🇮🇩'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
