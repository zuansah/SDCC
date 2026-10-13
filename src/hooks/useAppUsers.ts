import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TaskAssignee } from '../types/task';

export function useAppUsers() {
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: TaskAssignee[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            uid: d.id,
            name: data.name || data.email?.split('@')[0] || 'User',
            email: data.email || '',
            role: data.role || 'Member',
            position: data.position || '',
          });
        });
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Error loading users:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { users, loading };
}
