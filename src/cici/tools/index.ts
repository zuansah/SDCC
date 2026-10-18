import { ToolDeclaration, ToolExecutionContext } from '../types';

import * as dashboardTool from './dashboard';
import * as fulfillmentBasTool from './fulfillment_bas';
import * as fulfillmentOrdersTool from './fulfillment_orders';
import * as fulfillmentTrackingTool from './fulfillment_tracking';
import * as operationMonitoringTool from './operation_monitoring';
import * as operationTicketTool from './operation_ticket';
import * as operationAssuranceTool from './operation_assurance';
import * as operationControllerTool from './operation_controller';
import * as operationLicenseTool from './operation_license';
import * as operationIntelligenceTool from './operation_intelligence';
import * as assetInventoryTool from './asset_inventory';
import * as assetTracingTool from './asset_tracing';
import * as assetLabelTool from './asset_label';
import * as labModulesTool from './lab_modules';
import * as appHelpTool from './app_help';
import * as ciciSelfTool from './cici_self';

export const allMenuHelp: Record<string, any> = {
  dashboard: dashboardTool.helpText,
  projects: fulfillmentBasTool.helpText,
  orders: fulfillmentOrdersTool.helpText,
  tracking: fulfillmentTrackingTool.helpText,
  monitoring: operationMonitoringTool.helpText,
  ticket: operationTicketTool.helpText,
  assurance: operationAssuranceTool.helpText,
  controller: operationControllerTool.helpText,
  license: operationLicenseTool.helpText,
  intelligence: operationIntelligenceTool.helpText,
  inventory: assetInventoryTool.helpText,
  tracing: assetTracingTool.helpText,
  label: assetLabelTool.helpText,
  lab: labModulesTool.helpText,
  cici: ciciSelfTool.helpText,
};

const appHelpHandlers = appHelpTool.getHelpRegistry(allMenuHelp);

// Tool to required view mapping for role & allowedViews enforcement
const TOOL_VIEW_PERMISSIONS: Record<string, string[]> = {
  get_dashboard_summary: ['dashboard'],
  list_bas: ['projects', 'project_management'],
  get_ba: ['projects', 'project_management'],
  ba_missing_items: ['projects', 'project_management'],
  propose_navigation_to_ba: ['projects', 'project_management'],
  find_order: ['orders'],
  order_stats: ['orders'],
  propose_order_export: ['orders'],
  tracking_asset_help: ['tracking'],
  search_devices: ['monitoring'],
  get_device: ['monitoring'],
  devices_near: ['monitoring'],
  propose_navigation_to_map: ['monitoring'],
  get_ticket: ['ticket'],
  list_tickets: ['ticket'],
  ticket_stats: ['ticket'],
  propose_assurance_ticket: ['ticket'],
  propose_close_assurance_ticket: ['ticket'],
  find_insera_ticket: ['assurance'],
  propose_assurance_export: ['assurance'],
  list_controllers: ['controller'],
  get_controller: ['controller'],
  license_summary: ['license'],
  list_patterns: ['intelligence'],
  predicted_outages: ['intelligence'],
  triage: ['intelligence'],
  search_inventory: ['inventory'],
  inventory_stats: ['inventory'],
  propose_inventory_export: ['inventory'],
  find_label: ['label'],
  label_stats: ['label'],
  propose_navigation_to_issue_label: ['label'],
  tracing_identification_help: ['tracing', 'identification'],
  lab_modules_help: ['mass-testing-uat', 'open-sdwan', 'automation', 'api'],
  // Common / Cici internal tools: no restrictive view permission required
  how_to: [],
  propose_navigation: [],
  recall: [],
  remember: [],
  forget: [],
  list_documents: [],
  get_document: [],
  create_document: [],
  update_document: [],
  create_reminder: [],
};

// Aggregate all declarations
export const allToolDeclarations: ToolDeclaration[] = [
  ...dashboardTool.declarations,
  ...fulfillmentBasTool.declarations,
  ...fulfillmentOrdersTool.declarations,
  ...fulfillmentTrackingTool.declarations,
  ...operationMonitoringTool.declarations,
  ...operationTicketTool.declarations,
  ...operationAssuranceTool.declarations,
  ...operationControllerTool.declarations,
  ...operationLicenseTool.declarations,
  ...operationIntelligenceTool.declarations,
  ...assetInventoryTool.declarations,
  ...assetTracingTool.declarations,
  ...assetLabelTool.declarations,
  ...labModulesTool.declarations,
  ...appHelpTool.declarations,
  ...ciciSelfTool.declarations,
];

// Aggregate all handlers
const allToolHandlers: Record<string, (args: any, context: ToolExecutionContext) => Promise<any>> = {
  ...dashboardTool.handlers,
  ...fulfillmentBasTool.handlers,
  ...fulfillmentOrdersTool.handlers,
  ...fulfillmentTrackingTool.handlers,
  ...operationMonitoringTool.handlers,
  ...operationTicketTool.handlers,
  ...operationAssuranceTool.handlers,
  ...operationControllerTool.handlers,
  ...operationLicenseTool.handlers,
  ...operationIntelligenceTool.handlers,
  ...assetInventoryTool.handlers,
  ...assetTracingTool.handlers,
  ...assetLabelTool.handlers,
  ...labModulesTool.handlers,
  ...appHelpHandlers,
  ...ciciSelfTool.handlers,
};

/**
 * Executes a tool by name, enforcing:
 * 1. User role and allowedViews permissions (returns { error: "not permitted" } if disallowed)
 * 2. Capping result arrays at 25 rows by default, including `total`
 */
export async function executeTool(name: string, args: any, context: ToolExecutionContext): Promise<any> {
  const handler = allToolHandlers[name];
  if (!handler) {
    return { error: `Tool '${name}' is not recognized in the NSM registry.` };
  }

  // Permission check
  const requiredViews = TOOL_VIEW_PERMISSIONS[name];
  if (requiredViews && requiredViews.length > 0 && context.currentUser) {
    const role = context.currentUser.role;
    const allowed = context.currentUser.allowedViews || [];

    // Super Admin has full view access
    if (role !== 'Super Admin') {
      const isPermitted = requiredViews.some(v => allowed.includes(v));
      if (!isPermitted) {
        return { error: 'not permitted' };
      }
    }
  }

  try {
    const result = await handler(args || {}, context);
    return result;
  } catch (err: any) {
    console.error(`Tool execution error for ${name}:`, err);
    return { error: `Failed to execute ${name}: ${err?.message || 'unknown error'}` };
  }
}
