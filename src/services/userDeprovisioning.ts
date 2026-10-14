import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../lib/firebase';
import { logAccessEvent, endUserSession } from './accessLogger';

export interface DeprovisionResult {
  success: boolean;
  authDeleted: boolean;
  usersDeleted: boolean;
  message: string;
}

/**
 * Check if a user has an authentication credential stored in the secure auth_vault
 */
export async function checkVaultPassword(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'auth_vault', uid));
    if (snap.exists() && snap.data()?.password) {
      return snap.data().password as string;
    }
  } catch (err) {
    console.warn('Failed to read from auth_vault:', err);
  }
  return null;
}

/**
 * Save or update a user's password in auth_vault (accessible only to Super Admin)
 */
export async function saveVaultPassword(uid: string, email: string, password: string): Promise<void> {
  if (!uid || !password) return;
  try {
    await setDoc(doc(db, 'auth_vault', uid), {
      email: email.trim().toLowerCase(),
      password: password,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save to auth_vault:', err);
  }
}

/**
 * Completely de-provision a user:
 * 1. Delete Firebase Authentication account
 * 2. Delete Firestore /users/{uid} profile document
 * 3. Delete /auth_vault/{uid} record
 * 4. Force-terminate and delete /user_sessions/{uid}
 * 5. Clean up legacy /deleted_users records
 * 6. Record audit log in /access_logs
 */
export async function deprovisionUser(params: {
  uid: string;
  email: string;
  name?: string;
  password?: string;
}): Promise<DeprovisionResult> {
  const primaryAuth = getAuth();
  if (primaryAuth.currentUser && primaryAuth.currentUser.uid === params.uid) {
    throw new Error('Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk sebagai Super Admin.');
  }

  let authDeleted = false;
  let authErrorMsg = '';

  // 1. Determine password for Auth deletion
  let targetPassword = params.password?.trim() || '';
  if (!targetPassword) {
    targetPassword = (await checkVaultPassword(params.uid)) || '';
  }

  // 2. Attempt to delete Firebase Auth account
  if (targetPassword) {
    const tempAppName = `deprovision_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secondaryApp = initializeApp(firebaseConfig, tempAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // Authenticate as target user on secondary auth instance
      const userCred = await signInWithEmailAndPassword(secondaryAuth, params.email.trim(), targetPassword);
      // Delete the Auth account
      await deleteUser(userCred.user);
      authDeleted = true;
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        // Account was already deleted in Firebase Auth
        authDeleted = true;
      } else if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
        authErrorMsg = 'Password yang dimasukkan tidak cocok dengan akun Firebase Auth.';
        throw new Error(authErrorMsg);
      } else {
        console.warn('Auth deletion error:', authErr);
        authErrorMsg = authErr.message || 'Gagal menghapus akun Firebase Auth.';
        throw new Error(`Gagal menghapus akun Firebase Auth: ${authErrorMsg}`);
      }
    } finally {
      try {
        await deleteApp(secondaryApp);
      } catch (_) {}
    }
  }

  // 3. Delete from Firestore /users/{uid}
  await deleteDoc(doc(db, 'users', params.uid));

  // 4. Delete from /auth_vault/{uid}
  try {
    await deleteDoc(doc(db, 'auth_vault', params.uid));
  } catch (_) {}

  // 5. Delete session and force terminate
  try {
    await endUserSession(params.uid);
  } catch (_) {}

  // 6. Clean up legacy /deleted_users records if any
  try {
    await deleteDoc(doc(db, 'deleted_users', params.email.trim().toLowerCase()));
  } catch (_) {}

  // 7. Record security audit log
  try {
    await logAccessEvent({
      action: 'USER_DELETED',
      details: `User ${params.email} (UID: ${params.uid}) de-provisioned. Firebase Auth account: ${authDeleted ? 'DELETED' : 'NOT DELETED (No password provided)'}. Firestore /users: DELETED.`,
      userEmail: primaryAuth.currentUser?.email || 'superadmin@telkom.co.id',
      role: 'Super Admin',
    });
  } catch (_) {}

  return {
    success: true,
    authDeleted,
    usersDeleted: true,
    message: authDeleted
      ? `Pengguna ${params.email} berhasil dide-provisioning: Akun Firebase Auth dan record /users telah dihapus permanen.`
      : `Record /users untuk ${params.email} telah dihapus. Akun Firebase Auth tidak dihapus karena password tidak tersedia.`,
  };
}
