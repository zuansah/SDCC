import React, { useState } from 'react';
import {
  X,
  Plus,
  Calendar,
  Users,
  Briefcase,
  Layers,
  Cpu,
  Tag,
  Link as LinkIcon,
  AlertTriangle,
  Check,
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

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: Omit<CoworkingTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  availableUsers: TaskAssignee[];
  currentUser: any;
  userPosition?: string;
  initialStatus?: TaskStatus;
}

const ENTITY_TYPES: { type: LinkedEntityType; label: string; icon: any }[] = [
  { type: 'project', label: 'Project', icon: Briefcase },
  { type: 'sid', label: 'SID (Service ID)', icon: Layers },
  { type: 'sn', label: 'Serial Number (SN)', icon: Cpu },
  { type: 'trace', label: 'Trace ID (TLK-...)', icon: Tag },
  { type: 'order', label: 'Order Number', icon: LinkIcon },
  { type: 'ticket', label: 'Ticket / Assurance', icon: AlertTriangle },
  { type: 'custom', label: 'Custom Reference', icon: LinkIcon },
];

export default function TaskCreateModal({
  isOpen,
  onClose,
  onCreate,
  availableUsers,
  currentUser,
  userPosition,
  initialStatus = 'todo',
}: TaskCreateModalProps) {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<TaskAssignee[]>([]);

  // Linked entity
  const [entityType, setEntityType] = useState<LinkedEntityType>('sn');
  const [entityId, setEntityId] = useState('');
  const [entityTitle, setEntityTitle] = useState('');

  // Initial subtask
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks([...subtasks, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const handleToggleAssignee = (u: TaskAssignee) => {
    if (selectedAssignees.some((a) => a.uid === u.uid)) {
      setSelectedAssignees(selectedAssignees.filter((a) => a.uid !== u.uid));
    } else {
      setSelectedAssignees([...selectedAssignees, u]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setSubmitting(true);
    try {
      const linkedEntities: LinkedEntity[] = [];
      if (entityId.trim()) {
        linkedEntities.push({
          type: entityType,
          id: entityId.trim(),
          title: entityTitle.trim() || undefined,
        });
      }

      const formattedSubtasks: SubtaskItem[] = subtasks.map((st, i) => ({
        id: `st-${Date.now()}-${i}`,
        title: st,
        completed: false,
      }));

      await onCreate({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        assignees: selectedAssignees,
        linkedEntities,
        subtasks: formattedSubtasks,
        comments: [],
        createdByUid: currentUser?.uid || 'anon',
        createdByName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Member',
        createdByEmail: currentUser?.email || '',
        tags: [],
      });

      onClose();
    } catch (err: any) {
      alert('Error creating task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Create New Task</h3>
            <p className="text-xs text-slate-500">
              Assign work, link to SD-WAN entities, set deadlines, and sync to Google Calendar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Verify BGP routes on KC Atambua router, terminate backup link..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Provide background, steps to reproduce, configuration guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>

          {/* Status, Priority, Due Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-20 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Link Entity (Project, SID, SN, etc.) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link SD-WAN Asset / Project / SID / SN</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as LinkedEntityType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                >
                  {ENTITY_TYPES.map((et) => (
                    <option key={et.type} value={et.type}>
                      {et.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  ID / Code / Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. FVT2912L0LQ, SID-1092, Bank NTT..."
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Site / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. KC Atambua, DCS WH..."
                  value={entityTitle}
                  onChange={(e) => setEntityTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Assignees (from App Users) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Assign Team Members ({selectedAssignees.length})
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
              {availableUsers.map((u) => {
                const isSelected = selectedAssignees.some((a) => a.uid === u.uid);
                return (
                  <div
                    key={u.uid}
                    onClick={() => handleToggleAssignee(u)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{u.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.position ? (
                            <span className="text-blue-700 font-medium">{u.position}</span>
                          ) : (
                            u.role || u.email
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subtasks checklist items */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Initial Checklist ({subtasks.length})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Inspect cabling, check BGP, update ticket..."
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1 pt-1">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
                  >
                    <span>• {st}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(idx)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
