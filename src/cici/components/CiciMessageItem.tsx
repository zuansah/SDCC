import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  ArrowRight,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { CiciMessage, AgentPlanStep, CiciActionCard } from '../types';
import { useCici } from '../context/CiciContext';
import { CiciAvatar } from './CiciAvatar';

interface Props {
  message: CiciMessage;
  onOpenDocument?: (docId: string) => void;
}

export const CiciMessageItem: React.FC<Props> = ({ message, onOpenDocument }) => {
  const { sendMessage, confirmAction, cancelAction, removeMemory, currentUserRole } = useCici();
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [undoMemory, setUndoMemory] = useState(false);

  const isAssistant = message.role === 'assistant';

  const handleCopyDoc = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleUndoMemory = async (name: string) => {
    await removeMemory(name);
    setUndoMemory(true);
  };

  return (
    <div className={`flex flex-col gap-2 ${isAssistant ? 'items-start' : 'items-end'}`}>
      {/* Role / Avatar header */}
      <div className="flex items-center gap-2">
        {isAssistant ? (
          <>
            <CiciAvatar size="xs" />
            <span className="text-xs font-semibold text-slate-700">Cici</span>
          </>
        ) : (
          <span className="text-xs font-medium text-slate-500">Anda</span>
        )}
      </div>

      {/* Plan checklist card if present */}
      {message.plan && message.plan.length > 0 && (
        <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 shadow-xs">
          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Rencana Eksekusi:</span>
          </div>
          <div className="space-y-1 pt-1">
            {message.plan.map((step: AgentPlanStep) => (
              <div key={step.step} className="flex items-center gap-2 text-slate-600">
                {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {step.status === 'running' && <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />}
                {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />}
                {step.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className={step.status === 'completed' ? 'line-through text-slate-400' : ''}>
                  {step.step}. {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main message bubble */}
      <div
        className={`rounded-lg px-3.5 py-2.5 text-xs max-w-full leading-relaxed ${
          isAssistant
            ? 'bg-white border border-slate-200 text-slate-800 shadow-xs'
            : 'bg-slate-900 text-white'
        }`}
      >
        <div className="prose prose-xs max-w-none text-xs break-words space-y-2">
          {renderSimpleMarkdown(message.text)}
        </div>
      </div>

      {/* Source chips */}
      {message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {message.sources.map((src, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-600"
            >
              {src}
            </span>
          ))}
        </div>
      )}

      {/* Inline memory note */}
      {message.memoryNote && (
        <div className="w-full max-w-md bg-indigo-50/70 border border-indigo-200/80 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2 text-indigo-900 shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span>📝</span>
            <span className="truncate">
              {undoMemory
                ? `Memori dihapus: ${message.memoryNote.name}`
                : `Cici mencatat: ${message.memoryNote.description}`}
            </span>
          </div>
          {!undoMemory && (
            <button
              onClick={() => handleUndoMemory(message.memoryNote!.name)}
              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-white border border-indigo-200 hover:bg-indigo-50 transition"
              title="Undo this memory write"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          )}
        </div>
      )}

      {/* Document Card preview */}
      {message.docCard && (
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-indigo-50 text-indigo-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">{message.docCard.title}</h4>
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  {message.docCard.kind} • Tersimpan di Dokumen Cici
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            {onOpenDocument && (
              <button
                onClick={() => onOpenDocument(message.docCard!.docId)}
                className="px-2.5 py-1 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 text-[11px] transition flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Buka Dokumen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Cards (Propose -> Confirm -> Execute) */}
      {message.actions && message.actions.length > 0 && (
        <div className="w-full max-w-md space-y-2">
          {message.actions.map((act: CiciActionCard) => {
            const isViewer = currentUserRole === 'Viewer';
            const isExecuted = act.status === 'executed';
            const isCancelled = act.status === 'cancelled';

            return (
              <div
                key={act.id}
                className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Rekomendasi Aksi
                    </span>
                    <h4 className="font-semibold text-slate-900 text-xs mt-0.5">{act.title}</h4>
                    <p className="text-slate-600 text-[11px] mt-0.5">{act.description}</p>
                  </div>
                </div>

                {/* Card fields */}
                <div className="bg-slate-50 rounded p-2 text-[11px] font-mono space-y-0.5 text-slate-700">
                  {Object.entries(act.payload).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-semibold truncate max-w-[200px]">{String(v)}</span>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                {!isExecuted && !isCancelled && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => cancelAction(act.id)}
                      className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-[11px] transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => confirmAction(act)}
                      disabled={isViewer}
                      title={isViewer ? 'Peranmu tidak bisa mengubah data' : 'Konfirmasi dan eksekusi'}
                      className={`px-3 py-1 rounded font-medium text-[11px] transition flex items-center gap-1 ${
                        isViewer
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      }`}
                    >
                      {isViewer && <ShieldAlert className="w-3 h-3" />}
                      Konfirmasi
                    </button>
                  </div>
                )}

                {isExecuted && (
                  <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aksi telah dieksekusi</span>
                  </div>
                )}

                {isCancelled && (
                  <div className="text-[11px] text-slate-400 italic pt-1">
                    Aksi dibatalkan.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested next steps chips */}
      {message.suggestedNextSteps && message.suggestedNextSteps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {message.suggestedNextSteps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(step)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-medium hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 shadow-2xs transition"
            >
              <span>{step}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Simple clean Markdown renderer without external heavy parser
function renderSimpleMarkdown(content: string) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1).filter(r => !r.every(c => c.trim().match(/^[-:]+$/)));
      elements.push(
        <div key={`table-${key}`} className="overflow-x-auto my-2 border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                {header.map((col, idx) => (
                  <th key={idx} className="p-2 border-r border-slate-200 last:border-r-0">
                    {col.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 border-r border-slate-100 last:border-r-0">
                      {formatInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line, idx) => {
    // Table rows detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cols = line.trim().slice(1, -1).split('|');
      tableRows.push(cols);
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1">
          {formatInlineMarkdown(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={idx} className="font-semibold text-slate-800 text-xs mt-1.5 mb-0.5">
          {formatInlineMarkdown(line.slice(5))}
        </h4>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
          <span className="text-slate-400 select-none">•</span>
          <span className="text-slate-700">{formatInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={idx} className="my-2 border-slate-200" />);
    } else if (line.trim().length > 0) {
      elements.push(
        <p key={idx} className="my-1 text-slate-700 leading-relaxed">
          {formatInlineMarkdown(line)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return elements;
}

function formatInlineMarkdown(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-800 border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
