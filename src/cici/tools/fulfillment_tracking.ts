import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Tracking Asset',
  summary: 'Fulfillment ▸ Tracking Asset module is currently under construction.',
  mainActions: ['Under construction'],
  filters: [],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'tracking_asset_help',
    description: 'Returns status for Fulfillment ▸ Tracking Asset module.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

export const handlers = {
  tracking_asset_help: async (_args: any, _context: ToolExecutionContext) => {
    return {
      status: 'under_construction',
      message: 'Fulfillment ▸ Tracking Asset module is currently under construction.',
    };
  },
};
