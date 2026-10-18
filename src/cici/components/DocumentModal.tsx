import React, { useState } from 'react';
import { X, Download, Copy, Check, Printer, Edit2, Eye, Save } from 'lucide-react';
import { CiciDocument } from '../types';
import { updateCiciDocument } from '../services/memoryService';
import { auth } from '../../lib/firebase';

interface Props {
  document: CiciDocument | null;
  onClose: () => void;
  onUpdated?: (updatedDoc: CiciDocument) => void;
}

export const DocumentModal: React.FC<Props> = ({ document: doc, onClose, onUpdated }) => {
  if (!doc) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(doc.markdown);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Izinkan pop-up untuk mencetak PDF dokumen.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${doc.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; }
            h1 { font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
            h2 { font-size: 18px; margin-top: 24px; color: #334155; }
            h3 { font-size: 14px; margin-top: 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
          </style>
        </head>
        <body>
          <h1>${doc.title}</h1>
          <div class="meta">
            <strong>Jenis Dokumen:</strong> ${doc.kind.toUpperCase()} | 
            <strong>Dibuat:</strong> ${new Date(doc.createdAt).toLocaleString()} | 
            <strong>Sumber:</strong> ${doc.sources?.join(', ') || 'NSM SD-WAN'}
          </div>
          <div>${renderHtmlFromMarkdown(content)}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleSaveEdit = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      await updateCiciDocument(uid, doc.id, content);
      onUpdated?.({
        ...doc,
        markdown: content,
        updatedAt: new Date().toISOString(),
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save document:', err);
      alert('Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                {doc.kind}
              </span>
              <span className="text-xs text-slate-500">
                Terakhir diubah: {new Date(doc.updatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mt-0.5">{doc.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition"
              title={isEditing ? 'Lihat Render' : 'Edit Markdown'}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Preview' : 'Edit'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition"
              title="Salin Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadMd}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition"
              title="Download .md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.md</span>
            </button>

            <button
              onClick={handlePrintPdf}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition"
              title="Cetak PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isEditing ? (
            <div className="space-y-3 h-full flex flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full flex-1 min-h-[400px] p-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 leading-relaxed"
                placeholder="Tulis markdown di sini..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs max-w-3xl mx-auto space-y-4 text-xs leading-relaxed text-slate-800">
              <div dangerouslySetInnerHTML={{ __html: renderHtmlFromMarkdown(content) }} />

              {/* Data sources footer */}
              {doc.sources && doc.sources.length > 0 && (
                <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    Sumber Data Terverifikasi:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doc.sources.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function renderHtmlFromMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/^### (.*$)/gim, '<h3 style="font-size:14px; font-weight:700; margin-top:16px; margin-bottom:6px; color:#1e293b;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size:16px; font-weight:700; margin-top:20px; margin-bottom:8px; color:#0f172a; border-bottom:1px solid #f1f5f9; padding-bottom:4px;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="font-size:20px; font-weight:800; margin-top:24px; margin-bottom:12px; color:#0f172a;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px;">$1</code>')
    .replace(/^\- (.*$)/gim, '<li style="margin-left:16px; margin-bottom:4px; color:#334155;">$1</li>')
    .replace(/\n\n/gim, '<br/><br/>');

  return html;
}
