import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Order Status',
  summary: 'Fulfillment module tracking customer provisioning orders, hardware dispatch status, Telkom principal assignments, and deployment stages.',
  mainActions: [
    'Search orders by Order Number (e.g. 1-91988479428), customer, or site',
    'Filter orders by status (Completed, In Progress, Pending Dispatch, Cancelled)',
    'Export order reports to CSV / Excel',
  ],
  filters: ['Status', 'Principal / Vendor', 'Customer / Tenant', 'Date range'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'find_order',
    description: 'Finds provisioning orders matching order number (e.g. 1-91988479428), customer query, status, or principal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderNumber: { type: 'STRING', description: 'Exact or partial order number (e.g. 1-91988479428)' },
        query: { type: 'STRING', description: 'Free-text search for customer, site, or serial' },
        status: { type: 'STRING', description: 'Order status: Completed, In Progress, Pending, etc.' },
        principal: { type: 'STRING', description: 'Principal name (e.g. Fortinet, Versa, Telkom)' },
      },
    },
  },
  {
    name: 'order_stats',
    description: 'Computes order breakdown stats grouped by status, customer/tenant, or principal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        groupBy: {
          type: 'STRING',
          description: 'Dimension to aggregate by: status, tenant, or principal',
          enum: ['status', 'tenant', 'principal'],
        },
      },
      required: ['groupBy'],
    },
  },
  {
    name: 'propose_order_export',
    description: 'Proposes exporting matching orders as CSV or Excel report.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: { type: 'STRING', enum: ['csv', 'excel'], description: 'Export file format' },
        filter: { type: 'STRING', description: 'Filter description for export filename' },
      },
    },
  },
];

export const handlers = {
  find_order: async (args: any, context: ToolExecutionContext) => {
    const orders = context.sharedData?.ordersPayload?.orders || [];
    let filtered = [...orders];

    if (args.orderNumber) {
      const on = args.orderNumber.trim().toLowerCase();
      filtered = filtered.filter((o: any) =>
        (o.orderNumber || o.order_number || o.id || '').toLowerCase().includes(on)
      );
    }
    if (args.query) {
      const q = args.query.trim().toLowerCase();
      filtered = filtered.filter((o: any) =>
        (o.customer || o.tenant || o.customerName || '').toLowerCase().includes(q) ||
        (o.site || o.siteName || '').toLowerCase().includes(q) ||
        (o.serialNumber || o.serial_number || '').toLowerCase().includes(q)
      );
    }
    if (args.status) {
      const s = args.status.trim().toLowerCase();
      filtered = filtered.filter((o: any) => (o.status || '').toLowerCase().includes(s));
    }
    if (args.principal) {
      const p = args.principal.trim().toLowerCase();
      filtered = filtered.filter((o: any) =>
        (o.principal || o.vendor || '').toLowerCase().includes(p)
      );
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((o: any) => ({
      orderNumber: o.orderNumber || o.order_number || o.id,
      customer: o.customer || o.tenant || o.customerName || 'Telkom Customer',
      site: o.site || o.siteName || '—',
      status: o.status || 'Active',
      principal: o.principal || o.vendor || '—',
      serialNumber: o.serialNumber || o.serial_number || '—',
      orderDate: o.orderDate || o.created_at || '—',
      deliveryDate: o.deliveryDate || o.completed_at || '—',
    }));

    return { total, count: capped.length, orders: capped };
  },

  order_stats: async (args: any, context: ToolExecutionContext) => {
    const orders = context.sharedData?.ordersPayload?.orders || [];
    const groupBy = args.groupBy || 'status';
    const counts: Record<string, number> = {};

    orders.forEach((o: any) => {
      let key = 'Other';
      if (groupBy === 'status') key = o.status || 'Unknown';
      else if (groupBy === 'tenant') key = o.customer || o.tenant || 'Unassigned';
      else if (groupBy === 'principal') key = o.principal || o.vendor || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });

    return { totalOrders: orders.length, groupBy, breakdown: counts };
  },

  propose_order_export: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'export',
      title: `Export Order Status Report (${args.format || 'CSV'})`,
      description: `Generate and download orders dataset (${args.filter || 'all active orders'})`,
      payload: {
        module: 'orders',
        format: args.format || 'csv',
        filter: args.filter || 'all',
      },
    });

    return {
      status: 'proposed',
      action: 'export',
      message: 'Order export action proposed for user confirmation.',
    };
  },
};
