export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type LinkedEntityType =
  | 'project'
  | 'sid'
  | 'sn'
  | 'trace'
  | 'order'
  | 'ticket'
  | 'custom';

export interface LinkedEntity {
  type: LinkedEntityType;
  id: string; // e.g. project name, SID code, Serial Number, TLK-ID, or custom text
  title?: string; // descriptive title / site name / customer
  extraInfo?: string; // platform, tenant, hostname, etc.
}

export interface TaskAssignee {
  uid: string;
  name: string;
  email: string;
  role?: string;
  position?: string; // e.g. "Network Engineer", "Field PM"
  avatar?: string;
}

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface TaskComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  authorPosition?: string;
  content: string;
  createdAt: string;
}

export interface CoworkingTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Entity linkage (project, SID, SN, trace, order, etc.)
  linkedEntities: LinkedEntity[];

  // Assignees from app users
  assignees: TaskAssignee[];

  // Creator
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;

  // Scheduling & Google Calendar
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedHours?: number;

  // Checklist / Subtasks
  subtasks: SubtaskItem[];

  // Activity / Comments
  comments: TaskComment[];

  // Tags / Labels
  tags?: string[];
}

export interface TaskFilterOptions {
  search: string;
  status: 'ALL' | TaskStatus;
  priority: 'ALL' | TaskPriority;
  assigneeUid: 'ALL' | string;
  entityType: 'ALL' | LinkedEntityType;
  timeFilter: 'ALL' | 'today' | 'overdue' | 'week' | 'no_date';
}
