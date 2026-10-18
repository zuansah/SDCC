import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Square, 
  Sparkles, 
  PlusCircle, 
  Layers, 
  FileText, 
  Compass, 
  RefreshCw 
} from 'lucide-react';
import { useCici } from '../context/CiciContext';
import { CiciMessageItem } from './CiciMessageItem';
import { DocumentModal } from './DocumentModal';
import { CiciAvatar } from './CiciAvatar';
import { CiciDocument } from '../types';

export const CiciDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    closeDrawer,
    messages,
    sendMessage,
    isRunning,
    stopRunning,
    activePlan,
    toolActivity,
    pageContext,
    startNewThread,
    documents,
  } = useCici();

  const [input, setInput] = useState('');
  const [activeDoc, setActiveDoc] = useState<CiciDocument | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isDrawerOpen, isRunning, toolActivity]);

  // Focus input when opened
  useEffect(() => {
    if (isDrawerOpen) {
      inputRef.current?.focus();
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleOpenDocById = (docId: string) => {
    const found = documents.find(d => d.id === docId);
    if (found) {
      setActiveDoc(found);
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs md:hidden"
        onClick={closeDrawer}
      />

      {/* Slide-over Drawer */}
      <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <CiciAvatar size="md" showStatus />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Cici: Asisten NSM</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Operasional cerdas seluruh modul</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={startNewThread}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition"
              title="Mulai percakapan baru"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
            <button
              onClick={closeDrawer}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition"
              title="Tutup drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Context bar */}
        <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">
              Konteks: <strong className="text-slate-800 capitalize">{pageContext.menu}</strong>
              {pageContext.selectedItemId ? ` • ${pageContext.selectedItemType}: "${pageContext.selectedItemId}"` : ''}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0">Otomatis Terhubung</span>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
          {messages.map((msg) => (
            <CiciMessageItem
              key={msg.id}
              message={msg}
              onOpenDocument={handleOpenDocById}
            />
          ))}

          {/* Running agent activity indicator */}
          {isRunning && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>
                {toolActivity
                  ? `Menjalankan: ${toolActivity.name.replace(/_/g, ' ')}...`
                  : 'Cici sedang menganalisis & merencanakan tugas...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Stop button bar when running */}
        {isRunning && (
          <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200/80 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <span>Agen multi-step sedang aktif</span>
            <button
              onClick={stopRunning}
              className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold text-[11px] flex items-center gap-1 transition"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="relative border border-slate-300 rounded-lg focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 transition shadow-2xs">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tanya Cici seputar edge, tiket, order, atau dokumen..."
                rows={2}
                disabled={isRunning}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none bg-transparent"
              />
              <div className="flex items-center justify-between px-2 pb-1.5 text-[10px] text-slate-400">
                <span>Enter untuk kirim • Shift+Enter baris baru</span>
                <button
                  type="submit"
                  disabled={!input.trim() || isRunning}
                  className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white transition"
                  title="Kirim pesan"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </aside>

      {/* Document Viewer Modal */}
      <DocumentModal
        document={activeDoc}
        onClose={() => setActiveDoc(null)}
      />
    </>
  );
};
