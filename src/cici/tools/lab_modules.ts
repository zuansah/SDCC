import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Lab Modules (Mass Testing UAT, Open SDWAN, Automation, API)',
  summary: 'Lab group modules are currently in experimental testing and under construction in this release.',
  mainActions: ['Under construction'],
  filters: [],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'lab_modules_help',
    description: 'Returns help status for Lab modules (Mass Testing, Open SDWAN, Automation, API).',
    parameters: {
      type: 'OBJECT',
      properties: {
        module: { type: 'STRING', description: 'mass-testing-uat, open-sdwan, automation, or api' },
      },
    },
  },
];

export const handlers = {
  lab_modules_help: async (args: any, _context: ToolExecutionContext) => {
    return {
      status: 'under_construction',
      module: args.module || 'Lab',
      message: `The Lab ▸ ${args.module || 'Experimental'} module is currently under construction.`,
    };
  },
};
