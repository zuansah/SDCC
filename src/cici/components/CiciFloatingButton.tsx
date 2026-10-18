import React from 'react';
import { useCici } from '../context/CiciContext';

export const CiciFloatingButton: React.FC = () => {
  const { isDrawerOpen, toggleDrawer } = useCici();

  if (isDrawerOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={toggleDrawer}
        className="group relative flex items-center gap-2.5 pl-2 pr-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg border border-slate-700 transition duration-150 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        title="Tanya Cici: Asisten Operasional NSM"
        aria-label="Buka Tanya Cici"
      >
        {/* Cici Avatar with status indicator */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 border border-slate-600 flex items-center justify-center">
            <img
              src="/cici-avatar.png"
              alt="Cici"
              className="w-full h-full object-cover object-[center_20%] scale-135"
            />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-slate-900"></span>
          </span>
        </div>

        {/* Crisp typographic hierarchy without generic AI sparkle clutter */}
        <div className="flex flex-col items-start leading-none pr-1">
          <span className="text-xs font-semibold tracking-wide text-white">
            Tanya Cici
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">Asisten NSM</span>
        </div>
      </button>
    </div>
  );
};
