import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Project List & PM (Berita Acara)',
  summary: 'Fulfillment modules for authoring, reviewing, and approving Berita Acara (BA) handover documents and photo evidence for Telkom SD-WAN deployments.',
  mainActions: [
    'Create or edit BA installation documents',
    'Attach and verify 10 required evidence photos with AI vision validation',
    'Generate approved signed BA PDF and digital signature QR',
  ],
  filters: ['Project', 'Approval status', 'Technician', 'Customer / Tenant'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'list_bas',
    description: 'Lists Berita Acara (BA) documents with optional filters for project, approval status, or technician name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        project: { type: 'STRING', description: 'Filter by project name (e.g. Bank Mandiri, Telkom)' },
        status: { type: 'STRING', description: 'Filter by status (e.g. Draft, Submitted, Approved, Rejected)' },
        technician: { type: 'STRING', description: 'Filter by technician name' },
      },
    },
  },
  {
    name: 'get_ba',
    description: 'Retrieves full details of a specific Berita Acara document by its ID or BA number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'BA document ID or BA number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'ba_missing_items',
    description: 'Inspects a Berita Acara to identify which required evidence photo fields are missing, empty, or failed the AI photo verification check.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'BA document ID or BA number' },
      },
      required: ['id'],
    },
  },
  {
    name: 'propose_navigation_to_ba',
    description: 'Proposes opening a specific BA document in the editor/preview, optionally prefilling filter or fields for the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        baId: { type: 'STRING', description: 'The BA document ID to open' },
        action: { type: 'STRING', description: 'edit or preview', enum: ['edit', 'preview'] },
      },
      required: ['baId'],
    },
  },
];

const REQUIRED_PHOTO_FIELDS = [
  { key: 'rackBeforeImg', label: 'Rack Before' },
  { key: 'rackAfterImg', label: 'Rack After' },
  { key: 'frontViewImg', label: 'Front View' },
  { key: 'equipmentPlacementImg', label: 'Equipment Placement' },
  { key: 'sdwanBoxImg', label: 'SDWAN Box' },
  { key: 'cablingSdwanImg', label: 'Cabling SDWAN' },
  { key: 'snSdwanImg', label: 'SN SDWAN' },
  { key: 'snOntImg', label: 'SN ONT' },
  { key: 'pingAstinetImg', label: 'Ping Astinet' },
  { key: 'pingTracerouteImg', label: 'Ping Traceroute' },
];

export const handlers = {
  list_bas: async (args: any, context: ToolExecutionContext) => {
    const bas = context.sharedData?.bas || [];
    let filtered = [...bas];

    if (args.project) {
      const q = args.project.toLowerCase();
      filtered = filtered.filter((b: any) =>
        (b.projectName || b.tenant || b.siteName || '').toLowerCase().includes(q)
      );
    }
    if (args.status) {
      const s = args.status.toLowerCase();
      filtered = filtered.filter((b: any) => (b.status || '').toLowerCase() === s);
    }
    if (args.technician) {
      const t = args.technician.toLowerCase();
      filtered = filtered.filter((b: any) =>
        (b.technicianName || b.author || '').toLowerCase().includes(t)
      );
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((b: any) => ({
      id: b.id,
      baNumber: b.baNumber || b.noBa || b.id,
      projectName: b.projectName || b.tenant || 'Telkom SD-WAN',
      siteName: b.siteName || b.location || '—',
      technician: b.technicianName || b.author || '—',
      status: b.status || 'Draft',
      updatedAt: b.updatedAt || b.createdAt || '—',
    }));

    return { total, count: capped.length, bas: capped };
  },

  get_ba: async (args: any, context: ToolExecutionContext) => {
    const bas = context.sharedData?.bas || [];
    const id = (args.id || '').trim().toLowerCase();
    const found = bas.find((b: any) =>
      (b.id || '').toLowerCase() === id || (b.baNumber || '').toLowerCase() === id || (b.noBa || '').toLowerCase() === id
    );

    if (!found) {
      return { error: `Berita Acara '${args.id}' not found in current project database.` };
    }

    return {
      id: found.id,
      baNumber: found.baNumber || found.noBa || found.id,
      projectName: found.projectName || found.tenant,
      siteName: found.siteName || found.location,
      customerName: found.customerName || found.tenant,
      technician: found.technicianName,
      status: found.status || 'Draft',
      serialNumber: found.serialNumber || found.snSdwan,
      evidenceChecks: found.evidenceChecks || {},
      missingEvidenceFields: REQUIRED_PHOTO_FIELDS.filter(f => !found[f.key]).map(f => f.label),
    };
  },

  ba_missing_items: async (args: any, context: ToolExecutionContext) => {
    const bas = context.sharedData?.bas || [];
    const id = (args.id || '').trim().toLowerCase();
    const found = bas.find((b: any) =>
      (b.id || '').toLowerCase() === id || (b.baNumber || '').toLowerCase() === id
    );

    if (!found) {
      return { error: `Berita Acara '${args.id}' not found.` };
    }

    const missingUploads: string[] = [];
    const failedAiChecks: Array<{ field: string; issues: string[] }> = [];
    const checks = found.evidenceChecks || {};

    for (const f of REQUIRED_PHOTO_FIELDS) {
      const val = found[f.key];
      if (!val) {
        missingUploads.push(f.label);
      } else {
        const c = checks[f.key];
        if (c && c.ok === false) {
          failedAiChecks.push({
            field: f.label,
            issues: c.issues || ['Subject mismatch or unreadable image'],
          });
        }
      }
    }

    return {
      id: found.id,
      baNumber: found.baNumber || found.id,
      siteName: found.siteName || found.projectName,
      isComplete: missingUploads.length === 0 && failedAiChecks.length === 0,
      missingPhotosCount: missingUploads.length,
      missingPhotos: missingUploads,
      failedAiChecksCount: failedAiChecks.length,
      failedAiChecks,
      summary: missingUploads.length === 0 && failedAiChecks.length === 0
        ? 'All 10 required evidence photos are uploaded and passed AI verification.'
        : `Missing ${missingUploads.length} photo(s) [${missingUploads.join(', ')}] and ${failedAiChecks.length} photo(s) flagged by AI check.`,
    };
  },

  propose_navigation_to_ba: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'navigation',
      title: `Open Berita Acara (${args.action === 'edit' ? 'Edit Mode' : 'Preview Mode'})`,
      description: `Navigate to BA document ID ${args.baId}`,
      payload: {
        view: args.action === 'edit' ? 'edit-ba' : 'preview-ba',
        baId: args.baId,
      },
    });

    return {
      status: 'proposed',
      action: 'navigation',
      message: `Proposed navigation to BA ${args.baId}. Click the button to proceed.`,
    };
  },
};
