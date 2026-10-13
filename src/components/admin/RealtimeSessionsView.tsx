import React, { useState } from 'react';
import { 
  Radio, Users, Laptop, Globe, Clock, ShieldAlert, LogOut, Search,
  RefreshCw, CheckCircle2, Shield, Eye, AlertCircle
} from 'lucide-react';
import { UserSessionItem } from '../../services/accessLogger';

interface RealtimeSessionsViewProps {
  sessions: UserSessionItem[];
  loading: boolean;
  onForceTerminate: (uid: string, email: string) => Promise<void>;
  onRefresh: () => void;
}

export default function RealtimeSessionsView({
  sessions,
  loading,
  onForceTerminate,
  onRefresh,
}: RealtimeSessionsViewProps) {
  const [search, setSearch] = useState('');
  const [terminatingUid, setTerminatingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);

  const now = Date.now();

  // Helper to compute time elapsed string
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Baru saja';
    const diffMs = now - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)} dtk lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} jam lalu`;
  };

  const isRecent = (isoString?: string) => {
    if (!isoString) return false;
    const diffMs = now - new Date(isoString).getTime();
    return diffMs <= 2.5 * 60 * 1000; // within 2.5 minutes is actively online
  };

  const activeSessions = sessions.filter((s) => s.status !== 'TERMINATED');
  const onlineCount = activeSessions.filter((s) => isRecent(s.lastActiveAt)).length;
  const idleCount = activeSessions.length - onlineCount;
  const superAdminCount = activeSessions.filter((s) => s.role === 'Super Admin').length;

  const filteredSessions = activeSessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.email?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.ipAddress?.toLowerCase().includes(q) ||
      s.currentView?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    );
  });

  const handleDisconnectClick = async (uid: string, email: string) => {
    setTerminatingUid(uid);
    try {
      await onForceTerminate(uid, email);
    } finally {
      setTerminatingUid(null);
      setConfirmUid(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 1. Realtime KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Connected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Sesi Terhubung
            </span>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              {activeSessions.length}
            </div>
            <span className="text-[11px] text-slate-400">Total sesi aktif terdaftar</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Now */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              Aktif Saat Ini
            </span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {onlineCount}
            </div>
            <span className="text-[11px] text-slate-400">Heartbeat &lt; 2 menit</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Idle Users */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
              Sesi Tidak Aktif (Idle)
            </span>
            <div className="text-2xl font-extrabold text-amber-700 mt-1">
              {idleCount}
            </div>
            <span className="text-[11px] text-slate-400">Menunggu timeout inaktivitas</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Super Admins Online */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">
              Super Admin Online
            </span>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">
              {superAdminCount}
            </div>
            <span className="text-[11px] text-slate-400">Hak istimewa penuh</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Controls & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari email, nama, IP, halaman aktif..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Refresh sesi realtime"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 3. Live Sessions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Sesi Pengguna Real-Time
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredSessions.length} pengguna aktif terpantau
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider select-none text-[11px]">
                <th className="px-5 py-3">Pengguna & Peran</th>
                <th className="px-4 py-3">Halaman Aktif</th>
                <th className="px-4 py-3">Alamat IP & Lokasi</th>
                <th className="px-4 py-3">Perangkat / Browser</th>
                <th className="px-4 py-3">Waktu Masuk & Ping</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Menghubungkan ke pemantauan sesi realtime...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Tidak ada sesi pengguna aktif yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const online = isRecent(s.lastActiveAt);
                  const isSuper = s.role === 'Super Admin';

                  return (
                    <tr key={s.uid} className="hover:bg-slate-50/80 transition-colors">
                      {/* User */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            isSuper ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {(s.name || s.email)?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>{s.name || 'Pengguna'}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isSuper ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {s.role || 'User'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {s.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Current View */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                          <Eye className="w-3 h-3 text-blue-600" />
                          {s.currentView || 'dashboard'}
                        </span>
                      </td>

                      {/* IP & Location */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-medium text-slate-800">{s.ipAddress || '—'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {s.city ? `${s.city}, ` : ''}{s.country || 'Indonesia 🇮🇩'}
                        </div>
                      </td>

                      {/* Device */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-slate-400" />
                          <span className="max-w-[160px] truncate block text-[11px]" title={s.userAgent}>
                            {s.userAgent?.includes('Mac')
                              ? 'macOS · Chrome/Safari'
                              : s.userAgent?.includes('Windows')
                              ? 'Windows · Chrome/Edge'
                              : s.userAgent?.includes('Android')
                              ? 'Android Mobile'
                              : s.userAgent?.includes('iPhone')
                              ? 'iOS Mobile'
                              : 'Desktop Browser'}
                          </span>
                        </div>
                      </td>

                      {/* Login Time & Heartbeat */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                        <div className="font-medium text-slate-800 text-[11px]">
                          Ping: <strong className="text-emerald-700">{formatTimeAgo(s.lastActiveAt)}</strong>
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          Masuk: {s.loginAt ? new Date(s.loginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {online ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Idle
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {confirmUid === s.uid ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1 rounded-lg">
                            <span className="text-[10px] text-rose-800 font-bold px-1">Tutup sesi?</span>
                            <button
                              onClick={() => handleDisconnectClick(s.uid, s.email)}
                              disabled={terminatingUid === s.uid}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer transition disabled:opacity-50"
                            >
                              {terminatingUid === s.uid ? 'Memutuskan...' : 'Ya, Putus'}
                            </button>
                            <button
                              onClick={() => setConfirmUid(null)}
                              className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] cursor-pointer hover:bg-slate-300"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmUid(s.uid)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-lg transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Putus koneksi pengguna ini secara paksa"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Putus Sesi</span>
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
      </div>
    </div>
  );
}
