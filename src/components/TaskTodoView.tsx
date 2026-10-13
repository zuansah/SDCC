import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Layers,
  Cpu,
  Tag,
  Link as LinkIcon,
  Download,
  Share2,
  MoreVertical,
  ArrowRight,
  RotateCw,
  Copy,
  Check,
  LayoutGrid,
  List as ListIcon,
  CalendarDays,
} from 'lucide-react';
import {
  CoworkingTask,
  TaskStatus,
  TaskPriority,
  TaskFilterOptions,
  LinkedEntity,
  TaskAssignee,
} from '../types/task';
import { useCoworkingTasks } from '../hooks/useCoworkingTasks';
import { useAppUsers } from '../hooks/useAppUsers';
import TaskDetailModal from './TaskDetailModal';
import TaskCreateModal from './TaskCreateModal';
import { buildGoogleCalendarUrl, downloadTaskIcs } from '../utils/calendarUtils';

interface TaskTodoViewProps {
  user: any;
  userData?: any;
  setView?: (v: any) => void;
}

const COLUMNS: { id: TaskStatus; label: string; headerColor: string; badgeColor: string }[] = [
  { id: 'todo', label: 'To Do', headerColor: 'border-t-slate-400', badgeColor: 'bg-slate-100 text-slate-700' },
  { id: 'in_progress', label: 'In Progress', headerColor: 'border-t-blue-500', badgeColor: 'bg-blue-100 text-blue-800' },
  { id: 'in_review', label: 'In Review', headerColor: 'border-t-purple-500', badgeColor: 'bg-purple-100 text-purple-800' },
  { id: 'done', label: 'Done', headerColor: 'border-t-emerald-500', badgeColor: 'bg-emerald-100 text-emerald-800' },
];

export default function TaskTodoView({ user, userData, setView }: TaskTodoViewProps) {
  const {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    toggleSubtask,
    addComment,
  } = useCoworkingTasks();

  const { users: availableUsers } = useAppUsers();

  // Active view: 'board' (Kanban) | 'list' | 'calendar'
  const [activeView, setActiveView] = useState<'board' | 'list' | 'calendar'>('board');

  // Filter state
  const [filters, setFilters] = useState<TaskFilterOptions>({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    assigneeUid: 'ALL',
    entityType: 'ALL',
    timeFilter: 'ALL',
  });

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<TaskStatus>('todo');

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // Date helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search across title, description, linked entities, assignees
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = (task.description || '').toLowerCase().includes(q);
        const matchesEntity = (task.linkedEntities || []).some(
          (e) => e.id.toLowerCase().includes(q) || (e.title || '').toLowerCase().includes(q)
        );
        const matchesAssignee = (task.assignees || []).some(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            (a.position || '').toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesDesc && !matchesEntity && !matchesAssignee) {
          return false;
        }
      }

      // 2. Status filter
      if (filters.status !== 'ALL' && task.status !== filters.status) {
        return false;
      }

      // 3. Priority filter
      if (filters.priority !== 'ALL' && task.priority !== filters.priority) {
        return false;
      }

      // 4. Assignee filter
      if (filters.assigneeUid !== 'ALL') {
        const hasAssignee = (task.assignees || []).some((a) => a.uid === filters.assigneeUid);
        if (!hasAssignee) return false;
      }

      // 5. Entity Type filter
      if (filters.entityType !== 'ALL') {
        const hasType = (task.linkedEntities || []).some((e) => e.type === filters.entityType);
        if (!hasType) return false;
      }

      // 6. Time filter
      if (filters.timeFilter !== 'ALL') {
        if (!task.dueDate) {
          if (filters.timeFilter === 'no_date') return true;
          return false;
        }

        if (filters.timeFilter === 'today') {
          if (task.dueDate !== todayStr) return false;
        } else if (filters.timeFilter === 'overdue') {
          if (task.dueDate >= todayStr || task.status === 'done') return false;
        } else if (filters.timeFilter === 'week') {
          const taskTime = new Date(task.dueDate).getTime();
          const nowTime = new Date(todayStr).getTime();
          const sevenDaysLater = nowTime + 7 * 24 * 60 * 60 * 1000;
          if (taskTime < nowTime || taskTime > sevenDaysLater) return false;
        }
      }

      return true;
    });
  }, [tasks, filters, todayStr]);

  // Metric counts
  const metrics = useMemo(() => {
    let overdueCount = 0;
    let dueTodayCount = 0;

    tasks.forEach((t) => {
      if (t.status !== 'done' && t.dueDate) {
        if (t.dueDate < todayStr) overdueCount++;
        else if (t.dueDate === todayStr) dueTodayCount++;
      }
    });

    return {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      inReview: tasks.filter((t) => t.status === 'in_review').length,
      done: tasks.filter((t) => t.status === 'done').length,
      overdue: overdueCount,
      dueToday: dueTodayCount,
    };
  }, [tasks, todayStr]);

  // Quick move status helper
  const handleQuickNextStatus = (e: React.MouseEvent, task: CoworkingTask) => {
    e.stopPropagation();
    const order: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
    const idx = order.indexOf(task.status);
    if (idx < order.length - 1) {
      changeTaskStatus(task.id, order[idx + 1]);
    }
  };

  const handleQuickPrevStatus = (e: React.MouseEvent, task: CoworkingTask) => {
    e.stopPropagation();
    const order: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
    const idx = order.indexOf(task.status);
    if (idx > 0) {
      changeTaskStatus(task.id, order[idx - 1]);
    }
  };

  const openCreateForStatus = (status: TaskStatus) => {
    setCreateInitialStatus(status);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-full pb-16 font-sans">
      {/* 1. Sticky Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="w-full max-w-[1760px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Co-working & Tasks</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                Team Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Collaborative task board linked to SD-WAN projects, SIDs, Serial Numbers, and Google Calendar.
            </p>
          </div>

          {/* Top Actions: View toggle & Create Task */}
          <div className="flex items-center gap-3">
            {/* View Switcher: Board / List / Calendar */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveView('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'board' ? 'bg-white text-slate-800 font-semibold shadow-2xs' : 'hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
              <button
                onClick={() => setActiveView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'list' ? 'bg-white text-slate-800 font-semibold shadow-2xs' : 'hover:text-slate-800'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => setActiveView('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'calendar' ? 'bg-white text-slate-800 font-semibold shadow-2xs' : 'hover:text-slate-800'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Schedule</span>
              </button>
            </div>

            {/* Create Task Button */}
            <button
              onClick={() => openCreateForStatus('todo')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1760px] mx-auto px-6 pt-4 space-y-4">
        {/* 2. Top Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Total Tasks */}
          <div
            onClick={() => setFilters((f) => ({ ...f, status: 'ALL', timeFilter: 'ALL' }))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-blue-400 cursor-pointer transition"
          >
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</span>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{metrics.total}</div>
          </div>

          {/* In Progress */}
          <div
            onClick={() => setFilters((f) => ({ ...f, status: 'in_progress', timeFilter: 'ALL' }))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-blue-400 cursor-pointer transition"
          >
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">In Progress</span>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{metrics.inProgress}</div>
          </div>

          {/* Due Today */}
          <div
            onClick={() => setFilters((f) => ({ ...f, timeFilter: 'today' }))}
            className={`p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition ${
              metrics.dueToday > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Due Today</span>
              {metrics.dueToday > 0 && <Clock className="w-3.5 h-3.5 text-amber-600" />}
            </div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{metrics.dueToday}</div>
          </div>

          {/* Overdue */}
          <div
            onClick={() => setFilters((f) => ({ ...f, timeFilter: 'overdue' }))}
            className={`p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition ${
              metrics.overdue > 0 ? 'border-red-300 bg-red-50/40' : 'border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">Overdue</span>
              {metrics.overdue > 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
            </div>
            <div className="text-xl font-bold text-red-700 mt-0.5">{metrics.overdue}</div>
          </div>

          {/* In Review */}
          <div
            onClick={() => setFilters((f) => ({ ...f, status: 'in_review', timeFilter: 'ALL' }))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-blue-400 cursor-pointer transition"
          >
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">In Review</span>
            <div className="text-xl font-bold text-purple-700 mt-0.5">{metrics.inReview}</div>
          </div>

          {/* Completed */}
          <div
            onClick={() => setFilters((f) => ({ ...f, status: 'done', timeFilter: 'ALL' }))}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-blue-400 cursor-pointer transition"
          >
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Completed</span>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.done}</div>
          </div>
        </div>

        {/* 3. Search and Quick Filters Bar */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks, SIDs, Serial Numbers, projects, team members..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter */}
            <select
              value={filters.priority}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as any }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={filters.assigneeUid}
              onChange={(e) => setFilters((f) => ({ ...f, assigneeUid: e.target.value }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none max-w-[160px] truncate"
            >
              <option value="ALL">All Team Members</option>
              {availableUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name} {u.position ? `(${u.position})` : ''}
                </option>
              ))}
            </select>

            {/* Entity Type Filter */}
            <select
              value={filters.entityType}
              onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value as any }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none"
            >
              <option value="ALL">All Linked Types</option>
              <option value="sn">Serial Number (SN)</option>
              <option value="sid">SID (Service ID)</option>
              <option value="project">Project</option>
              <option value="trace">Trace ID</option>
              <option value="order">Order Number</option>
            </select>

            {/* Time / Reminders Filter */}
            <select
              value={filters.timeFilter}
              onChange={(e) => setFilters((f) => ({ ...f, timeFilter: e.target.value as any }))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none font-medium"
            >
              <option value="ALL">All Deadlines</option>
              <option value="today">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="week">Due This Week</option>
              <option value="no_date">No Due Date</option>
            </select>

            {/* Clear Filters */}
            {(filters.search ||
              filters.status !== 'ALL' ||
              filters.priority !== 'ALL' ||
              filters.assigneeUid !== 'ALL' ||
              filters.entityType !== 'ALL' ||
              filters.timeFilter !== 'ALL') && (
              <button
                onClick={() =>
                  setFilters({
                    search: '',
                    status: 'ALL',
                    priority: 'ALL',
                    assigneeUid: 'ALL',
                    entityType: 'ALL',
                    timeFilter: 'ALL',
                  })
                }
                className="px-2.5 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* 4. Active View Rendering */}
        {activeView === 'board' && (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={`bg-slate-100/80 rounded-2xl p-3 border border-slate-200/80 border-t-4 ${col.headerColor} flex flex-col min-h-[500px] shadow-2xs`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-200/60 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{col.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${col.badgeColor}`}>
                        {colTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => openCreateForStatus(col.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded transition"
                      title={`Add task to ${col.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cards container */}
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        todayStr={todayStr}
                        onClick={() => setSelectedTaskId(task.id)}
                        onQuickNext={(e) => handleQuickNextStatus(e, task)}
                        onQuickPrev={(e) => handleQuickPrevStatus(e, task)}
                        onToggleSubtask={(stId) =>
                          toggleSubtask(task.id, stId, user?.displayName || user?.email)
                        }
                      />
                    ))}

                    {colTasks.length === 0 && (
                      <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs">
                        <span>No tasks in {col.label}</span>
                        <button
                          onClick={() => openCreateForStatus(col.id)}
                          className="mt-1.5 text-blue-600 hover:underline font-medium text-[11px]"
                        >
                          + Add a task
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeView === 'list' && (
          /* Table / List View */
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Linked SD-WAN Item</th>
                  <th className="px-4 py-3">Team Assignees</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Subtasks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No matching tasks found. Click "+ New Task" to get started.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const isOverdue = t.dueDate && t.dueDate < todayStr && t.status !== 'done';
                    const isDueToday = t.dueDate && t.dueDate === todayStr;
                    const completedSt = t.subtasks.filter((s) => s.completed).length;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs truncate">
                          {t.title}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              COLUMNS.find((c) => c.id === t.status)?.badgeColor || 'bg-slate-100'
                            }`}
                          >
                            {COLUMNS.find((c) => c.id === t.status)?.label || t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              t.priority === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : t.priority === 'high'
                                ? 'bg-amber-100 text-amber-800'
                                : t.priority === 'medium'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.linkedEntities && t.linkedEntities.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                                {t.linkedEntities[0].type}
                              </span>
                              <span className="font-mono text-blue-700 font-medium">
                                {t.linkedEntities[0].id}
                              </span>
                              {t.linkedEntities.length > 1 && (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  +{t.linkedEntities.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.assignees && t.assignees.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {t.assignees.slice(0, 3).map((a) => (
                                <div
                                  key={a.uid}
                                  title={`${a.name} (${a.position || a.role || 'Member'})`}
                                  className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-center text-[10px] font-bold"
                                >
                                  {a.name.substring(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {t.assignees.length > 3 && (
                                <span className="text-[10px] text-slate-500 font-bold ml-1">
                                  +{t.assignees.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.dueDate ? (
                            <span
                              className={`flex items-center gap-1 font-medium ${
                                isOverdue
                                  ? 'text-red-700 font-bold'
                                  : isDueToday
                                  ? 'text-amber-700 font-bold'
                                  : 'text-slate-600'
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              {t.dueDate} {t.dueTime || ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.subtasks.length > 0 ? (
                            <span className="text-slate-600">
                              {completedSt}/{t.subtasks.length} done
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={buildGoogleCalendarUrl(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-medium transition"
                            title="Add to Google Calendar"
                          >
                            <Calendar className="w-3 h-3" />
                            GCal
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'calendar' && (
          /* Schedule / Calendar Timeline View */
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Deadlines & Upcoming Schedule</h3>
                <p className="text-xs text-slate-500">
                  Track due dates and sync reminders with Google Calendar.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Google Calendar
                </a>
              </div>
            </div>

            {/* List grouped by date */}
            <div className="space-y-4">
              {filteredTasks
                .filter((t) => t.dueDate)
                .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1))
                .map((t) => {
                  const isOverdue = t.dueDate! < todayStr && t.status !== 'done';
                  const isDueToday = t.dueDate! === todayStr;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition ${
                        isOverdue
                          ? 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                          : isDueToday
                          ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isOverdue
                                ? 'bg-red-100 text-red-800'
                                : isDueToday
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isOverdue ? 'Overdue' : isDueToday ? 'Due Today' : t.dueDate}
                          </span>
                          <span className="font-bold text-sm text-slate-800">{t.title}</span>
                        </div>
                        {t.linkedEntities && t.linkedEntities.length > 0 && (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="font-semibold uppercase text-slate-700">
                              [{t.linkedEntities[0].type}]:
                            </span>
                            <span>{t.linkedEntities[0].id}</span>
                            {t.linkedEntities[0].title && <span>- {t.linkedEntities[0].title}</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={buildGoogleCalendarUrl(t)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Add to Google Calendar
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadTaskIcs(t);
                          }}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
                          title="Download .ics"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {filteredTasks.filter((t) => t.dueDate).length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No scheduled tasks with due dates found. Add deadlines to tasks to view them here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddComment={addComment}
          onToggleSubtask={toggleSubtask}
          availableUsers={availableUsers}
          currentUser={user}
          userPosition={userData?.position}
        />
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createTask}
        availableUsers={availableUsers}
        currentUser={user}
        userPosition={userData?.position}
        initialStatus={createInitialStatus}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------------
// Kanban Task Card Component
// --------------------------------------------------------------------------------------
interface TaskCardProps {
  task: CoworkingTask;
  todayStr: string;
  onClick: () => void;
  onQuickNext: (e: React.MouseEvent) => void;
  onQuickPrev: (e: React.MouseEvent) => void;
  onToggleSubtask: (stId: string) => void;
}

function TaskCard({ task, todayStr, onClick, onQuickNext, onQuickPrev }: TaskCardProps) {
  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'done';
  const isDueToday = task.dueDate && task.dueDate === todayStr;

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
    >
      <div className="space-y-2">
        {/* Top: Priority Badge + Linked Entities Chips */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              task.priority === 'critical'
                ? 'bg-red-100 text-red-800'
                : task.priority === 'high'
                ? 'bg-amber-100 text-amber-800'
                : task.priority === 'medium'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {task.priority}
          </span>

          {/* Quick status stepper */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
            {task.status !== 'todo' && (
              <button
                onClick={onQuickPrev}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                title="Move Back"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {task.status !== 'done' && (
              <button
                onClick={onQuickNext}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                title="Advance Status"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Task Title */}
        <h4 className="font-bold text-xs text-slate-800 leading-snug group-hover:text-blue-600 transition line-clamp-2">
          {task.title}
        </h4>

        {/* Linked Entity Badges (SN, SID, Project, etc.) */}
        {task.linkedEntities && task.linkedEntities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {task.linkedEntities.slice(0, 2).map((ent, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-700 max-w-[170px] truncate"
                title={`${ent.type.toUpperCase()}: ${ent.id} ${ent.title ? `(${ent.title})` : ''}`}
              >
                <span className="font-bold uppercase text-[9px] text-blue-700">[{ent.type}]</span>
                <span className="truncate font-mono">{ent.id}</span>
              </span>
            ))}
            {task.linkedEntities.length > 2 && (
              <span className="text-[10px] text-slate-400 font-semibold">
                +{task.linkedEntities.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Due Date, Checklist Progress, and Assignee Avatars */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.dueDate ? (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue
                  ? 'text-red-700 font-bold'
                  : isDueToday
                  ? 'text-amber-700 font-bold'
                  : 'text-slate-500'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {task.dueDate.substring(5)}
            </span>
          ) : null}

          {/* Subtask progress */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="flex items-center gap-1 text-slate-400">
              <CheckSquare className="w-3 h-3" />
              {completedSubtasks}/{task.subtasks.length}
            </span>
          )}
        </div>

        {/* Assignees Avatars */}
        <div className="flex items-center -space-x-1.5">
          {task.assignees && task.assignees.length > 0 ? (
            task.assignees.slice(0, 3).map((a) => (
              <div
                key={a.uid}
                title={`${a.name} (${a.position || a.role || 'Member'})`}
                className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[9px] font-bold text-slate-700 shadow-2xs"
              >
                {a.name.substring(0, 2).toUpperCase()}
              </div>
            ))
          ) : (
            <span className="text-[10px] text-slate-300">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
