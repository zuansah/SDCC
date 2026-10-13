export interface AssuranceMeta {
  dataAsOf: string;
  latestTicket?: string;
  refreshMinutes?: number;
  definitions?: {
    scope?: string;
    q?: string;
    ttr?: string;
    ag?: string;
    provisional?: string;
    uptime?: string;
  };
  ttrLimits?: number[];
  reopenDays?: number;
  nfLatestPeriod?: string;
  current?: MonthlyAssurance;
  stats?: Record<string, any>;
}

export interface MonthlyAssurance {
  month: string; // e.g. "2026-09"
  tickets: number;
  billed: number;
  q: number | null;
  closed: number;
  ttr3: number | null;
  ttr6: number | null;
  ttr12: number | null;
  ttr24: number | null;
  reopened: number;
  ag: number | null;
  agProvisional?: boolean;
  open: number;
  hours?: number;
  downtimeH?: number;
  uptime: number | null;
  group?: string; // customer name in byCustomer
}

export interface AssuranceTicket {
  id: string;
  status: string;
  created: string;
  resolved?: string | null;
  ttrH?: number | null;
  svc?: string; // SD-WAN SID
  sid?: string; // Ticketed SID
  customer?: string;
  divisi?: string;
  witel?: string;
  region?: string;
  category?: string;
  asset?: string;
  urgency?: string;
  gamas?: boolean;
  proactive?: boolean;
  owner?: string;
  solution?: string;
  headline?: string;
  reopened?: boolean;
  nextTicket?: string | null;
  provisional?: boolean;
}

export interface AssurancePayload {
  meta: AssuranceMeta;
  monthly: MonthlyAssurance[];
  byCustomer: MonthlyAssurance[];
  tickets: AssuranceTicket[];
}
