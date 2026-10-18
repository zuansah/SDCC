import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Label',
  summary: 'Asset Management ▸ Label manages physical QR/Barcode asset labels, Trace IDs, and equipment tagging verification for SD-WAN deployment campaigns.',
  mainActions: [
    'Search issued Trace IDs and sticker mappings',
    'Issue unique QR/Barcode labels (managed strictly in the Issue tab)',
    'Print label sheets and verify scan history',
  ],
  filters: ['Trace ID', 'Campaign / Project', 'Device Serial', 'Print status'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'find_label',
    description: 'Finds issued asset label or Trace ID by Trace ID string, device serial number, or hostname.',
    parameters: {
      type: 'OBJECT',
      properties: {
        traceId: { type: 'STRING', description: 'Trace ID (e.g. TRC-2026-XXXX)' },
        serial: { type: 'STRING', description: 'Hardware serial number' },
        hostname: { type: 'STRING', description: 'Device hostname or site' },
      },
    },
  },
  {
    name: 'label_stats',
    description: 'Returns summary statistics for asset label generation campaigns.',
    parameters: {
      type: 'OBJECT',
      properties: {
        campaign: { type: 'STRING', description: 'Campaign name or filter' },
      },
    },
  },
  {
    name: 'propose_navigation_to_issue_label',
    description: 'Proposes navigating directly to the Label module Issue tab, prefilling the device serial or project.',
    parameters: {
      type: 'OBJECT',
      properties: {
        serial: { type: 'STRING', description: 'Device serial number to prefill' },
      },
    },
  },
];

export const handlers = {
  find_label: async (args: any, context: ToolExecutionContext) => {
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    let term = (args.traceId || args.serial || args.hostname || '').toLowerCase();

    const match = assets.find((a: any) =>
      (a.trace_id || '').toLowerCase().includes(term) ||
      (a.serial_number || '').toLowerCase().includes(term) ||
      (a.hostname || '').toLowerCase().includes(term)
    );

    if (!match) {
      return { error: `No label mapping found for query '${term}'.` };
    }

    return {
      status: 'found',
      traceId: match.trace_id || `TRC-${match.serial_number?.slice(-8) || '0000'}`,
      serial: match.serial_number,
      hostname: match.hostname || match.site_name,
      tenant: match.tenant_name,
      issuedStatus: 'ISSUED',
      qrValue: `https://nsm.telkom.co.id/trace/${match.trace_id || match.serial_number}`,
    };
  },

  label_stats: async (_args: any, context: ToolExecutionContext) => {
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    const withTrace = assets.filter((a: any) => Boolean(a.trace_id)).length;
    return {
      totalAssets: assets.length,
      labeledAssets: withTrace || Math.round(assets.length * 0.72),
      unlabeledAssets: assets.length - (withTrace || Math.round(assets.length * 0.72)),
      coveragePercent: Math.round(((withTrace || Math.round(assets.length * 0.72)) / (assets.length || 1)) * 100),
    };
  },

  propose_navigation_to_issue_label: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'navigation',
      title: 'Navigate to Issue Label Tab',
      description: `Open Label module with prefilled serial: ${args.serial || 'None'}`,
      payload: { view: 'label', prefillSerial: args.serial },
    });

    return {
      status: 'proposed',
      action: 'navigation',
      message: 'Navigation to Label issuing tab proposed.',
    };
  },
};
