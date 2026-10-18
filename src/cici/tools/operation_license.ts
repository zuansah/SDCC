import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'License',
  summary: 'Operation ▸ License tracks software license pools, expiry dates, bandwidth tiers, and capacity across Versa and Fortinet controllers.',
  mainActions: [
    'Inspect license pool usage and capacity per controller',
    'Track upcoming license expiries',
  ],
  filters: ['Controller', 'Tier'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'license_summary',
    description: 'Summarizes SD-WAN edge software license capacity, consumed licenses, and expiration alerts across controllers.',
    parameters: {
      type: 'OBJECT',
      properties: {
        controller: { type: 'STRING', description: 'Filter by controller name' },
      },
    },
  },
];

export const handlers = {
  license_summary: async (args: any, _context: ToolExecutionContext) => {
    return {
      status: 'success',
      totalLicensedCapacity: 1500,
      consumedLicenses: 1250,
      availableLicenses: 250,
      utilizationPercent: 83.3,
      expiringIn30Days: 0,
      pools: [
        { pool: 'Versa-Director-Enterprise-Tier', capacity: 900, consumed: 800, available: 100, expiry: '2027-12-31' },
        { pool: 'Fortinet-FMG-Standard-Tier', capacity: 600, consumed: 450, available: 150, expiry: '2027-06-30' },
      ],
      filterApplied: args.controller || 'All pools',
    };
  },
};
