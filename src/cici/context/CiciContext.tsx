import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { 
  CiciMessage, 
  PageContext, 
  CiciMemory, 
  CiciDocument, 
  CiciReminder, 
  AgentPlanStep, 
  CiciActionCard,
  ToolExecutionContext 
} from '../types';
import { 
  getCiciUserProfile, 
  updateCiciUserProfile, 
  loadAllMemories, 
  loadMemoryIndex, 
  loadRecentThreadSummaries, 
  saveMemory, 
  deleteMemory as deleteMemDoc, 
  clearAllMemories as clearAllMems,
  loadAllDocuments, 
  saveCiciDocument, 
  updateCiciDocument,
  loadReminders, 
  saveReminder,
  saveThreadSummary
} from '../services/memoryService';
import { checkAndGenerateBrief } from '../services/briefService';
import { runCiciAgentLoop } from '../services/ciciAgentLoop';

// Shared in-memory data feeds hooks
import { useControllerData } from '../../hooks/useControllerData';
import { useInventoryData } from '../../hooks/useInventoryData';
import { useOrdersData } from '../../hooks/useOrdersData';
import { useAssuranceData } from '../../hooks/useAssuranceData';
import { useIntelligenceData } from '../../hooks/useIntelligenceData';

interface CiciContextValue {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  messages: CiciMessage[];
  sendMessage: (text: string, contextOverride?: Partial<PageContext>) => Promise<void>;
  isRunning: boolean;
  stopRunning: () => void;
  activePlan: AgentPlanStep[];
  toolActivity: { name: string; status: string } | null;
  pageContext: PageContext;
  setPageContext: React.Dispatch<React.SetStateAction<PageContext>>;
  askCici: (prompt: string, contextOverride?: Partial<PageContext>) => void;
  memories: CiciMemory[];
  refreshMemories: () => Promise<void>;
  removeMemory: (name: string) => Promise<boolean>;
  clearAllMemories: () => Promise<void>;
  memoryEnabled: boolean;
  toggleMemoryEnabled: (enabled: boolean) => Promise<void>;
  documents: CiciDocument[];
  refreshDocuments: () => Promise<void>;
  reminders: CiciReminder[];
  refreshReminders: () => Promise<void>;
  confirmAction: (action: CiciActionCard) => Promise<void>;
  cancelAction: (actionId: string) => void;
  startNewThread: () => Promise<void>;
  currentUserRole?: string;
  onNavigate?: (view: string, payload?: any) => void;
  setOnNavigate: (fn: (view: string, payload?: any) => void) => void;
}

const CiciContext = createContext<CiciContextValue | undefined>(undefined);

export const CiciProvider: React.FC<{ 
  children: React.ReactNode; 
  userRole?: string; 
  userAllowedViews?: string[];
  initialBAs?: any[];
}> = ({
  children,
  userRole,
  userAllowedViews,
  initialBAs = [],
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<CiciMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activePlan, setActivePlan] = useState<AgentPlanStep[]>([]);
  const [toolActivity, setToolActivity] = useState<{ name: string; status: string } | null>(null);
  const [pageContext, setPageContext] = useState<PageContext>({ menu: 'dashboard' });

  // Memories & Documents state
  const [memories, setMemories] = useState<CiciMemory[]>([]);
  const [documents, setDocuments] = useState<CiciDocument[]>([]);
  const [reminders, setReminders] = useState<CiciReminder[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // In-memory operational feeds
  const { data: controllerPayload } = useControllerData();
  const { data: inventoryPayload } = useInventoryData();
  const { data: ordersPayload } = useOrdersData();
  const { data: assurancePayload } = useAssuranceData();
  const { data: intelligencePayload } = useIntelligenceData();

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeThreadIdRef = useRef<string>(`thread-${Date.now()}`);
  const navigateHandlerRef = useRef<((view: string, payload?: any) => void) | null>(null);

  const setOnNavigate = useCallback((fn: (view: string, payload?: any) => void) => {
    navigateHandlerRef.current = fn;
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);

  const refreshMemories = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const list = await loadAllMemories(uid);
    setMemories(list);
    const profile = await getCiciUserProfile(uid);
    setMemoryEnabled(profile.memoryEnabled !== false);
  }, []);

  const refreshDocuments = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const docs = await loadAllDocuments(uid);
    setDocuments(docs);
  }, []);

  const refreshReminders = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const rems = await loadReminders(uid);
    setReminders(rems);
  }, []);

  // Initial user loading & automatic brief check
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setMessages([]);
        setMemories([]);
        return;
      }

      await refreshMemories();
      await refreshDocuments();
      await refreshReminders();

      // Check for automatic morning / session brief
      try {
        const briefRes = await checkAndGenerateBrief(
          user.uid,
          user.displayName || user.email?.split('@')[0] || 'Rekan Ops',
          {
            controllersPayload: controllerPayload,
            inventoryPayload: inventoryPayload,
            ordersPayload: ordersPayload,
            assurancePayload: assurancePayload,
            intelligencePayload: intelligencePayload,
          }
        );

        if (briefRes.needsBrief && briefRes.briefMarkdown) {
          setMessages([
            {
              id: `msg-brief-${Date.now()}`,
              role: 'assistant',
              text: briefRes.briefMarkdown,
              createdAt: new Date().toISOString(),
              suggestedNextSteps: [
                'Tampilkan detail tiket yang NEEDS ATTENTION',
                'Periksa lokasi yang diprediksi mati hari ini',
                'Buatkan laporan status nasional SD-WAN',
              ],
            },
          ]);
        } else if (messages.length === 0) {
          // Welcoming message for first interaction
          setMessages([
            {
              id: `msg-welcome-${Date.now()}`,
              role: 'assistant',
              text: `Halo, saya **Cici**, asisten cerdas operasional NSM Telkom Indonesia. Saya siap membantu kamu memeriksa perangkat, tiket, order, bukti Berita Acara, serta menyusun laporan di seluruh modul NSM.\n\nApa yang ingin kamu periksa hari ini?`,
              createdAt: new Date().toISOString(),
              suggestedNextSteps: [
                'Ringkas status nasional SD-WAN saat ini',
                'Tiket apa saja yang perlu perhatian teknis hari ini?',
                'Cek kelengkapan foto Berita Acara minggu ini',
              ],
            },
          ]);
        }
      } catch (err) {
        console.error('Failed checking initial brief:', err);
      }
    });

    return () => unsubscribe();
  }, [controllerPayload, inventoryPayload, ordersPayload, assurancePayload, intelligencePayload, refreshMemories, refreshDocuments, refreshReminders]);

  const stopRunning = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setToolActivity(null);
    }
  }, []);

  const startNewThread = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid && messages.length > 1) {
      const threadSummary = `User discussed: ${messages.slice(-4).map(m => m.text.slice(0, 80)).join('; ')}`;
      await saveThreadSummary(uid, activeThreadIdRef.current, threadSummary, messages[1]?.text.slice(0, 30));
    }
    activeThreadIdRef.current = `thread-${Date.now()}`;
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        text: 'Sesi baru dimulai. Apa yang bisa Cici bantu?',
        createdAt: new Date().toISOString(),
        suggestedNextSteps: [
          'Ringkas status nasional SD-WAN saat ini',
          'Tampilkan tiket yang butuh perhatian hari ini',
          'Apa yang kamu ingat tentang saya?',
        ],
      },
    ]);
  }, [messages]);

  const sendMessage = useCallback(async (text: string, contextOverride?: Partial<PageContext>) => {
    if (!text.trim() || isRunning) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert('Harap login terlebih dahulu untuk berinteraksi dengan Cici.');
      return;
    }

    const effectivePageContext: PageContext = {
      ...pageContext,
      ...(contextOverride || {}),
    };

    const userMsg: CiciMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsRunning(true);
    setActivePlan([]);
    setToolActivity(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. Load memory index & thread summaries
      const [memIndex, threadSums, profile] = await Promise.all([
        loadMemoryIndex(uid),
        loadRecentThreadSummaries(uid, 3),
        getCiciUserProfile(uid),
      ]);

      const allowedViewsList = userRole === 'Super Admin'
        ? 'ALL_MODULES (Full Super Admin Access)'
        : ((userAllowedViews && userAllowedViews.length > 0)
            ? userAllowedViews.join(', ')
            : 'dashboard, monitoring, ticket');

      const userProfileText = `UID: ${uid}
Email: ${auth.currentUser?.email || 'unknown'}
Role: ${userRole || profile.role || 'Operator'}
Allowed Views: ${allowedViewsList}
Language: ${profile.language || 'id'}
Memory Storage: ${profile.memoryEnabled === false ? 'DISABLED BY USER' : 'ENABLED'}`;

      // 2. Build ToolExecutionContext
      const toolContext: ToolExecutionContext = {
        currentUser: {
          uid,
          email: auth.currentUser?.email || '',
          role: userRole || 'Operator',
          allowedViews: userRole === 'Super Admin'
            ? ['dashboard', 'projects', 'project_management', 'orders', 'tracking', 'monitoring', 'controller', 'ticket', 'assurance', 'intelligence', 'license', 'inventory', 'tracing', 'label', 'mass-testing-uat', 'open-sdwan', 'automation', 'api', 'admin-users']
            : (userAllowedViews || ['dashboard', 'projects', 'project_management', 'monitoring', 'ticket']),
        },
        pageContext: effectivePageContext,
        sharedData: {
          controllersPayload: controllerPayload,
          inventoryPayload: inventoryPayload,
          ordersPayload: ordersPayload,
          assurancePayload: assurancePayload,
          intelligencePayload: intelligencePayload,
          bas: initialBAs,
        },
        proposeAction: (act) => {
          return `action-${Date.now()}`;
        },
        remember: async (mem) => {
          await saveMemory(uid, mem);
          await refreshMemories();
        },
        forget: async (name) => {
          const res = await deleteMemDoc(uid, name);
          await refreshMemories();
          return res;
        },
        saveDocument: async (docData) => {
          const created = await saveCiciDocument(uid, docData);
          await refreshDocuments();
          return created;
        },
        addReminder: async (rem) => {
          await saveReminder(uid, rem);
          await refreshReminders();
        },
        recallMemories: async (_query) => {
          return loadAllMemories(uid);
        },
      };

      // 3. Run Agent Loop
      const result = await runCiciAgentLoop({
        userPrompt: text.trim(),
        history: messages,
        pageContext: effectivePageContext,
        userProfileText,
        memoryIndexText: memIndex,
        threadSummariesText: threadSums,
        toolContext,
        onUpdatePlan: (plan) => setActivePlan(plan),
        onToolActivity: (name, status) => setToolActivity({ name, status }),
        signal: abortController.signal,
      });

      const assistantMsg: CiciMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        text: result.finalText,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        sources: result.sources,
        plan: result.plan,
        actions: result.actions,
        memoryNote: result.memoryNote,
        docCard: result.docCard,
        suggestedNextSteps: result.suggestedNextSteps,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Cici loop aborted by user');
      } else {
        console.error('Error in Cici agent loop:', err);
        setMessages(prev => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            text: `Maaf, terjadi kendala saat memproses permintaanmu: ${err?.message || 'Koneksi ke model terganggu'}. Silakan coba lagi.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsRunning(false);
      setToolActivity(null);
      abortControllerRef.current = null;
    }
  }, [isRunning, pageContext, messages, userRole, userAllowedViews, controllerPayload, inventoryPayload, ordersPayload, assurancePayload, intelligencePayload, initialBAs, refreshMemories, refreshDocuments, refreshReminders]);

  const askCici = useCallback((prompt: string, contextOverride?: Partial<PageContext>) => {
    setIsDrawerOpen(true);
    if (contextOverride) {
      setPageContext(prev => ({ ...prev, ...contextOverride }));
    }
    sendMessage(prompt, contextOverride);
  }, [sendMessage]);

  const removeMemory = useCallback(async (name: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const res = await deleteMemDoc(uid, name);
    await refreshMemories();
    return res;
  }, [refreshMemories]);

  const clearAllMemoriesHandler = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await clearAllMems(uid);
    await refreshMemories();
  }, [refreshMemories]);

  const toggleMemoryEnabled = useCallback(async (enabled: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateCiciUserProfile(uid, { memoryEnabled: enabled });
    setMemoryEnabled(enabled);
  }, []);

  const confirmAction = useCallback(async (action: CiciActionCard) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if (userRole === 'Viewer') {
      alert('Peranmu tidak bisa mengubah data.');
      return;
    }

    try {
      if (action.type === 'assurance_ticket') {
        // Write to collection 'assurance_tickets'
        const docRef = await addDoc(collection(db, 'assurance_tickets'), {
          ...action.payload,
          status: 'OPEN',
          authorUid: uid,
          authorEmail: auth.currentUser?.email || '',
          source: 'cici_agent',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Audit log
        await addDoc(collection(db, 'access_logs'), {
          uid,
          userEmail: auth.currentUser?.email || '',
          type: 'cici_action',
          action: 'CREATE_ASSURANCE_TICKET',
          target: docRef.id,
          payload: action.payload,
          at: serverTimestamp(),
        });

        action.status = 'executed';
        setMessages(prev => [
          ...prev,
          {
            id: `msg-confirm-${Date.now()}`,
            role: 'assistant',
            text: `✅ **Tiket Assurance berhasil dibuat** untuk site **${action.payload.siteName}** (ID: \`${docRef.id}\`).`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else if (action.type === 'close_assurance_ticket') {
        const ticketRef = doc(db, 'assurance_tickets', action.payload.ticketId);
        await updateDoc(ticketRef, {
          status: 'RESOLVED',
          resolutionNote: action.payload.resolutionNote,
          resolvedAt: serverTimestamp(),
          resolvedBy: uid,
        });

        await addDoc(collection(db, 'access_logs'), {
          uid,
          userEmail: auth.currentUser?.email || '',
          type: 'cici_action',
          action: 'CLOSE_ASSURANCE_TICKET',
          target: action.payload.ticketId,
          at: serverTimestamp(),
        });

        action.status = 'executed';
        setMessages(prev => [
          ...prev,
          {
            id: `msg-confirm-${Date.now()}`,
            role: 'assistant',
            text: `✅ Tiket Assurance **${action.payload.ticketId}** telah ditandai **RESOLVED**.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else if (action.type === 'navigation') {
        action.status = 'executed';
        if (navigateHandlerRef.current && action.payload.view) {
          navigateHandlerRef.current(action.payload.view, action.payload);
        }
      }
    } catch (err: any) {
      console.error('Failed executing action:', err);
      alert(`Gagal mengeksekusi aksi: ${err?.message || 'error'}`);
    }
  }, [userRole]);

  const cancelAction = useCallback((actionId: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (!msg.actions) return msg;
        return {
          ...msg,
          actions: msg.actions.map(a => (a.id === actionId ? { ...a, status: 'cancelled' } : a)),
        };
      })
    );
  }, []);

  return (
    <CiciContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        messages,
        sendMessage,
        isRunning,
        stopRunning,
        activePlan,
        toolActivity,
        pageContext,
        setPageContext,
        askCici,
        memories,
        refreshMemories,
        removeMemory,
        clearAllMemories: clearAllMemoriesHandler,
        memoryEnabled,
        toggleMemoryEnabled,
        documents,
        refreshDocuments,
        reminders,
        refreshReminders,
        confirmAction,
        cancelAction,
        startNewThread,
        currentUserRole: userRole,
        setOnNavigate,
      }}
    >
      {children}
    </CiciContext.Provider>
  );
};

export function useCici() {
  const context = useContext(CiciContext);
  if (!context) {
    throw new Error('useCici must be used within a CiciProvider');
  }
  return context;
}
