import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'SD-WAN Assurance (InSERA)',
  summary: 'Operation ▸ SD-WAN Assurance module synchronizes customer trouble tickets with Telkom InSERA enterprise incident management.',
  mainActions: [
    'Track InSERA incident tickets by customer / tenant',
    'Monitor MTTR (Mean Time to Repair) and SLA thresholds',
    'Export incident assurance reports',
  ],
  filters: ['Status (Open / In Progress / Resolved)', 'Customer / Tenant', 'Priority / Severity'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'find_insera_ticket',
    description: 'Finds InSERA SD-WAN assurance tickets by customer query, incident status, or tenant.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Ticket number, site name, or issue keyword' },
        status: { type: 'STRING', description: 'OPEN, IN_PROGRESS, RESOLVED' },
        tenant: { type: 'STRING', description: 'Tenant name (e.g. Bank Mandiri, Pelindo)' },
      },
    },
  },
  {
    name: 'propose_assurance_export',
    description: 'Proposes exporting InSERA assurance incident records to CSV or Excel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: { type: 'STRING', enum: ['csv', 'excel'], description: 'File export format' },
      },
    },
  },
];

export const handlers = {
  find_insera_ticket: async (args: any, context: ToolExecutionContext) => {
    const rawAssurance = context.sharedData?.assurancePayload?.tickets || [];
    let filtered = [...rawAssurance];

    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter((t: any) =>
        (t.ticketNumber || t.id || '').toLowerCase().includes(q) ||
        (t.siteName || t.site || '').toLowerCase().includes(q) ||
        (t.customer || t.tenant || '').toLowerCase().includes(q)
      );
    }

    if (args.status) {
      const s = args.status.toLowerCase();
      filtered = filtered.filter((t: any) => (t.status || '').toLowerCase() === s);
    }

    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      filtered = filtered.filter((t: any) => (t.customer || t.tenant || '').toLowerCase().includes(tn));
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((t: any) => ({
      ticketNumber: t.ticketNumber || t.id,
      customer: t.customer || t.tenant,
      site: t.siteName || t.site,
      status: t.status || 'OPEN',
      issue: t.issue || t.summary || 'Underlay link loss',
      slaRemaining: t.slaRemaining || '2h 45m',
    }));

    return { total, count: capped.length, tickets: capped };
  },

  propose_assurance_export: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'export',
      title: 'Export InSERA Assurance Tickets',
      description: `Download assurance dataset in ${args.format || 'CSV'} format`,
      payload: { module: 'assurance', format: args.format || 'csv' },
    });

    return {
      status: 'proposed',
      action: 'export',
      message: 'InSERA assurance export proposed for user confirmation.',
    };
  },
};
