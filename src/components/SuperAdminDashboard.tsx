import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Settings2, Key, RefreshCw, X, Shield, Mail, CheckCircle2, Trash2,
  ShieldCheck, Activity, Layers, Truck, Database, FlaskConical, CheckSquare,
  Square, Search, Sparkles, Check, Filter, Info, Radio, Users, Clock, Globe
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { initializeApp } from 'firebase/app';
import MappingUpload from './MappingUpload';
import RealtimeSessionsView from './admin/RealtimeSessionsView';
import AccessAuditLogsView from './admin/AccessAuditLogsView';
import DeProvisionModal from './admin/DeProvisionModal';
import { saveVaultPassword } from '../services/userDeprovisioning';
import { UserSessionItem, AccessLogItem, forceTerminateSession, logAccessEvent } from '../services/accessLogger';

export interface ViewPermissionItem {
  id: string;
  label: string;
  category: 'Overview' | 'Fulfillment' | 'Operation' | 'Asset Management' | 'Lab' | 'Workflow';
  description: string;
  badge?: string;
}

export const ALL_VIEW_PERMISSIONS: ViewPermissionItem[] = [
  // Overview
  { 
    id: 'dashboard', 
    label: 'Overview Dashboard', 
    category: 'Overview', 
    description: 'Executive command center, network availability & KPI summary' 
  },

  // Fulfillment
  { 
    id: 'projects', 
    label: 'Project List', 
    category: 'Fulfillment', 
    description: 'Telkom SD-WAN project deployment master registry' 
  },
  { 
    id: 'project_management', 
    label: 'Project Management (PM)', 
    category: 'Fulfillment', 
    description: 'BA milestones, delivery tracking & timeline progress' 
  },
  { 
    id: 'orders', 
    label: 'Order Status', 
    category: 'Fulfillment', 
    description: 'WFM / E-Order dispatch & fulfillment tracking' 
  },
  { 
    id: 'tracking', 
    label: 'Tracking Asset', 
    category: 'Fulfillment', 
    description: 'Hardware dispatch location & site shipment tracking' 
  },

  // Operation
  { 
    id: 'assurance', 
    label: 'SD-WAN Assurance', 
    category: 'Operation', 
    description: 'InSERA SLA, Availability %, Downtime, TTR & AG compliance analytics',
    badge: 'InSERA SLA'
  },
  { 
    id: 'monitoring', 
    label: 'Monitoring', 
    category: 'Operation', 
    description: 'Live device telemetry, bandwidth, latency & site health' 
  },
  { 
    id: 'ticket', 
    label: 'Ticket', 
    category: 'Operation', 
    description: 'Incident trouble tickets & customer fault reports' 
  },
  { 
    id: 'controller', 
    label: 'Controller', 
    category: 'Operation', 
    description: 'SD-WAN Controller cluster nodes & live vManage status' 
  },
  { 
    id: 'license', 
    label: 'License', 
    category: 'Operation', 
    description: 'SD-WAN feature licenses & subscription expiration' 
  },

  // Asset Management
  { 
    id: 'inventory', 
    label: 'Inventory', 
    category: 'Asset Management', 
    description: 'SD-WAN CPE stock, serial numbers & MAC address registry' 
  },
  { 
    id: 'tracing', 
    label: 'Tracing', 
    category: 'Asset Management', 
    description: 'Historical device movement & deployment audit trails' 
  },
  { 
    id: 'identification', 
    label: 'Identification', 
    category: 'Asset Management', 
    description: 'Physical equipment validation and site pairing' 
  },
  { 
    id: 'label', 
    label: 'Label & QR Code', 
    category: 'Asset Management', 
    description: 'Physical sticker designer, batch QR generator & print queue' 
  },

  // Lab
  { 
    id: 'mass-testing-uat', 
    label: 'Mass Testing UAT', 
    category: 'Lab', 
    description: 'Batch automated UAT validation sandbox' 
  },
  { 
    id: 'open-sdwan', 
    label: 'Open SDWAN', 
    category: 'Lab', 
    description: 'Multi-vendor SD-WAN interoperability & lab environment' 
  },
  { 
    id: 'automation', 
    label: 'Automation', 
    category: 'Lab', 
    description: 'Provisioning scripts, zero-touch config & automated workflows' 
  },
  { 
    id: 'api', 
    label: 'API Integrations', 
    category: 'Lab', 
    description: 'REST API developer endpoints, keys & webhooks' 
  },

  // Workflow / Team
  { 
    id: 'task-todo', 
    label: 'Task to do', 
    category: 'Workflow', 
    description: 'Co-working team tasks, checklists & operational to-dos' 
  },
  { 
    id: 'new-ba', 
    label: 'Create BA Form', 
    category: 'Workflow', 
    description: 'Submit and generate Berita Acara UAT / Re-tagging reports' 
  },
  { 
    id: 'vendor_bas', 
    label: 'Vendor Dashboard', 
    category: 'Workflow', 
    description: 'External vendor BA submission & review dashboard' 
  },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Overview: Activity,
  Fulfillment: Truck,
  Operation: ShieldCheck,
  'Asset Management': Database,
  Lab: FlaskConical,
  Workflow: CheckSquare,
};

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [deprovisionTargetUser, setDeprovisionTargetUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Admin');
  const [newPosition, setNewPosition] = useState('');
  const [creating, setCreating] = useState(false);

  // Access modal state
  const [accessRole, setAccessRole] = useState('Admin');
  const [accessPosition, setAccessPosition] = useState('');
  const [allowedViews, setAllowedViews] = useState<string[]>([]);

  // Admin sub-tabs: 'users' | 'sessions' | 'logs'
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'sessions' | 'logs'>('users');
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const u: any[] = [];
      snapshot.forEach(doc => {
        u.push({ uid: doc.id, ...doc.data() });
      });
      setUsers(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen to realtime active user sessions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'user_sessions'), (snapshot) => {
      const list: UserSessionItem[] = [];
      snapshot.forEach(doc => {
        list.push({ uid: doc.id, ...doc.data() } as UserSessionItem);
      });
      setSessions(list);
      setSessionsLoading(false);
    }, (err) => {
      console.warn('user_sessions listener error:', err);
      setSessionsLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen to user access audit logs
  useEffect(() => {
    const q = query(collection(db, 'access_logs'), orderBy('timestamp', 'desc'), limit(300));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AccessLogItem[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as AccessLogItem);
      });
      setLogs(list);
      setLogsLoading(false);
    }, (err) => {
      console.warn('access_logs listener error:', err);
      setLogsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleForceTerminate = async (uid: string, email: string) => {
    try {
      await forceTerminateSession(uid);
      await logAccessEvent({
        action: 'FORCE_TERMINATED',
        details: `Super Admin forcefully disconnected session for user ${email}`,
        userEmail: getAuth().currentUser?.email || 'superadmin@telkom.co.id',
        role: 'Super Admin',
      });
      setToastMsg(`Sesi pengguna ${email} telah berhasil diputus.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setToastMsg(`Gagal memutus sesi: ${err.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Use secondary app to prevent logging out current admin
      const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      let targetUid = '';
      let isRestoredAccount = false;

      // Check if user is currently active in User Management
      const activeUser = users.find(u => u.email?.toLowerCase() === newEmail.trim().toLowerCase());
      if (activeUser) {
        alert(`A user with email ${newEmail} already exists in User Management.`);
        setCreating(false);
        return;
      }

      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, newEmail.trim(), newPassword);
        targetUid = userCred.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use' || authErr.message?.includes('auth/email-already-in-use')) {
          isRestoredAccount = true;

          // 1. Try to sign in with secondaryAuth using the password provided by the Super Admin
          try {
            const userCred = await signInWithEmailAndPassword(secondaryAuth, newEmail.trim(), newPassword);
            targetUid = userCred.user.uid;
          } catch (signInErr: any) {
            // 2. Check if this user was previously deleted and their UID was saved in deleted_users
            try {
              const deletedSnap = await getDoc(doc(db, 'deleted_users', newEmail.trim().toLowerCase()));
              if (deletedSnap.exists() && deletedSnap.data()?.uid) {
                targetUid = deletedSnap.data().uid;
              }
            } catch (snapErr) {
              console.warn("Could not check deleted_users:", snapErr);
            }
          }
        } else {
          throw authErr;
        }
      }

      if (targetUid) {
        // Save/restore user profile in Firestore
        await setDoc(doc(db, 'users', targetUid), {
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
          position: newPosition.trim(),
          mfaEnabled: false,
          mfaSecret: '',
          allowedViews: ['dashboard', 'projects', 'project_management', 'assurance', 'monitoring', 'ticket', 'task-todo']
        });

        // Securely store credentials in auth_vault for automated future de-provisioning
        await saveVaultPassword(targetUid, newEmail.trim(), newPassword);

        // Clean up from deleted_users if present
        try {
          await deleteDoc(doc(db, 'deleted_users', newEmail.trim().toLowerCase()));
        } catch (_) {}

        // Cleanup secondary auth
        try {
          await secondaryAuth.signOut();
        } catch (_) {}

        setShowAddModal(false);
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setNewPosition('');
        setNewRole('Admin');

        if (isRestoredAccount) {
          alert(`Success! User "${newEmail}" already had an active Firebase Authentication account. Their profile and dashboard access rights have been restored.`);
        } else {
          alert('User created successfully!');
        }
      } else {
        // If UID could not be determined because they were deleted before tracking was introduced and password differs
        const confirmReset = confirm(
          `User "${newEmail}" already exists in Firebase Authentication, but with a different previous password.\n\nWould you like to send them a Password Reset Email now so they can log in? Once they log in, their profile will automatically reconnect to this dashboard.`
        );
        if (confirmReset) {
          await sendPasswordResetEmail(getAuth(), newEmail.trim());
          alert(`Password reset link sent to ${newEmail}! When they log in with their updated password, their access will be reactivated.`);
          setShowAddModal(false);
        }
      }
    } catch (err: any) {
      alert('Error creating user: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (confirm(`Send password reset email to ${email}?`)) {
      try {
        const auth = getAuth();
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent!');
      } catch (err: any) {
        alert('Failed to send reset email: ' + err.message);
      }
    }
  };

  const handleResetMFA = async (uid: string, email: string) => {
    if (confirm(`Reset MFA for ${email}? They will need to scan a new QR code on next login.`)) {
      try {
        await setDoc(doc(db, 'users', uid), { mfaEnabled: false, mfaSecret: '' }, { merge: true });
        try {
          await deleteDoc(doc(db, 'user_sessions', uid));
        } catch (_) {}
        alert('MFA reset successfully! The user will be prompted to scan a new QR code on next login.');
      } catch (err: any) {
        alert('Failed to reset MFA: ' + err.message);
      }
    }
  };

  const handleDeleteUser = (user: any) => {
    const auth = getAuth();
    if (auth.currentUser && auth.currentUser.uid === user.uid) {
      alert('Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk sebagai Super Admin.');
      return;
    }
    setDeprovisionTargetUser(user);
  };

  const [searchFilter, setSearchFilter] = useState('');

  const openAccessModal = (user: any) => {
    setSelectedUser(user);
    setAccessRole(user.role || 'Admin');
    setAccessPosition(user.position || '');
    setAllowedViews(user.allowedViews || []);
    setSearchFilter('');
    setShowAccessModal(true);
  };

  const saveAccessOptions = async () => {
    try {
      await setDoc(doc(db, 'users', selectedUser.uid), {
        role: accessRole,
        position: accessPosition,
        allowedViews: allowedViews
      }, { merge: true });
      setShowAccessModal(false);
      alert('Access options saved successfully!');
    } catch (err: any) {
      alert('Failed to save access options: ' + err.message);
    }
  };

  // Group permissions by category
  const categories = Array.from(new Set(ALL_VIEW_PERMISSIONS.map(p => p.category))) as Array<ViewPermissionItem['category']>;

  const handleToggleView = (id: string) => {
    setAllowedViews(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleToggleCategory = (category: string) => {
    const categoryIds = ALL_VIEW_PERMISSIONS.filter(p => p.category === category).map(p => p.id);
    const allSelected = categoryIds.every(id => allowedViews.includes(id));
    if (allSelected) {
      setAllowedViews(prev => prev.filter(id => !categoryIds.includes(id)));
    } else {
      setAllowedViews(prev => Array.from(new Set([...prev, ...categoryIds])));
    }
  };

  const handleSelectAll = () => {
    setAllowedViews(ALL_VIEW_PERMISSIONS.map(p => p.id));
  };

  const handleDeselectAll = () => {
    setAllowedViews([]);
  };

  const handleApplyPreset = (presetName: 'ops' | 'fulfillment' | 'asset') => {
    if (presetName === 'ops') {
      const opsIds = ['dashboard', 'assurance', 'monitoring', 'ticket', 'controller', 'license', 'task-todo'];
      setAllowedViews(Array.from(new Set([...allowedViews, ...opsIds])));
    } else if (presetName === 'fulfillment') {
      const fulIds = ['dashboard', 'projects', 'project_management', 'orders', 'tracking', 'new-ba', 'task-todo'];
      setAllowedViews(Array.from(new Set([...allowedViews, ...fulIds])));
    } else if (presetName === 'asset') {
      const assetIds = ['dashboard', 'inventory', 'tracing', 'identification', 'label', 'task-todo'];
      setAllowedViews(Array.from(new Set([...allowedViews, ...assetIds])));
    }
  };

  return (
    <div className="p-8 w-full space-y-8 flex flex-col bg-slate-50 min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Super Admin: User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage users, reset MFA/passwords, and configure granular access permissions including SD-WAN Assurance.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/80 rounded-xl w-fit">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'users'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>Pengguna & Hak Akses</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'sessions'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>Realtime Monitoring Sesi</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
            {sessions.filter(s => s.status !== 'TERMINATED').length} Aktif
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeAdminTab === 'logs'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Log Akses & Keamanan</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
            {logs.length}
          </span>
        </button>
      </div>

      {activeAdminTab === 'users' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Position</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Allowed Permissions</th>
              <th className="px-6 py-4">MFA Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No users found.</td>
              </tr>
            ) : users.map(user => {
              const isSuper = user.role === 'Super Admin';
              const userViews: string[] = user.allowedViews || [];
              const hasAssurance = userViews.includes('assurance') || isSuper;

              return (
                <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{user.name || 'Unnamed User'}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {user.position ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {user.position}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isSuper ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role || 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isSuper ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Full System Access (All Views)
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {userViews.length} of {ALL_VIEW_PERMISSIONS.length} views
                        </span>
                        {hasAssurance && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> SD-WAN Assurance
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.mfaEnabled ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Enabled
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">Not Configured</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => openAccessModal(user)} 
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition tooltip" 
                        title="Configure Access Permissions (SD-WAN Assurance, Menus, Roles)"
                      >
                        <Settings2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleResetPassword(user.email)} className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition tooltip" title="Reset Password">
                        <Key className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleResetMFA(user.uid, user.email)} className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition tooltip" title="Reset MFA">
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button onClick={() => setDeprovisionTargetUser(user)} className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition tooltip cursor-pointer" title="De-provision & Hapus Pengguna (Auth + /users)">
                        <Trash2 className="w-5 h-5 text-rose-500 hover:text-rose-700" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MappingUpload />
        </div>
      )}

      {/* Tab 2: Realtime Active Sessions Monitoring */}
      {activeAdminTab === 'sessions' && (
        <RealtimeSessionsView
          sessions={sessions}
          loading={sessionsLoading}
          onForceTerminate={handleForceTerminate}
          onRefresh={() => {}}
        />
      )}

      {/* Tab 3: Access Audit Logs */}
      {activeAdminTab === 'logs' && (
        <AccessAuditLogsView
          logs={logs}
          loading={logsLoading}
          onRefresh={() => {}}
        />
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" /> Add New User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Vendor PM">Vendor PM</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position / Job Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Network Engineer, Field PM, SD-WAN Specialist"
                  value={newPosition} 
                  onChange={e => setNewPosition(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={creating} className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-sm">
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccessModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 relative flex flex-col max-h-[92vh] border border-slate-100">
            <button onClick={() => setShowAccessModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
              <X className="w-5 h-5" />
            </button>
            
            {/* Header */}
            <div className="border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Access Control & Permissions: {selectedUser.name || 'User'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono text-slate-600">{selectedUser.email}</span>
                    <span>•</span>
                    <span>Current Role: <strong className="text-slate-700">{selectedUser.role || 'Admin'}</strong></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {/* Role & Position Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Assign System Role</label>
                  <select 
                    value={accessRole} 
                    onChange={e => setAccessRole(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm font-medium"
                  >
                    <option value="Super Admin">Super Admin (Unrestricted System Access)</option>
                    <option value="Admin">Admin (Role-Based Menu Permissions)</option>
                    <option value="Vendor PM">Vendor PM (Vendor BA Portal Access)</option>
                    <option value="Viewer">Viewer (Read-Only Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Job Position / Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SD-WAN Operations, Network Engineer, Field PM"
                    value={accessPosition} 
                    onChange={e => setAccessPosition(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm" 
                  />
                </div>
              </div>

              {/* Views & Permissions Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-sm font-bold text-slate-800">
                      Allowed Views & Operational Menus
                    </label>
                    <p className="text-xs text-slate-500">
                      Configure which features appear in the user's sidebar. Selected: <strong className="text-indigo-600">{allowedViews.length}</strong> of {ALL_VIEW_PERMISSIONS.length} views
                    </p>
                  </div>

                  {/* Quick Action Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('ops')}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3 h-3 text-indigo-600" /> +Ops & Assurance
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('fulfillment')}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
                    >
                      +Fulfillment
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Filter Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search menus (e.g. Assurance, Monitoring, Label, PM, Inventory)..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>

                {/* Notice for Super Admin role */}
                {accessRole === 'Super Admin' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Users assigned the <strong>Super Admin</strong> role automatically bypass view restrictions and can access all system menus. Checkboxes below serve as baseline defaults.</span>
                  </div>
                )}

                {/* Grouped Category Cards */}
                <div className="space-y-4">
                  {categories.map(category => {
                    const CategoryIcon = CATEGORY_ICONS[category] || Activity;
                    const items = ALL_VIEW_PERMISSIONS
                      .filter(p => p.category === category)
                      .filter(p => {
                        if (!searchFilter.trim()) return true;
                        const term = searchFilter.toLowerCase();
                        return p.label.toLowerCase().includes(term) || 
                               p.id.toLowerCase().includes(term) || 
                               p.description.toLowerCase().includes(term);
                      });

                    if (items.length === 0) return null;

                    const allSelectedInCategory = items.every(item => allowedViews.includes(item.id));
                    const someSelectedInCategory = items.some(item => allowedViews.includes(item.id));

                    return (
                      <div key={category} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        {/* Category Header */}
                        <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
                            <CategoryIcon className="w-4 h-4 text-indigo-600" />
                            <span>{category}</span>
                            <span className="text-[10px] lowercase text-slate-400 font-normal">
                              ({items.filter(i => allowedViews.includes(i.id)).length}/{items.length} selected)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(category)}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition hover:underline"
                          >
                            {allSelectedInCategory ? 'Deselect Category' : 'Select All in Category'}
                          </button>
                        </div>

                        {/* Category Items */}
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {items.map(item => {
                            const isChecked = allowedViews.includes(item.id);
                            const isAssuranceItem = item.id === 'assurance';

                            return (
                              <label
                                key={item.id}
                                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                                  isChecked 
                                    ? isAssuranceItem 
                                      ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200' 
                                      : 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleView(item.id)}
                                  className={`mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 ${
                                    isAssuranceItem ? 'accent-emerald-600 text-emerald-600' : ''
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-800">
                                      {item.label}
                                    </span>
                                    {item.badge && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        {item.badge}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({item.id})
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                    {item.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Changes apply immediately on next user navigation or session refresh.</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAccessModal(false)} 
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveAccessOptions} 
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* De-provisioning Modal: Deletes both /users record and Firebase Auth account */}
      <DeProvisionModal
        user={deprovisionTargetUser}
        isOpen={!!deprovisionTargetUser}
        onClose={() => setDeprovisionTargetUser(null)}
        onSuccess={(result) => {
          setToastMsg(result.message);
          setTimeout(() => setToastMsg(null), 5000);
        }}
      />
    </div>
  );
}
