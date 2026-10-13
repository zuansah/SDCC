export type OrderType = 'AO' | 'SO' | 'DO' | 'MO' | 'RO';

export type OrderState = 'In progress' | 'Completed' | 'Cancelled' | 'Failed';

// [stageIdx, task, state, statusLabel, start, finish]
export type OrderStep = [
  number,         // 0: stageIdx (index in meta.stages[type] or stages.length for otherStage)
  string,         // 1: raw task name
  'D' | 'P' | 'C' | 'F', // 2: state (D done, P in progress, C cancelled, F failed)
  string | null,  // 3: statusLabel (e.g. Technician assigned; only for P)
  string,         // 4: start time WIB
  string | null   // 5: finish time WIB (null unless done)
];

export interface OrderItem {
  id: string;
  wo?: string;
  type: OrderType;
  state: OrderState;
  stage?: string;
  stageIdx?: number;
  task?: string;
  taskStatus?: string;
  stepStart?: string;
  days?: number; // Days on current step (in progress only) - USE FOR AGING
  age?: number;  // Days since order entered WFM - NOT for aging
  start?: string;
  statusDate?: string;
  inWfm?: string;
  customer?: string;
  project?: string;
  contract?: string;
  segment?: string;
  region?: string;
  witel?: string;
  sto?: string;
  site?: string;
  sid?: string;
  milestone?: string;
  fulfillment?: string;
  milestoneDate?: string;
  mrc?: number;
  principal?: string;
  principalSrc?: 'ncx' | 'snapshot' | 'nf' | string;
  newFortinet?: boolean;
  steps?: OrderStep[];
}

export interface OrderMeta {
  product?: string;
  generatedAt?: string;      // UTC
  dataAsOf?: string;         // WIB (Asia/Jakarta)
  timezone?: string;         // Asia/Jakarta
  sourceLatestTask?: string; // WIB
  source?: string;
  refreshMinutes?: number;
  orderTypes?: Record<string, string>;
  stages?: Record<string, string[]>;
  otherStage?: string;
  counts?: Record<string, Record<string, number>>;
  stats?: Record<string, any>;
}

export interface OrdersPayload {
  meta: OrderMeta;
  orders: OrderItem[];
}

export type PeriodFilter = 'month' | '30d' | '90d' | '12m';
export type SegmentDimension = 'customer' | 'project' | 'segment' | 'region' | 'witel' | 'principal';
export type AgingThreshold = 14 | 30 | 60 | 90;
