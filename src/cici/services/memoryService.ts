import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  CiciMemory, 
  CiciUserDoc, 
  CiciThread, 
  CiciMessage, 
  CiciDocument, 
  CiciReminder, 
  MemoryType 
} from '../types';

/**
 * Loads or initializes user profile in /cici_users/{uid}
 */
export async function getCiciUserProfile(uid: string): Promise<CiciUserDoc> {
  try {
    const userRef = doc(db, 'cici_users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as CiciUserDoc;
      return {
        ...data,
        memoryEnabled: data.memoryEnabled !== undefined ? data.memoryEnabled : true,
      };
    }

    const defaultProfile: CiciUserDoc = {
      memoryEnabled: true,
      language: 'id',
      lastSeenAt: new Date().toISOString(),
    };
    await setDoc(userRef, defaultProfile, { merge: true });
    return defaultProfile;
  } catch (err) {
    console.warn('Failed to load cici_users profile, using default:', err);
    return { memoryEnabled: true, language: 'id' };
  }
}

/**
 * Updates user profile / settings
 */
export async function updateCiciUserProfile(uid: string, updates: Partial<CiciUserDoc>): Promise<void> {
  try {
    const userRef = doc(db, 'cici_users', uid);
    await setDoc(userRef, updates, { merge: true });
  } catch (err) {
    console.error('Failed to update cici_users profile:', err);
  }
}

/**
 * Loads the memory index: name + description, newest first, capped at ~150 lines
 */
export async function loadMemoryIndex(uid: string): Promise<string> {
  try {
    const profile = await getCiciUserProfile(uid);
    if (profile.memoryEnabled === false) {
      return 'User has disabled memory storage.';
    }

    const memCol = collection(db, 'cici_users', uid, 'memories');
    const q = query(memCol, orderBy('updatedAt', 'desc'), limit(150));
    const snap = await getDocs(q);

    if (snap.empty) {
      return 'No memories stored yet.';
    }

    const lines: string[] = [];
    snap.forEach(d => {
      const m = d.data() as CiciMemory;
      lines.push(`- [${m.type.toUpperCase()}] ${m.name}: ${m.description}`);
    });

    return lines.join('\n');
  } catch (err) {
    console.warn('Failed to load memory index:', err);
    return 'No memories stored yet.';
  }
}

/**
 * Loads all memories for user
 */
export async function loadAllMemories(uid: string): Promise<CiciMemory[]> {
  try {
    const memCol = collection(db, 'cici_users', uid, 'memories');
    const q = query(memCol, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const list: CiciMemory[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as CiciMemory);
    });
    return list;
  } catch (err) {
    console.error('Failed to load all memories:', err);
    return [];
  }
}

/**
 * Saves or updates a memory in /cici_users/{uid}/memories
 */
export async function saveMemory(
  uid: string,
  mem: { name: string; description: string; type: MemoryType; body: string; source?: 'cici' | 'user' }
): Promise<CiciMemory | null> {
  try {
    const profile = await getCiciUserProfile(uid);
    if (profile.memoryEnabled === false) {
      console.log('Memory is disabled for this user. Skipping save.');
      return null;
    }

    // Slugify name
    const slug = mem.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `mem-${Date.now()}`;
    const memRef = doc(db, 'cici_users', uid, 'memories', slug);

    const now = new Date().toISOString();
    const existingSnap = await getDoc(memRef);

    const memoryDoc: CiciMemory = {
      id: slug,
      name: slug,
      description: mem.description.trim(),
      type: mem.type,
      body: mem.body.trim(),
      createdAt: existingSnap.exists() ? (existingSnap.data().createdAt || now) : now,
      updatedAt: now,
      source: mem.source || 'cici',
    };

    await setDoc(memRef, memoryDoc, { merge: true });
    return memoryDoc;
  } catch (err) {
    console.error('Failed to save memory:', err);
    return null;
  }
}

/**
 * Deletes a memory by name
 */
export async function deleteMemory(uid: string, name: string): Promise<boolean> {
  try {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || name;
    const memRef = doc(db, 'cici_users', uid, 'memories', slug);
    await deleteDoc(memRef);
    return true;
  } catch (err) {
    console.error('Failed to delete memory:', err);
    return false;
  }
}

/**
 * Deletes all memories (Hapus semua with confirmation)
 */
export async function clearAllMemories(uid: string): Promise<void> {
  try {
    const memCol = collection(db, 'cici_users', uid, 'memories');
    const snap = await getDocs(memCol);
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.error('Failed to clear all memories:', err);
    throw err;
  }
}

/**
 * Exports memories as a single Markdown document
 */
export async function exportMemoriesAsMarkdown(uid: string): Promise<string> {
  const memories = await loadAllMemories(uid);
  let md = `# Memori Cici: Ekspor Pribadi\n\n`;
  md += `Diekspor pada: ${new Date().toLocaleString()}\n`;
  md += `Total catatan memori: ${memories.length}\n\n`;
  md += `---\n\n`;

  if (memories.length === 0) {
    md += `*Belum ada memori yang tersimpan.*\n`;
    return md;
  }

  for (const m of memories) {
    md += `## [${m.type.toUpperCase()}] ${m.name}\n`;
    md += `**Ringkasan:** ${m.description}\n`;
    md += `**Terakhir diperbarui:** ${m.updatedAt}\n\n`;
    md += `${m.body}\n\n`;
    md += `---\n\n`;
  }

  return md;
}

/**
 * Loads recent thread summaries (last 3 threads)
 */
export async function loadRecentThreadSummaries(uid: string, limitCount = 3): Promise<string> {
  try {
    const threadsCol = collection(db, 'cici_users', uid, 'threads');
    const q = query(threadsCol, orderBy('updatedAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);

    if (snap.empty) {
      return 'No previous thread summaries.';
    }

    const summaries: string[] = [];
    snap.forEach(d => {
      const data = d.data() as CiciThread;
      if (data.summary) {
        summaries.push(`### Thread "${data.title || 'Untitled'}" (${data.updatedAt?.split('T')[0]}):\n${data.summary}`);
      }
    });

    return summaries.join('\n\n') || 'No previous thread summaries.';
  } catch (err) {
    console.warn('Failed to load thread summaries:', err);
    return 'No previous thread summaries.';
  }
}

/**
 * Saves or updates thread summary
 */
export async function saveThreadSummary(uid: string, threadId: string, summary: string, title?: string): Promise<void> {
  try {
    const threadRef = doc(db, 'cici_users', uid, 'threads', threadId);
    await setDoc(threadRef, {
      summary,
      ...(title ? { title } : {}),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Failed to save thread summary:', err);
  }
}

/**
 * Saves document authored by Cici to /cici_users/{uid}/documents
 */
export async function saveCiciDocument(
  uid: string,
  docData: Omit<CiciDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CiciDocument> {
  const docId = `doc-${Date.now()}`;
  const now = new Date().toISOString();
  const fullDoc: CiciDocument = {
    id: docId,
    title: docData.title,
    kind: docData.kind,
    markdown: docData.markdown,
    sources: docData.sources || ['NSM System'],
    createdAt: now,
    updatedAt: now,
  };

  const docRef = doc(db, 'cici_users', uid, 'documents', docId);
  await setDoc(docRef, fullDoc);
  return fullDoc;
}

/**
 * Updates an authored document
 */
export async function updateCiciDocument(uid: string, docId: string, markdown: string): Promise<void> {
  const docRef = doc(db, 'cici_users', uid, 'documents', docId);
  await updateDoc(docRef, {
    markdown,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Loads all authored documents
 */
export async function loadAllDocuments(uid: string): Promise<CiciDocument[]> {
  try {
    const docsCol = collection(db, 'cici_users', uid, 'documents');
    const q = query(docsCol, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const list: CiciDocument[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as CiciDocument);
    });
    return list;
  } catch (err) {
    console.error('Failed to load documents:', err);
    return [];
  }
}

/**
 * Loads reminders from /cici_users/{uid}/reminders
 */
export async function loadReminders(uid: string): Promise<CiciReminder[]> {
  try {
    const remCol = collection(db, 'cici_users', uid, 'reminders');
    const q = query(remCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: CiciReminder[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as CiciReminder);
    });
    return list;
  } catch (err) {
    console.error('Failed to load reminders:', err);
    return [];
  }
}

/**
 * Adds a new reminder or watch
 */
export async function saveReminder(
  uid: string,
  rem: Omit<CiciReminder, 'id' | 'status' | 'createdAt'>
): Promise<CiciReminder> {
  const id = `rem-${Date.now()}`;
  const reminder: CiciReminder = {
    id,
    text: rem.text,
    due: rem.due,
    watch: rem.watch,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const remRef = doc(db, 'cici_users', uid, 'reminders', id);
  await setDoc(remRef, reminder);
  return reminder;
}

/**
 * Updates reminder status
 */
export async function updateReminderStatus(uid: string, id: string, status: 'pending' | 'triggered' | 'dismissed'): Promise<void> {
  const remRef = doc(db, 'cici_users', uid, 'reminders', id);
  await updateDoc(remRef, { status });
}
