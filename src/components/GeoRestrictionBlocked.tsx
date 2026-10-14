import React, { useState } from 'react';
import { ShieldAlert, Globe, MapPin, RefreshCw, CheckCircle2 } from 'lucide-react';
import { GeoLocationInfo, logAccessEvent } from '../services/accessLogger';

interface GeoRestrictionBlockedProps {
  geoInfo: GeoLocationInfo | null;
  onRetry: () => void;
  onAdminBypass: () => void;
  currentUserEmail?: string;
  isSuperAdmin?: boolean;
}

export default function GeoRestrictionBlocked({
  geoInfo,
  onRetry,
  onAdminBypass,
  currentUserEmail,
  isSuperAdmin,
}: GeoRestrictionBlockedProps) {
  const [retrying, setRetrying] = useState(false);

  const handleAdminBypassClick = () => {
    if (isSuperAdmin) {
      logAccessEvent({
        action: 'GEO_BLOCKED',
        details: `Super Admin bypass accepted from ${geoInfo?.countryName || 'Unknown'} (${geoInfo?.ip || ''})`,
        userEmail: currentUserEmail || 'superadmin@telkom.co.id',
        role: 'Super Admin',
      });
      onAdminBypass();
    }
  };

  const handleRetryClick = async () => {
    setRetrying(true);
    await onRetry();
    setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans select-none">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Telkom Security Emblem */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-950/50">
          <ShieldAlert className="w-10 h-10 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75" />
        </div>

        {/* Title & Badge */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
            <Globe className="w-3.5 h-3.5" />
            Pembatasan Geografis Wilayah
          </span>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Akses Dibatasi: Khusus Indonesia
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            Aplikasi Telkom SD-WAN Management dibatasi secara ketat hanya untuk akses dari dalam wilayah Republik Indonesia (NKRI).
          </p>
        </div>

        {/* Detected Info Box */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-left text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-red-400" />
              Negara Terdeteksi
            </span>
            <span className="font-bold text-red-400 font-mono">
              {geoInfo?.countryName || 'Luar Wilayah Indonesia'} ({geoInfo?.countryCode || 'Non-ID'})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
            <span>Alamat IP Terdeteksi</span>
            <span className="font-mono text-slate-200">{geoInfo?.ip || '127.0.0.1'}</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Kebijakan Regulasi</span>
            <span className="font-semibold text-amber-400">Telkom Cyber Security ISO 27001</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleRetryClick}
            disabled={retrying}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-red-950/60 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Memeriksa Kembali Jaringan...' : 'Cek Ulang Lokasi Jaringan'}</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={handleAdminBypassClick}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Bypass Sebagai Super Admin ({currentUserEmail})</span>
            </button>
          )}
        </div>

        <div className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-3">
          PT Telkom Indonesia (Persero) Tbk · Divisi Network & Services Management (NSM)
        </div>
      </div>
    </div>
  );
}
