import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  MessageSquare, 
  BookOpen, 
  FileText, 
  Bell, 
  Trash2, 
  Download, 
  Plus, 
  Edit3, 
  ToggleLeft, 
  ToggleRight, 
  ExternalLink, 
  Clock, 
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  Copy,
  Printer
} from 'lucide-react';
import { useCici } from '../context/CiciContext';
import { CiciMessageItem } from './CiciMessageItem';
import { DocumentModal } from './DocumentModal';
import { CiciAvatar } from './CiciAvatar';
import { CiciMemory, CiciDocument, MemoryType } from '../types';
import { saveMemory, exportMemoriesAsMarkdown } from '../services/memoryService';
import { auth } from '../../lib/firebase';

export const CiciFullView: React.FC = () => {
  const {
    messages,
    sendMessage,
    isRunning,
    stopRunning,
    memories,
    refreshMemories,
    removeMemory,
    clearAllMemories,
    memoryEnabled,
    toggleMemoryEnabled,
    documents,
    refreshDocuments,
    reminders,
    refreshReminders,
    startNewThread,
  } = useCici();

  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'documents' | 'reminders'>('chat');
  const [input, setInput] = useState('');
  const [activeDoc, setActiveDoc] = useState<CiciDocument | null>(null);

  // Memory modal state
  const [showAddMemModal, setShowAddMemModal] = useState(false);
  const [memName, setMemName] = useState('');
  const [memDesc, setMemDesc] = useState('');
  const [memType, setMemType] = useState<MemoryType>('user');
  const [memBody, setMemBody] = useState('');
  const [savingMem, setSavingMem] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isRunning]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleExportMemories = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const md = await exportMemoriesAsMarkdown(uid);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memori-cici-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAllMemories = async () => {
    const ok = window.confirm(
      'Apakah kamu yakin ingin menghapus SEMUA catatan memori Cici? Tindakan ini permanen dan sesuai kepatuhan privasi UU PDP.'
    );
    if (!ok) return;
    await clearAllMemories();
  };

  const handleSaveManualMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid || !memName.trim() || !memDesc.trim()) return;

    setSavingMem(true);
    try {
      await saveMemory(uid, {
        name: memName.trim(),
        description: memDesc.trim(),
        type: memType,
        body: memBody.trim() || memDesc.trim(),
        source: 'user',
      });
      await refreshMemories();
      setShowAddMemModal(false);
      setMemName('');
      setMemDesc('');
      setMemBody('');
    } catch (err) {
      console.error('Failed saving manual memory:', err);
      alert('Gagal menyimpan memori.');
    } finally {
      setSavingMem(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <CiciAvatar size="lg" showStatus />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Cici: Asisten NSM</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Agentic Operations
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Asisten kecerdasan buatan terhubung ke seluruh modul, memori pribadi dan dokumen
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'chat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Percakapan</span>
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'memory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Memori Cici ({memories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'documents' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dokumen ({documents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'reminders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Pantauan & Pengingat ({reminders.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Contents */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* TAB 1: CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
              {messages.map((msg) => (
                <CiciMessageItem
                  key={msg.id}
                  message={msg}
                  onOpenDocument={(id) => {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setActiveDoc(doc);
                  }}
                />
              ))}

              {isRunning && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Cici sedang menjalankan rencana tugas operasional...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ketik instruksi untuk Cici (e.g. 'Siapkan laporan mingguan Bank Mandiri', 'Edge mana yang down di Kendari?')..."
                  disabled={isRunning}
                  className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 focus:bg-white text-slate-800 transition"
                />
                {isRunning ? (
                  <button
                    type="button"
                    onClick={stopRunning}
                    className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={startNewThread}
                  className="px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium transition"
                  title="Percakapan Baru"
                >
                  Baru
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: MEMORY ("Memori Cici") */}
        {activeTab === 'memory' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-6">
            {/* Header controls & PDP statement */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Memori Pribadi Pengguna (UU PDP)</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${memoryEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {memoryEnabled ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Catatan fakta tahan lama, preferensi jawaban, dan pekerjaan berjalan yang diingat Cici antara sesi.
                  Hanya kamu yang dapat membaca memori ini. Tidak ada kata sandi atau data pribadi pelanggan yang disimpan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleMemoryEnabled(!memoryEnabled)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition"
                >
                  {memoryEnabled ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  <span>{memoryEnabled ? 'Matikan Memori' : 'Nyalakan Memori'}</span>
                </button>
                <button
                  onClick={handleExportMemories}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition"
                  title="Unduh seluruh catatan memori sebagai file Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor .md</span>
                </button>
                <button
                  onClick={() => setShowAddMemModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Manual</span>
                </button>
                <button
                  onClick={handleClearAllMemories}
                  className="px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua</span>
                </button>
              </div>
            </div>

            {/* Memories List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((m: CiciMemory) => (
                <div
                  key={m.id || m.name}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          m.type === 'user'
                            ? 'bg-blue-100 text-blue-700'
                            : m.type === 'preference'
                            ? 'bg-purple-100 text-purple-700'
                            : m.type === 'work'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {m.type}
                        </span>
                        <h3 className="font-bold text-slate-900 text-xs">{m.name}</h3>
                      </div>
                      <button
                        onClick={() => removeMemory(m.name)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                        title="Hapus catatan ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-2">
                      {m.description}
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {m.body}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                    <span>Sumber: {m.source || 'cici'}</span>
                    <span>Diperbarui: {new Date(m.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {memories.length === 0 && (
              <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                Belum ada catatan memori yang tersimpan. Cici akan otomatis mencatat hal-hal penting seiring percakapanmu, atau kamu dapat menambahkan memori secara manual di atas.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Dokumen & Laporan Tertulis Cici</h2>
                <p className="text-xs text-slate-500">
                  Laporan insiden, ringkasan shift handover, dan evaluasi mingguan berformat Markdown resmi
                </p>
              </div>
              <button
                onClick={refreshDocuments}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Segarkan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc: CiciDocument) => (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                        {doc.kind}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-2">{doc.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-3 mt-1 leading-relaxed">
                      {doc.markdown.replace(/^[#*>-]+/gm, '').slice(0, 160)}...
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {doc.sources?.join(', ') || 'NSM Controller'}
                    </span>
                    <button
                      onClick={() => setActiveDoc(doc)}
                      className="px-3 py-1 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Dokumen</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {documents.length === 0 && (
              <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                Belum ada dokumen yang disusun. Coba minta Cici: *"Buatkan laporan mingguan Bank Mandiri"* atau *"Siapkan ringkasan shift handover hari ini"*.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REMINDERS & WATCHES */}
        {activeTab === 'reminders' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pantauan Kondisi & Pengingat Aktif</h2>
              <p className="text-xs text-slate-500">
                Cici memantau pemulihan edge, penutupan tiket, atau perubahan status order secara berkala
              </p>
            </div>

            <div className="space-y-3">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === 'triggered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.status === 'triggered' ? 'KONDISI TERPENUHI' : 'MEMANTAU'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{r.text}</h4>
                    </div>
                    {r.watch && (
                      <p className="text-xs text-slate-500">
                        Target pantau: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">{r.watch.target}</code> ({r.watch.type})
                      </p>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}

              {reminders.length === 0 && (
                <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                  Belum ada pantauan aktif. Coba minta: *"Pantau DWN-2026-00045, kabari kalau pulih"*.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Memory Modal */}
      {showAddMemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Tambah Catatan Memori Cici</h3>
            <form onSubmit={handleSaveManualMemory} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Pengenal Slug (kebab-case):</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. area-kalimantan atau prefers-bahasa"
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Kategori Memori:</label>
                <select
                  value={memType}
                  onChange={(e) => setMemType(e.target.value as MemoryType)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
                >
                  <option value="user">User (peran, regional, witel, tim)</option>
                  <option value="preference">Preference (gaya jawaban, preferensi format)</option>
                  <option value="work">Work (pekerjaan berjalan, insiden yang dipantau)</option>
                  <option value="reference">Reference (lokasi PIC, filter kerja)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Ringkasan Singkat (1 baris untuk indeks):</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pegang area operasional Kalimantan, tenant Pelindo"
                  value={memDesc}
                  onChange={(e) => setMemDesc(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Detail Isi Markdown (opsional):</label>
                <textarea
                  rows={3}
                  placeholder="Penjelasan detail fakta..."
                  value={memBody}
                  onChange={(e) => setMemBody(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingMem}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
                >
                  {savingMem ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal */}
      <DocumentModal
        document={activeDoc}
        onClose={() => setActiveDoc(null)}
      />
    </div>
  );
};
