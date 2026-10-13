import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Share2,
  ExternalLink,
  MessageSquare,
  Send,
  AlertTriangle,
  Link as LinkIcon,
  Tag,
  Download,
  Copy,
  Check,
  Briefcase,
  Layers,
  Cpu,
} from 'lucide-react';
import {
  CoworkingTask,
  TaskStatus,
  TaskPriority,
  LinkedEntity,
  LinkedEntityType,
  TaskAssignee,
  SubtaskItem,
} from '../types/task';
import { buildGoogleCalendarUrl, downloadTaskIcs } from '../utils/calendarUtils';

interface TaskDetailModalProps {
  task: CoworkingTask | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<CoworkingTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onAddComment: (
    taskId: string,
    comment: {
      authorUid: string;
      authorName: string;
      authorEmail: string;
      authorPosition?: string;
      content: string;
    }
  ) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string, userName?: string) => Promise<void>;
  availableUsers: TaskAssignee[];
  currentUser: any;
  userPosition?: string;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'in_review', label: 'In Review', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; badge: string }[] = [
  { value: 'low', label: 'Low', badge: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', badge: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', badge: 'bg-amber-100 text-amber-800' },
  { value: 'critical', label: 'Critical', badge: 'bg-red-100 text-red-800 font-bold' },
];

const ENTITY_TYPES: { type: LinkedEntityType; label: string; icon: any }[] = [
  { type: 'project', label: 'Project', icon: Briefcase },
  { type: 'sid', label: 'SID (Service ID)', icon: Layers },
  { type: 'sn', label: 'Serial Number (SN)', icon: Cpu },
  { type: 'trace', label: 'Trace ID (TLK-...)', icon: Tag },
  { type: 'order', label: 'Order Number', icon: LinkIcon },
  { type: 'ticket', label: 'Ticket / Assurance', icon: AlertTriangle },
  { type: 'custom', label: 'Custom Reference', icon: LinkIcon },
];

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  onToggleSubtask,
  availableUsers,
  currentUser,
  userPosition,
}: TaskDetailModalProps) {
  if (!isOpen || !task) return null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [dueTime, setDueTime] = useState(task.dueTime || '');
  const [assignees, setAssignees] = useState<TaskAssignee[]>(task.assignees || []);
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntity[]>(task.linkedEntities || []);

  // New subtask input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // New linked entity input
  const [newEntityType, setNewEntityType] = useState<LinkedEntityType>('sn');
  const [newEntityId, setNewEntityId] = useState('');
  const [newEntityTitle, setNewEntityTitle] = useState('');
  const [showAddEntity, setShowAddEntity] = useState(false);

  // New comment input
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Copy URL state
  const [copiedCalUrl, setCopiedCalUrl] = useState(false);
  const [saving, setSaving] = useState(false);

  // Computed Google Calendar URL
  const googleCalUrl = buildGoogleCalendarUrl({
    ...task,
    title,
    description,
    status,
    priority,
    dueDate,
    dueTime,
    assignees,
    linkedEntities,
  });

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await onUpdate(task.id, {
        title: title.trim() || 'Untitled Task',
        description,
        status,
        priority,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        assignees,
        linkedEntities,
      });
    } catch (err: any) {
      alert('Error updating task: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSt: SubtaskItem = {
      id: `st-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const updated = [...task.subtasks, newSt];
    await onUpdate(task.id, { subtasks: updated });
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const updated = task.subtasks.filter((s) => s.id !== subtaskId);
    await onUpdate(task.id, { subtasks: updated });
  };

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityId.trim()) return;
    const newEnt: LinkedEntity = {
      type: newEntityType,
      id: newEntityId.trim(),
      title: newEntityTitle.trim() || undefined,
    };
    const updated = [...linkedEntities, newEnt];
    setLinkedEntities(updated);
    await onUpdate(task.id, { linkedEntities: updated });
    setNewEntityId('');
    setNewEntityTitle('');
    setShowAddEntity(false);
  };

  const handleDeleteEntity = async (index: number) => {
    const updated = linkedEntities.filter((_, i) => i !== index);
    setLinkedEntities(updated);
    await onUpdate(task.id, { linkedEntities: updated });
  };

  const handleToggleAssignee = (user: TaskAssignee) => {
    const exists = assignees.some((a) => a.uid === user.uid);
    let updated: TaskAssignee[];
    if (exists) {
      updated = assignees.filter((a) => a.uid !== user.uid);
    } else {
      updated = [...assignees, user];
    }
    setAssignees(updated);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment(task.id, {
        authorUid: currentUser?.uid || 'anon',
        authorName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Member',
        authorEmail: currentUser?.email || '',
        authorPosition: userPosition,
        content: newCommentText.trim(),
      });
      setNewCommentText('');
    } catch (err: any) {
      alert('Error posting update: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyCalLink = () => {
    navigator.clipboard.writeText(googleCalUrl);
    setCopiedCalUrl(true);
    setTimeout(() => setCopiedCalUrl(false), 2500);
  };

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const subtaskProgress =
    task.subtasks.length > 0 ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveGeneral}
              className="w-full text-xl font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1.5 py-0.5 rounded outline-none transition"
              placeholder="Task Title..."
            />
            <div className="flex flex-wrap items-center gap-2 mt-1 px-1.5 text-xs text-slate-500">
              <span>Created by <strong>{task.createdByName}</strong></span>
              <span>•</span>
              <span>Updated {new Date(task.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                  onClose();
                }
              }}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete Task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status, Priority & Due Date Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Status Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as TaskStatus;
                  setStatus(s);
                  onUpdate(task.id, { status: s });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  const p = e.target.value as TaskPriority;
                  setPriority(p);
                  onUpdate(task.id, { priority: p });
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date & Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Due Date & Time
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    onUpdate(task.id, { dueDate: e.target.value });
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => {
                    setDueTime(e.target.value);
                    onUpdate(task.id, { dueTime: e.target.value });
                  }}
                  className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Google Calendar Sharing Action Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Google Calendar Sync & Sharing</h4>
                <p className="text-xs text-slate-600">
                  Add this task to Google Calendar or share direct invite with team members.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Add to Google Calendar
              </a>

              <button
                onClick={handleCopyCalLink}
                className="px-2.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-medium transition flex items-center gap-1"
                title="Copy Google Calendar event URL"
              >
                {copiedCalUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCalUrl ? 'Copied!' : 'Share Link'}
              </button>

              <button
                onClick={() => downloadTaskIcs(task)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1"
                title="Download iCal (.ics) file"
              >
                <Download className="w-3.5 h-3.5" />
                .ICS
              </button>
            </div>
          </div>

          {/* Main Grid: Description + Checklist on Left, Linked Items + Assignees on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Description / Notes
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleSaveGeneral}
                  placeholder="Add details, steps, context or resolution notes..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Checklist / Subtasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-600" />
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Checklist / Subtasks ({completedSubtasks}/{task.subtasks.length})
                    </h4>
                  </div>
                  {task.subtasks.length > 0 && (
                    <span className="text-xs font-medium text-slate-500">{subtaskProgress}% done</span>
                  )}
                </div>

                {/* Progress bar */}
                {task.subtasks.length > 0 && (
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 transition-all duration-300 rounded-full"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                )}

                {/* Subtask list */}
                <div className="space-y-1.5">
                  {task.subtasks.map((st) => (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition ${
                        st.completed
                          ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleSubtask(task.id, st.id, currentUser?.displayName || currentUser?.email)}
                        className="flex items-center gap-2.5 flex-1 text-left text-xs cursor-pointer"
                      >
                        {st.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 hover:text-blue-600" />
                        )}
                        <span>{st.title}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(st.id)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Subtask Form */}
                <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add an item to the checklist..."
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Updates / Comments History */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Updates & Team Log ({task.comments?.length || 0})
                  </h4>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{c.authorName}</span>
                            {c.authorPosition && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {c.authorPosition}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No updates logged yet. Share progress below.</p>
                  )}
                </div>

                {/* Comment Input */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write an update or progress note..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newCommentText.trim()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar: Linked Entities & Assignees */}
            <div className="space-y-6">
              {/* Linked Entities (Project, SID, SN, Trace ID, etc.) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Linked Items</span>
                  </div>
                  <button
                    onClick={() => setShowAddEntity(!showAddEntity)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Link
                  </button>
                </div>

                {/* Add Entity Form */}
                {showAddEntity && (
                  <form onSubmit={handleAddEntity} className="p-3 bg-white border border-blue-200 rounded-lg space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Entity Type</label>
                      <select
                        value={newEntityType}
                        onChange={(e) => setNewEntityType(e.target.value as LinkedEntityType)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      >
                        {ENTITY_TYPES.map((et) => (
                          <option key={et.type} value={et.type}>
                            {et.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        ID / Number / Code
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SN123456, SID-98765, Project Name..."
                        value={newEntityId}
                        onChange={(e) => setNewEntityId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Optional Label / Site Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. KC Atambua, DCS Warehouse..."
                        value={newEntityTitle}
                        onChange={(e) => setNewEntityTitle(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddEntity(false)}
                        className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                      >
                        Save Link
                      </button>
                    </div>
                  </form>
                )}

                {/* List of Linked Entities */}
                <div className="space-y-1.5">
                  {linkedEntities.length > 0 ? (
                    linkedEntities.map((ent, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {ent.type}
                          </span>
                          <span className="font-mono font-medium text-blue-700 truncate" title={ent.id}>
                            {ent.id}
                          </span>
                          {ent.title && <span className="text-slate-500 truncate">({ent.title})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntity(idx)}
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No linked entities. Click "Add Link" to connect an SN, SID, or Project.</p>
                  )}
                </div>
              </div>

              {/* Assignees Selector */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  <span>Team Assignees ({assignees.length})</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableUsers.map((u) => {
                    const isAssigned = assignees.some((a) => a.uid === u.uid);
                    return (
                      <div
                        key={u.uid}
                        onClick={() => {
                          handleToggleAssignee(u);
                          const exists = assignees.some((a) => a.uid === u.uid);
                          const next = exists
                            ? assignees.filter((a) => a.uid !== u.uid)
                            : [...assignees, u];
                          onUpdate(task.id, { assignees: next });
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isAssigned
                            ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="font-semibold text-slate-800 truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {u.position || u.role || u.email}
                            </div>
                          </div>
                        </div>

                        {isAssigned && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {saving ? 'Saving changes...' : 'All edits are saved in real-time.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
