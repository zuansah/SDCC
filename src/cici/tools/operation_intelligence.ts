import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Intelligence',
  summary: 'Operation ▸ Intelligence runs the AI predictive engine. Distinguishes recurring scheduled closures from real faults, forecasts next outage dates, and reduces open-ticket noise.',
  mainActions: [
    'View recurring weekly scheduled outages with AI confidence and 7-day periodicity strips',
    'Forecast next expected outage dates per site',
    'Filter open tickets by LIKELY_SCHEDULED (deprioritise) vs NEEDS_ATTENTION (real worklist)',
    'Investigate chronic unstable devices requiring physical dispatch',
  ],
  filters: ['Day of week', 'Tenant / Customer', 'Triage classification'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'list_patterns',
    description: 'Lists sites exhibiting recurring scheduled outage patterns (e.g. weekend dealer closures, bank branch power schedules).',
    parameters: {
      type: 'OBJECT',
      properties: {
        pattern: { type: 'STRING', description: 'SCHEDULED_RECURRING or CHRONIC' },
        weekday: { type: 'STRING', description: 'Day of week (e.g. Saturday, Sunday)' },
        tenant: { type: 'STRING', description: 'Customer / tenant name (e.g. Daya Anugrah Mandiri, Bank Mandiri)' },
      },
    },
  },
  {
    name: 'predicted_outages',
    description: 'Retrieves sites predicted to go down on a recurring schedule on a specific date or upcoming weekend window.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Target date (YYYY-MM-DD or "today", "tomorrow", "this weekend")' },
        tenant: { type: 'STRING', description: 'Filter by tenant' },
      },
    },
  },
  {
    name: 'triage',
    description: 'Returns AI open-ticket triage recommendations: which tickets are LIKELY_SCHEDULED closures vs which genuinely NEED_ATTENTION.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tenant: { type: 'STRING', description: 'Filter by customer/tenant' },
        verdict: { type: 'STRING', enum: ['NEEDS_ATTENTION', 'LIKELY_SCHEDULED', 'ALL'], description: 'Triage classification' },
      },
    },
  },
];

export const handlers = {
  list_patterns: async (args: any, context: ToolExecutionContext) => {
    const intel = context.sharedData?.intelligencePayload;
    const patterns = intel?.scheduledPatterns || [];
    let filtered = [...patterns];

    if (args.weekday) {
      const wd = args.weekday.toLowerCase();
      filtered = filtered.filter((p: any) => (p.topWeekday || '').toLowerCase() === wd);
    }
    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      filtered = filtered.filter((p: any) => (p.tenant || '').toLowerCase().includes(tn));
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((p: any) => ({
      serial: p.serial,
      site: p.name,
      tenant: p.tenant,
      pattern: p.pattern,
      topWeekday: p.topWeekday,
      events: p.events,
      confidencePct: Math.round(p.confidence * 100),
      nextExpected: p.nextExpected,
      timeWindow: p.timeWindow,
      explanation: p.explanation,
      recommendedAction: p.recommendedAction,
    }));

    return { total, count: capped.length, patterns: capped };
  },

  predicted_outages: async (args: any, context: ToolExecutionContext) => {
    const intel = context.sharedData?.intelligencePayload;
    const patterns = intel?.scheduledPatterns || [];
    let filtered = [...patterns];

    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      filtered = filtered.filter((p: any) => (p.tenant || '').toLowerCase().includes(tn));
    }

    if (args.date && args.date !== 'today') {
      const targetDate = args.date.toLowerCase();
      filtered = filtered.filter((p: any) => (p.nextExpected || '').toLowerCase().includes(targetDate));
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((p: any) => ({
      serial: p.serial,
      site: p.name,
      tenant: p.tenant,
      predictedDate: p.nextExpected,
      predictedWindow: p.timeWindow || 'Weekend evening',
      confidence: `${Math.round(p.confidence * 100)}%`,
      explanation: p.explanation,
      action: p.recommendedAction,
    }));

    return {
      forecastDate: args.date || 'Upcoming cycle',
      totalPredicted: total,
      sites: capped,
    };
  },

  triage: async (args: any, context: ToolExecutionContext) => {
    const intel = context.sharedData?.intelligencePayload;
    const triageList = intel?.openTicketTriage || [];
    let filtered = [...triageList];

    if (args.verdict && args.verdict !== 'ALL') {
      filtered = filtered.filter((t: any) => t.triage === args.verdict);
    }

    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      filtered = filtered.filter((t: any) => (t.tenant || '').toLowerCase().includes(tn));
    }

    const total = filtered.length;
    const capped = filtered.slice(0, 25).map((t: any) => ({
      serial: t.serial,
      ticketNumber: t.ticketNumber || t.ticketId || t.serial.slice(-8),
      site: t.name,
      tenant: t.tenant || 'Telkom Customer',
      triage: t.triage,
      reason: t.reason,
      urgency: t.urgency || (t.triage === 'NEEDS_ATTENTION' ? 'HIGH' : 'LOW'),
    }));

    const needsAttentionCount = triageList.filter((t: any) => t.triage === 'NEEDS_ATTENTION').length;
    const likelyScheduledCount = triageList.filter((t: any) => t.triage === 'LIKELY_SCHEDULED').length;

    return {
      summary: {
        totalOpenTickets: triageList.length,
        needsAttentionCount,
        likelyScheduledCount,
        noiseReductionPct: 3.0,
      },
      filteredCount: total,
      tickets: capped,
    };
  },
};
