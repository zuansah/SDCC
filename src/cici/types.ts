export type MemoryType = 'user' | 'preference' | 'work' | 'reference';

export interface CiciMemory {
  id: string;
  name: string; // short kebab-case slug e.g. "prefers-bahasa"
  description: string; // one line summary used for recall index
  type: MemoryType;
  body: string; // Markdown text, plus **Why:** and **How to apply:** for preferences
  createdAt: string;
  updatedAt: string;
  source: 'cici' | 'user';
}

export interface CiciUserDoc {
  displayName?: string;
  role?: string;
  language?: 'id' | 'en';
  lastSeenAt?: string;
  briefSnapshot?: Record<string, 'up' | 'down'>;
  memoryEnabled?: boolean; // default true
}

export interface CiciReminder {
  id: string;
  text: string;
  due?: string;
  watch?: {
    type: 'ticket_closed' | 'device_up' | 'order_status';
    target: string;
    condition: string;
  };
  status: 'pending' | 'triggered' | 'dismissed';
  createdAt: string;
}

export interface CiciDocument {
  id: string;
  title: string;
  kind: 'report' | 'summary' | 'handover' | 'checklist' | 'note';
  markdown: string;
  createdAt: string;
  updatedAt: string;
  sources: string[];
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResultRecord {
  toolCallId: string;
  name: string;
  result: any;
  summaryChip?: string;
}

export interface AgentPlanStep {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface CiciActionCard {
  id: string;
  type: 'assurance_ticket' | 'close_assurance_ticket' | 'export' | 'navigation' | 'handover_text';
  title: string;
  description: string;
  payload: Record<string, any>;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'executed';
  createdAt: string;
}

export interface CiciMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  toolCalls?: ToolCallRecord[];
  toolResults?: ToolResultRecord[];
  plan?: AgentPlanStep[];
  sources?: string[];
  actions?: CiciActionCard[];
  memoryNote?: {
    action: 'remember' | 'forget';
    name: string;
    description: string;
    memoryId?: string;
  };
  docCard?: {
    docId: string;
    title: string;
    kind: string;
  };
  suggestedNextSteps?: string[];
  createdAt: string;
}

export interface CiciThread {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  summary?: string;
}

export interface PageContext {
  menu: string; // e.g. 'monitoring', 'ticket', 'orders', 'projects', 'inventory', etc.
  selectedItemType?: 'device' | 'ticket' | 'order' | 'ba' | 'label';
  selectedItemId?: string; // serial, ticket number, order number, etc.
  selectedItemData?: Record<string, any>;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, {
      type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
      description: string;
      enum?: string[];
      items?: any;
    }>;
    required?: string[];
  };
}

export interface ToolExecutionContext {
  currentUser?: {
    uid: string;
    email?: string;
    role?: string;
    allowedViews?: string[];
  };
  pageContext?: PageContext;
  // Shared in-memory data feeds
  sharedData?: {
    controllersPayload?: any;
    inventoryPayload?: any;
    ordersPayload?: any;
    assurancePayload?: any;
    intelligencePayload?: any;
    bas?: any[];
  };
  // Actions
  proposeAction: (action: Omit<CiciActionCard, 'id' | 'status' | 'createdAt'>) => string;
  remember: (mem: { name: string; description: string; type: MemoryType; body: string }) => Promise<void>;
  forget: (name: string) => Promise<boolean>;
  saveDocument: (doc: Omit<CiciDocument, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CiciDocument>;
  addReminder: (rem: Omit<CiciReminder, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  recallMemories: (query?: string) => Promise<CiciMemory[]>;
}
