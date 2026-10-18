import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Bot, User, RefreshCw, CheckCircle2, AlertCircle, 
  Database, ShieldCheck, ShoppingCart, Cpu, Layers, HelpCircle, 
  Copy, Check, StopCircle, ArrowDownCircle, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useControllerData } from '../hooks/useControllerData';
import { useInventoryData } from '../hooks/useInventoryData';
import { useOrdersData } from '../hooks/useOrdersData';
import { useAssuranceData } from '../hooks/useAssuranceData';
import { getIntelligenceData } from '../services/intelligenceService';
import { IntelligencePayload } from '../types/intelligence';
import { buildCompactGroundingContext, GroundingSource } from '../services/copilotGrounding';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: GroundingSource[];
  isStreaming?: boolean;
}

const EXAMPLE_PROMPTS = [
  'Which sites go down every Saturday, and why?',
  'Which open tickets actually need attention today?',
  "What's the status of order 1-91988479428?",
  'Show me chronically unstable devices for Bank Mandiri.',
  'When is the Kendari site expected to go down next?'
];

export default function AIAssistantView() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your **NSM SD-WAN Operations Assistant** for Telkom Indonesia.

I can answer natural-language operational questions grounded strictly in our live operational feeds and intelligence engine findings.

**Try asking me:**
- *"Which sites go down every Saturday, and why?"*
- *"Which open tickets actually need attention today?"*
- *"What's the status of order 1-91988479428?"*
- *"Show me chronically unstable devices for Bank Mandiri."*
- *"When is the Kendari site expected to go down next?"*

How can I assist your operations shift today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligencePayload | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  // In-memory operational feeds
  const { data: controllerPayload } = useControllerData();
  const { data: inventoryPayload } = useInventoryData();
  const { data: ordersPayload } = useOrdersData();
  const { data: assurancePayload } = useAssuranceData();

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Preload intelligence engine output
  useEffect(() => {
    let mounted = true;
    getIntelligenceData()
      .then(res => {
        if (mounted) {
          setIntelligence(res);
          setIntelLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setIntelLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || isLoading) return;

    setInput('');

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Build compact grounding context locally from memory
    const operationalData = {
      intelligence,
      orders: ordersPayload?.orders || null,
      tickets: assurancePayload?.tickets || null,
      assets: inventoryPayload?.assets || null,
      controllers: controllerPayload?.controllers || null,
    };

    const grounding = buildCompactGroundingContext(q, operationalData);

    // 2. Add user message and assistant placeholder
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: q,
        timestamp,
      },
      {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        timestamp,
        sources: grounding.sources,
        isStreaming: true,
      }
    ]);

    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          context: grounding.contextText,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${response.status}`);
      }

      // Check if streaming SSE response
      if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const data = JSON.parse(trimmed.slice(5).trim());
                if (data.text) {
                  accumulatedText += data.text;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, text: accumulatedText }
                        : msg
                    )
                  );
                } else if (data.error) {
                  accumulatedText += `\n\n*[Error: ${data.error}]*`;
                }
              } catch (_) {}
            }
          }
        }

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, text: accumulatedText || 'No response generated from current operational context.', isStreaming: false }
              : msg
          )
        );
      } else {
        // Fallback standard JSON
        const data = await response.json();
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, text: data.text || 'No response returned.', isStreaming: false }
              : msg
          )
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, text: (msg.text || '') + '\n\n*(Generation stopped by user)*', isStreaming: false }
              : msg
          )
        );
      } else {
        console.error('Failed to get answer from AI Assistant:', err);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, text: `⚠️ **Unable to retrieve answer:** ${err?.message || 'Server error'}. Please verify connection and try again.`, isStreaming: false }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto w-full p-4 md:p-6">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">NSM AI Operations Copilot</h1>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Grounded Live
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ground-truth operational reasoning across live controllers, assets, orders, assurance & intelligence feeds.
              </p>
            </div>
          </div>

          {/* Live Feeds Status */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-200">
            <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              Active Feeds:
            </span>
            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200" title="AI Intelligence Engine output: patterns, predictions & triage">
              <Sparkles className="w-3 h-3 text-purple-600" />
              intelligence {intelLoading ? '...' : '✓'}
            </span>
            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200" title="SD-WAN Assurance & InSERA tickets">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              assurance ✓
            </span>
            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200" title="WFM Orders & Provisioning status">
              <ShoppingCart className="w-3 h-3 text-blue-600" />
              orders ✓
            </span>
            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200" title="SD-WAN CPEs and Assets Inventory">
              <Layers className="w-3 h-3 text-amber-600" />
              assets ✓
            </span>
            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200" title="Controller reachability & status">
              <Cpu className="w-3 h-3 text-cyan-600" />
              controllers ✓
            </span>
          </div>
        </div>

        {/* Quick Example Prompts */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Quick questions:
          </span>
          {EXAMPLE_PROMPTS.map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(promptText)}
              disabled={isLoading}
              className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.sender === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={cn(
                "max-w-3xl rounded-lg p-4 text-sm shadow-xs",
                msg.sender === 'user'
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
              )}
            >
              {/* Message text */}
              <div className="prose prose-slate prose-sm max-w-none dark:prose-invert leading-relaxed whitespace-pre-wrap">
                {msg.text || (msg.isStreaming && (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    Synthesizing grounded operations response...
                  </span>
                ))}
              </div>

              {/* Sources Accordion for Assistant Answers */}
              {msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5 font-medium">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Grounded from operational feeds:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src, i) => (
                      <div
                        key={i}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-600 flex items-center gap-1"
                      >
                        <span className="font-semibold text-slate-700">{src.feed}</span>
                        <span className="bg-indigo-100 text-indigo-700 px-1 rounded text-[10px] font-bold">
                          {src.matchedCount} {src.matchedCount === 1 ? 'row' : 'rows'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer info: time + copy button */}
              <div
                className={cn(
                  "mt-2 flex items-center justify-between text-[11px]",
                  msg.sender === 'user' ? "text-indigo-200" : "text-slate-400"
                )}
              >
                <span>{msg.timestamp}</span>
                {msg.sender === 'assistant' && msg.text && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="hover:text-slate-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="mt-4 bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about recurring Saturday outages, open tickets, order 1-91988479428, Bank Mandiri CPEs..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />

          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Ask Copilot
            </button>
          )}
        </form>

        <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400" />
            Strictly grounded in live memory feeds. Cap ~40 rows / ~6k tokens per query.
          </span>
          <button
            onClick={() => {
              setMessages([
                {
                  id: 'welcome-reset',
                  sender: 'assistant',
                  text: 'Chat history cleared. How can I assist your operations shift?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              ]);
            }}
            className="hover:text-slate-600 transition-colors cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Clear chat
          </button>
        </div>
      </div>
    </div>
  );
}
