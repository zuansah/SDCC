import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CoworkingTask, TaskStatus, TaskPriority, TaskFilterOptions, SubtaskItem, TaskComment, LinkedEntity } from '../types/task';

export function useCoworkingTasks() {
  const [tasks, setTasks] = useState<CoworkingTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time listener for tasks
  useEffect(() => {
    const colRef = collection(db, 'tasks');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const loadedTasks: CoworkingTask[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          loadedTasks.push({
            id: d.id,
            title: data.title || 'Untitled Task',
            description: data.description || '',
            status: (data.status || 'todo') as TaskStatus,
            priority: (data.priority || 'medium') as TaskPriority,
            linkedEntities: Array.isArray(data.linkedEntities) ? data.linkedEntities : [],
            assignees: Array.isArray(data.assignees) ? data.assignees : [],
            createdByUid: data.createdByUid || '',
            createdByName: data.createdByName || 'Unknown',
            createdByEmail: data.createdByEmail || '',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            dueDate: data.dueDate || undefined,
            dueTime: data.dueTime || undefined,
            estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
            subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
            comments: Array.isArray(data.comments) ? data.comments : [],
            tags: Array.isArray(data.tags) ? data.tags : [],
          });
        });

        // Sort by updatedAt descending
        loadedTasks.sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        setTasks(loadedTasks);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching tasks from firestore:', err);
        setError(err.message || 'Failed to load tasks');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Create a new task
  const createTask = useCallback(
    async (taskData: Omit<CoworkingTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      const newId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      const taskRef = doc(db, 'tasks', newId);

      const payload = {
        ...taskData,
        id: newId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(taskRef, payload);
      return newId;
    },
    []
  );

  // Update an existing task
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<CoworkingTask>): Promise<void> => {
      const taskRef = doc(db, 'tasks', taskId);
      const payload = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(taskRef, payload);
    },
    []
  );

  // Delete a task
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    const taskRef = doc(db, 'tasks', taskId);
    await deleteDoc(taskRef);
  }, []);

  // Quick move status (e.g. drag or click in Kanban)
  const changeTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus): Promise<void> => {
      await updateTask(taskId, { status: newStatus });
    },
    [updateTask]
  );

  // Toggle subtask completion
  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, userName?: string): Promise<void> => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const updatedSubtasks = target.subtasks.map((st) => {
        if (st.id === subtaskId) {
          const nextCompleted = !st.completed;
          return {
            ...st,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
            completedBy: nextCompleted ? userName || 'Team Member' : undefined,
          };
        }
        return st;
      });

      await updateTask(taskId, { subtasks: updatedSubtasks });
    },
    [tasks, updateTask]
  );

  // Add a comment to task
  const addComment = useCallback(
    async (
      taskId: string,
      comment: {
        authorUid: string;
        authorName: string;
        authorEmail: string;
        authorPosition?: string;
        content: string;
      }
    ): Promise<void> => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const newComment: TaskComment = {
        id: `c-${Date.now()}`,
        ...comment,
        createdAt: new Date().toISOString(),
      };

      const updatedComments = [...target.comments, newComment];
      await updateTask(taskId, { comments: updatedComments });
    },
    [tasks, updateTask]
  );

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    toggleSubtask,
    addComment,
  };
}
