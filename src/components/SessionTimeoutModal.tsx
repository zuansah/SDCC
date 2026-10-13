import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtendSession: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutModal({
  isOpen,
  remainingSeconds,
  onExtendSession,
  onLogout,
}: SessionTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full p-6 text-center space-y-5">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Batas Waktu Sesi Keamanan
          </span>
          <h3 className="text-xl font-bold text-slate-800">
            Sesi Anda Akan Berakhir
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Tidak ada aktivitas terdeteksi. Demi mematuhi standar keamanan akses data Telkom Indonesia, sesi Anda akan ditutup secara otomatis dalam:
          </p>
        </div>

        {/* Big Countdown */}
        <div className="py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="font-mono text-4xl font-extrabold text-amber-600 tracking-wider">
            {formattedTime}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">menit : detik tersisa</span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-1/2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sekarang</span>
          </button>

          <button
            type="button"
            onClick={onExtendSession}
            className="w-full sm:w-1/2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Lanjutkan Sesi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
