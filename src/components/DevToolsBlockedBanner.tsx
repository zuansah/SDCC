import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface DevToolsBlockedBannerProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export default function DevToolsBlockedBanner({ isOpen, onDismiss }: DevToolsBlockedBannerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-99999 max-w-lg w-[92%] bg-red-950/95 border border-red-500/50 text-white p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-200">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-red-900/80 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-red-200">
            Developer Tools / Inspect Terdeteksi
          </h4>
          <p className="text-[11px] text-red-300/80 leading-tight">
            Inspect element & source viewing dinonaktifkan sesuai Kebijakan Keamanan Telkom Indonesia.
          </p>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="p-1 text-red-400 hover:text-white hover:bg-red-900/60 rounded-lg transition cursor-pointer shrink-0"
        title="Tutup Peringatan"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
