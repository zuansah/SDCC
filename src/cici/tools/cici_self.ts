import { ToolDeclaration, ToolExecutionContext, MemoryType } from '../types';

export const helpText = {
  menu: 'Cici Agent Memory & Documents',
  summary: 'Cici internal capabilities: memory recall/write, document authoring (reports, summaries, handovers), and watch reminders.',
  mainActions: [
    'Store durable user facts, preferences, and ongoing work',
    'Generate Markdown reports and documents from operational data',
    'Set reminders and condition watches',
  ],
  filters: [],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'recall',
    description: 'Retrieves the full body of stored user memories matching a topic or query keyword.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Keyword to search stored memories (e.g. area, tenant, preference)' },
      },
    },
  },
  {
    name: 'remember',
    description: 'Saves a new durable fact, user preference, ongoing work, or reference about the user into personal Markdown memory. Never store passwords, tokens, or customer phone numbers.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Short kebab-case slug identifier (e.g. "covers-kalimantan", "prefers-bahasa")' },
        description: { type: 'STRING', description: 'One-line summary used for the memory index' },
        type: { type: 'STRING', enum: ['user', 'preference', 'work', 'reference'], description: 'Memory category' },
        body: { type: 'STRING', description: 'Full Markdown content. Include **Why:** and **How to apply:** for preferences.' },
      },
      required: ['name', 'description', 'type', 'body'],
    },
  },
  {
    name: 'forget',
    description: 'Deletes a specific stored memory by its slug name when requested by the user or when no longer accurate.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Slug name of the memory to remove' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_documents',
    description: 'Lists all Markdown documents authored by Cici for this user.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_document',
    description: 'Retrieves the complete Markdown content of an authored document by docId.',
    parameters: {
      type: 'OBJECT',
      properties: {
        docId: { type: 'STRING', description: 'The document ID' },
      },
      required: ['docId'],
    },
  },
  {
    name: 'create_document',
    description: 'Creates and saves a formal Markdown document (report, summary, handover, checklist, note) with data sourced from tool calls. Always end with a "Sumber data" section.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Document title' },
        kind: { type: 'STRING', enum: ['report', 'summary', 'handover', 'checklist', 'note'], description: 'Type of document' },
        markdown: { type: 'STRING', description: 'Full Markdown content formatted with headers, tables, and data source timestamps' },
      },
      required: ['title', 'kind', 'markdown'],
    },
  },
  {
    name: 'update_document',
    description: 'Updates or revises an existing Markdown document (e.g. adding a recommendations section).',
    parameters: {
      type: 'OBJECT',
      properties: {
        docId: { type: 'STRING', description: 'ID of the document to revise' },
        markdown: { type: 'STRING', description: 'Updated complete Markdown text' },
      },
      required: ['docId', 'markdown'],
    },
  },
  {
    name: 'create_reminder',
    description: 'Sets a follow-up reminder or condition watch (e.g. alert when ticket DWN-2026-00045 is resolved or edge comes back UP).',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Reminder description' },
        due: { type: 'STRING', description: 'Optional due timestamp or date string' },
        watchType: { type: 'STRING', enum: ['ticket_closed', 'device_up', 'order_status'], description: 'Condition to monitor' },
        watchTarget: { type: 'STRING', description: 'Ticket number, device serial, or order number being watched' },
      },
      required: ['text'],
    },
  },
];

export const handlers = {
  recall: async (args: any, context: ToolExecutionContext) => {
    const memories = await context.recallMemories(args.query);
    return {
      query: args.query || 'All memories',
      count: memories.length,
      memories: memories.map(m => ({
        name: m.name,
        type: m.type,
        description: m.description,
        body: m.body,
        updatedAt: m.updatedAt,
      })),
    };
  },

  remember: async (args: any, context: ToolExecutionContext) => {
    await context.remember({
      name: args.name,
      description: args.description,
      type: (args.type || 'user') as MemoryType,
      body: args.body,
    });

    return {
      status: 'saved',
      name: args.name,
      description: args.description,
      note: `Cici mencatat: ${args.description}`,
    };
  },

  forget: async (args: any, context: ToolExecutionContext) => {
    const success = await context.forget(args.name);
    return {
      status: success ? 'deleted' : 'not_found',
      name: args.name,
      message: success ? `Memory '${args.name}' has been forgotten.` : `No memory named '${args.name}' was found.`,
    };
  },

  list_documents: async (_args: any, context: ToolExecutionContext) => {
    const docs = await (context as any).listDocuments?.() || [];
    return {
      count: docs.length,
      documents: docs.map((d: any) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        updatedAt: d.updatedAt,
      })),
    };
  },

  get_document: async (args: any, context: ToolExecutionContext) => {
    const doc = await (context as any).getDocument?.(args.docId);
    if (!doc) {
      return { error: `Document '${args.docId}' not found.` };
    }
    return {
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      markdown: doc.markdown,
      sources: doc.sources,
      updatedAt: doc.updatedAt,
    };
  },

  create_document: async (args: any, context: ToolExecutionContext) => {
    const created = await context.saveDocument({
      title: args.title,
      kind: args.kind,
      markdown: args.markdown,
      sources: ['NSM Controller Feed', 'Asset Inventory', 'Intelligence Engine'],
    });

    return {
      status: 'created',
      docId: created.id,
      title: created.title,
      kind: created.kind,
      message: `Document "${created.title}" successfully created.`,
    };
  },

  update_document: async (args: any, context: ToolExecutionContext) => {
    const updated = await (context as any).updateDocument?.(args.docId, args.markdown);
    return {
      status: 'updated',
      docId: args.docId,
      message: `Document '${args.docId}' revised successfully.`,
    };
  },

  create_reminder: async (args: any, context: ToolExecutionContext) => {
    await context.addReminder({
      text: args.text,
      due: args.due,
      watch: args.watchType && args.watchTarget ? {
        type: args.watchType,
        target: args.watchTarget,
        condition: `${args.watchType} on ${args.watchTarget}`,
      } : undefined,
    });

    return {
      status: 'scheduled',
      message: `Reminder set: "${args.text}"${args.watchTarget ? ` (watching ${args.watchTarget})` : ''}`,
    };
  },
};
