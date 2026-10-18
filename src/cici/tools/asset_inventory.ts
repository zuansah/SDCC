import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Inventory',
  summary: 'Asset Management ▸ Inventory tracks SD-WAN hardware assets (Fortinet, Versa, ONT, switches), serial numbers, MAC addresses, warranty status, warehouse position, and assigned Witels.',
  mainActions: [
    'Search inventory assets by serial, SID, hostname, or barcode',
    'Inspect hardware lifecycle, license, and warehouse location',
    'Export inventory records',
  ],
  filters: ['Warehouse / Field Position', 'Customer / Tenant', 'Telkom Witel / Regional', 'Hardware Vendor'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'search_inventory',
    description: 'Searches asset inventory records by query keyword, warehouse/field position, tenant, witel, or coordinate availability.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Serial number, model, hostname, or SID' },
        position: { type: 'STRING', description: 'Warehouse, Installed Field, In Transit, RMA' },
        tenant: { type: 'STRING', description: 'Customer or tenant name' },
        witel: { type: 'STRING', description: 'Telkom Witel' },
        hasCoords: { type: 'BOOLEAN', description: 'Filter only assets with GPS coordinates' },
      },
    },
  },
  {
    name: 'inventory_stats',
    description: 'Aggregates inventory counts grouped by tenant, model/vendor, position, or witel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        groupBy: { type: 'STRING', enum: ['tenant', 'model', 'position', 'witel'], description: 'Group dimension' },
      },
      required: ['groupBy'],
    },
  },
  {
    name: 'propose_inventory_export',
    description: 'Proposes exporting inventory assets to CSV or Excel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: { type: 'STRING', enum: ['csv', 'excel'], description: 'Export format' },
      },
    },
  },
];

export const handlers = {
  search_inventory: async (args: any, context: ToolExecutionContext) => {
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    let filtered = [...assets];

    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter((a: any) =>
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.hostname || a.site_name || '').toLowerCase().includes(q) ||
        (a.sid || '').toLowerCase().includes(q) ||
        (a.device_model || '').toLowerCase().includes(q)
      );
    }

    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      filtered = filtered.filter((a: any) =>
        (a.tenant_name || a.tenant_canonical || '').toLowerCase().includes(tn)
      );
    }

    if (args.witel) {
      const wt = args.witel.toLowerCase();
      filtered = filtered.filter((a: any) =>
        (a.witel || a.regional || '').toLowerCase().includes(wt)
      );
    }

    if (args.position) {
      const pos = args.position.toLowerCase();
      filtered = filtered.filter((a: any) =>
        (a.position || a.status || '').toLowerCase().includes(pos)
      );
    }

    if (args.hasCoords !== undefined) {
      filtered = filtered.filter((a: any) =>
        args.hasCoords ? (typeof a.latitude === 'number' && typeof a.longitude === 'number') : (!a.latitude)
      );
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((a: any) => ({
      serial: a.serial_number,
      model: a.device_model || 'Edge CPE',
      tenant: a.tenant_name || a.tenant_canonical || 'Telkom',
      hostname: a.hostname || a.site_name || '—',
      sid: a.sid || '—',
      witel: a.witel || '—',
      position: a.position || a.status || 'Installed',
      coordinates: (a.latitude && a.longitude) ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : 'None',
    }));

    return { total, count: capped.length, assets: capped };
  },

  inventory_stats: async (args: any, context: ToolExecutionContext) => {
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    const groupBy = args.groupBy || 'tenant';
    const counts: Record<string, number> = {};

    assets.forEach((a: any) => {
      let key = 'Other';
      if (groupBy === 'tenant') key = a.tenant_name || a.tenant_canonical || 'Unassigned';
      else if (groupBy === 'model') key = a.device_model || 'Unknown Model';
      else if (groupBy === 'position') key = a.position || a.status || 'Installed';
      else if (groupBy === 'witel') key = a.witel || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });

    return { totalAssets: assets.length, groupBy, breakdown: counts };
  },

  propose_inventory_export: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'export',
      title: 'Export Asset Inventory',
      description: `Generate inventory export in ${args.format || 'CSV'} format`,
      payload: { module: 'inventory', format: args.format || 'csv' },
    });

    return {
      status: 'proposed',
      action: 'export',
      message: 'Inventory export proposed for user confirmation.',
    };
  },
};
