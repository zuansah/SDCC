import { ToolDeclaration, ToolExecutionContext } from '../types';

export const declarations: ToolDeclaration[] = [
  {
    name: 'how_to',
    description: 'Explains how to perform a task in NSM or provides a guide for a specific menu, its purpose, main actions, and filters.',
    parameters: {
      type: 'OBJECT',
      properties: {
        menu: {
          type: 'STRING',
          description: 'The menu name (e.g. Dashboard, Project List, PM, Order Status, Monitoring, Ticket, SD-WAN Assurance, Controller, License, Intelligence, Inventory, Label)',
        },
        task: {
          type: 'STRING',
          description: 'The task description the user wants to accomplish (e.g. issue label, verify evidence, check down devices)',
        },
      },
    },
  },
  {
    name: 'propose_navigation',
    description: 'Proposes navigating the user to a specific NSM menu view.',
    parameters: {
      type: 'OBJECT',
      properties: {
        menu: {
          type: 'STRING',
          description: 'The target view ID: dashboard, projects, project_management, orders, monitoring, ticket, assurance, controller, license, intelligence, inventory, label, task-todo',
        },
        reason: { type: 'STRING', description: 'Why navigating to this view' },
      },
      required: ['menu'],
    },
  },
];

export function getHelpRegistry(menuHelpMap: Record<string, any>) {
  return {
    how_to: async (args: any, context: ToolExecutionContext) => {
      const menuKey = (args.menu || '').toLowerCase().trim();
      const task = (args.task || '').toLowerCase().trim();

      // Find best match in menuHelpMap
      let matchedMenu: any = null;
      for (const [key, help] of Object.entries(menuHelpMap)) {
        if (key.toLowerCase().includes(menuKey) || help.menu.toLowerCase().includes(menuKey)) {
          matchedMenu = help;
          break;
        }
      }

      if (matchedMenu) {
        return {
          menu: matchedMenu.menu,
          summary: matchedMenu.summary,
          mainActions: matchedMenu.mainActions,
          filters: matchedMenu.filters,
          guidance: `To ${task || 'work in this module'}: go to ${matchedMenu.menu}. Available actions include: ${matchedMenu.mainActions.join('; ')}.`,
        };
      }

      return {
        message: 'Here is an overview of NSM modules and their main capabilities.',
        availableModules: Object.values(menuHelpMap).map((h: any) => ({
          menu: h.menu,
          summary: h.summary,
        })),
      };
    },

    propose_navigation: async (args: any, context: ToolExecutionContext) => {
      context.proposeAction({
        type: 'navigation',
        title: `Navigate to ${args.menu}`,
        description: args.reason || `Open the ${args.menu} module`,
        payload: { view: args.menu },
      });

      return {
        status: 'proposed',
        action: 'navigation',
        message: `Proposed navigation to ${args.menu}.`,
      };
    },
  };
}
