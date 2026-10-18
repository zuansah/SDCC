export interface IntelligenceSummary {
  scheduledRecurring: number;
  chronic: number;
  openTickets: number;
  openLikelyScheduled: number;
  noiseReductionPct: number;
  outageEvents?: number;
  devicesAnalysed?: number;
}

export interface ScheduledPattern {
  serial: string;
  name: string;
  tenant: string;
  pattern: 'SCHEDULED_RECURRING' | string;
  topWeekday: string;
  topWeekdayCount: number;
  events: number;
  weekdayConcentration: number;
  medianGapDays: number;
  confidence: number;
  nextExpected: string;
  explanation: string;
  recommendedAction?: string;
  timeWindow?: string;
}

export interface ChronicDevice {
  serial: string;
  name: string;
  tenant: string;
  pattern: 'CHRONIC' | string;
  events?: number;
  flapCount7d?: number;
  uptimePercent?: number;
  explanation?: string;
  recommendedAction?: string;
  primaryCause?: string;
  model?: string;
  lastFlapTime?: string;
  reason?: string;
}

export interface OpenTicketTriage {
  ticketId?: string;
  ticketNumber?: string;
  serial: string;
  name: string;
  tenant?: string;
  triage: 'LIKELY_SCHEDULED' | 'NEEDS_ATTENTION';
  reason: string;
  urgency?: 'HIGH' | 'MEDIUM' | 'LOW';
  attentionNeededToday?: boolean;
}

// Backward-compatible types for Copilot assistant grounding
export interface OutagePattern {
  site: string;
  customer: string;
  pattern: string;
  dayOfWeek: string;
  timeWindow: string;
  reason: string;
  category: 'scheduled' | 'environmental' | 'underlay' | 'hardware';
  nextPredictedDown: string;
  confidence: number;
  durationHours: number;
}

export interface SitePrediction {
  site: string;
  customer: string;
  predictedNextDown: string;
  expectedDuration: string;
  reason: string;
  recurrenceType: string;
  recommendedAction: string;
}

export interface TicketTriageItem {
  ticketId: string;
  customer: string;
  site: string;
  status: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  attentionNeededToday: boolean;
  classification: 'real_outage' | 'scheduled_maintenance' | 'flapping_underlay' | 'proactive_test';
  reason: string;
  actionRecommendation: string;
}

export interface ChronicallyUnstableDevice {
  customer: string;
  site: string;
  serialNumber: string;
  model: string;
  flapCount7d: number;
  uptimePercent: number;
  primaryCause: string;
  lastFlapTime?: string;
  recommendedFix: string;
}

export interface IntelligencePayload {
  generatedAt: string;
  version?: string;
  outageEvents?: number;
  devicesAnalysed?: number;
  summary: IntelligenceSummary;
  scheduledPatterns: ScheduledPattern[];
  chronicDevices: ChronicDevice[];
  openTicketTriage: OpenTicketTriage[];

  // Aliases for copilot grounding backwards compatibility
  recurringOutages?: OutagePattern[];
  predictions?: SitePrediction[];
  openTicketsTriage?: TicketTriageItem[];
  chronicallyUnstableDevices?: ChronicallyUnstableDevice[];
}
