import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Controller',
  summary: 'Operation ▸ Controller module monitors health, polling timestamps, edge counts, and reachability for all Telkom SD-WAN Director and Controller clusters (Versa & Fortinet).',
  mainActions: [
    'Inspect controller cluster health, reachability, and poll latency',
    'View edge distribution across controller nodes',
  ],
  filters: ['Controller cluster', 'Health status'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'list_controllers',
    description: 'Lists all connected SD-WAN controller clusters, showing health status, total edges managed, and last polling timestamp.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_controller',
    description: 'Retrieves in-depth metrics and down edges for a specific controller by name/key.',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: { type: 'STRING', description: 'Controller identifier (e.g. Versa-Director-01, FortiManager-01)' },
      },
      required: ['key'],
    },
  },
];

export const handlers = {
  list_controllers: async (_args: any, context: ToolExecutionContext) => {
    const ctrl = context.sharedData?.controllersPayload;
    const controllers = ctrl?.controllers || {
      'Versa-Director-01': { status: 'ONLINE', totalEdges: 420, online: 412, offline: 8, lastPoll: 'Just now' },
      'Versa-Director-02': { status: 'ONLINE', totalEdges: 380, online: 374, offline: 6, lastPoll: '1m ago' },
      'FortiManager-Jkt': { status: 'ONLINE', totalEdges: 260, online: 254, offline: 6, lastPoll: 'Just now' },
      'FortiManager-Sby': { status: 'ONLINE', totalEdges: 190, online: 181, offline: 9, lastPoll: '2m ago' },
    };

    const list = Object.entries(controllers).map(([name, data]: [string, any]) => ({
      name,
      status: data.status || 'ONLINE',
      totalEdges: data.totalEdges || (data.online + data.offline) || 0,
      onlineEdges: data.online || 0,
      offlineEdges: data.offline || 0,
      lastPoll: data.lastPoll || 'Recent',
    }));

    return { total: list.length, controllers: list };
  },

  get_controller: async (args: any, context: ToolExecutionContext) => {
    const key = (args.key || '').trim().toLowerCase();
    const ctrl = context.sharedData?.controllersPayload;
    const controllers = ctrl?.controllers || {};

    const match = Object.entries(controllers).find(([k]) => k.toLowerCase().includes(key));
    if (!match) {
      return { error: `Controller '${args.key}' not found.` };
    }

    const [name, data]: [string, any] = match;
    return {
      name,
      status: data.status || 'ONLINE',
      totalEdges: data.totalEdges || (data.online + data.offline) || 0,
      onlineEdges: data.online || 0,
      offlineEdges: data.offline || 0,
      lastPoll: data.lastPoll || 'Recent',
      downEdges: (data.downEdges || []).slice(0, 10).map((d: any) => ({
        serial: d.serial,
        name: d.name,
        tenant: d.tenant,
        downSince: d.downSince,
      })),
    };
  },
};
