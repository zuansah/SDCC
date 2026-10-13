import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { BAData } from './types';
import Sidebar from './components/Sidebar';
import ProjectManagementDashboard from './components/ProjectManagementDashboard';
import ProjectList from './components/ProjectList';
import InventoryDashboard from './components/InventoryDashboard';
import ControllerView from "./components/ControllerView";
import TicketView from "./components/TicketView";
import MonitoringView from './components/MonitoringView';
import MainDashboard from './components/MainDashboard';
import BAForm from './components/BAForm';
import BAPreview from './components/BAPreview';
import Login from './components/Login';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import VendorBADashboard from './components/VendorBADashboard';
import OrderStatusView from './components/OrderStatusView';
import AssuranceView from './components/AssuranceView';
import LabelTraceView from './components/LabelTraceView';
import TaskTodoView from './components/TaskTodoView';
import DevToolsBlockedBanner from './components/DevToolsBlockedBanner';
import GeoRestrictionBlocked from './components/GeoRestrictionBlocked';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { 
  detectClientGeoLocation, 
  resetCachedGeo, 
  logAccessEvent, 
  updateUserSessionHeartbeat, 
  endUserSession, 
  GeoLocationInfo 
} from './services/accessLogger';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, setDoc, doc, deleteDoc, query, orderBy, getDocs, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { initCompleteClipboardLockdown, initDevToolsWatcher, sanitizeBrowserUrl } from './utils/security';

export type ViewState = 
  | 'dashboard' | 'new-ba' | 'edit-ba' | 'preview-ba' 
  | 'projects' | 'project_management' | 'orders' | 'tracking'
  | 'monitoring' | 'ticket' | 'assurance' | 'controller' | 'license'
  | 'inventory' | 'tracing' | 'identification' | 'label' | 'task-todo' | 'mass-testing-uat' | 'open-sdwan' | 'automation' | 'api' | 'super_admin' | 'vendor_bas';


const IMAGE_FIELDS = [
  'networkTopologyImg',
  'mapCoordinateImg',
  'equipmentPlacementImg',
  'floorLayoutImg',
  'frontViewImg',
  'withPicImg',
  'rackBeforeImg',
  'rackAfterImg',
  'snSdwanImg',
  'snOntImg',
  'modemMainImg',
  'modemBackupImg',
  'speedtestGlobalImg',
  'speedtestDomestikImg',
  'cablingSdwanImg',
  'sdwanBoxImg',
  'pingTracerouteImg',
  'pingAstinetImg'
];


interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500 bg-white">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm max-w-lg text-center mb-4">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [bas, setBas] = useState<BAData[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [activeBA, setActiveBA] = useState<BAData | null>(null);
  const [isTechnician, setIsTechnician] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mfaVerified, setMfaVerified] = useState(sessionStorage.getItem('mfa_verified') === 'true');

  // Cyber Security & Access Management States
  const [showDevToolsBanner, setShowDevToolsBanner] = useState(false);
  const [geoInfo, setGeoInfo] = useState<GeoLocationInfo | null>(null);
  const [geoRestricted, setGeoRestricted] = useState(false);

  // 1. Inspect element & devtools lockdown with audit logging
  useEffect(() => {
    const unbindLockdown = initCompleteClipboardLockdown((action) => {
      if (action.includes('Inspect') || action.includes('F12') || action.includes('DevTools')) {
        setShowDevToolsBanner(true);
        logAccessEvent({
          action: 'DEVTOOLS_BLOCKED',
          details: `Inspect or devtools attempt blocked: ${action}`,
          userEmail: user?.email || 'unauthenticated',
          role: userData?.role || 'Guest',
          userId: user?.uid,
        });
      }
    });

    const unbindDevTools = initDevToolsWatcher((isOpen) => {
      if (isOpen) {
        setShowDevToolsBanner(true);
        logAccessEvent({
          action: 'DEVTOOLS_BLOCKED',
          details: 'Developer Tools inspection window opened/docked',
          userEmail: user?.email || 'unauthenticated',
          role: userData?.role || 'Guest',
          userId: user?.uid,
        });
      }
    });

    return () => {
      unbindLockdown();
      unbindDevTools();
    };
  }, [user, userData]);

  // 2. Geolocation Restriction: Indonesia region only
  const checkGeo = useCallback(async () => {
    try {
      const geo = await detectClientGeoLocation();
      setGeoInfo(geo);
      if (!geo.isIndonesia) {
        setGeoRestricted(true);
        logAccessEvent({
          action: 'GEO_BLOCKED',
          details: `Access restricted from outside Indonesia: ${geo.countryName} (${geo.countryCode}), IP: ${geo.ip}`,
          userEmail: user?.email || 'unauthenticated',
          role: userData?.role || 'Guest',
          userId: user?.uid,
        });
      } else {
        setGeoRestricted(false);
      }
    } catch (err) {
      console.warn("Geo check error:", err);
      setGeoRestricted(false);
    }
  }, [user, userData]);

  useEffect(() => {
    checkGeo();
  }, [checkGeo]);

  const handleAdminBypass = () => {
    try {
      sessionStorage.setItem('telkom_geo_bypass', 'true');
    } catch (_) {}
    resetCachedGeo();
    setGeoRestricted(false);
  };

  // 3. Session Limit & Inactivity Timeout (20 min limit, 90 sec warning)
  const handleSessionTimeout = useCallback(async () => {
    if (user) {
      await logAccessEvent({
        action: 'SESSION_TIMEOUT',
        details: 'User session automatically ended due to 20 minutes inactivity timeout',
        userEmail: user.email || '',
        role: userData?.role || 'User',
        userId: user.uid,
      });
      await endUserSession(user.uid);
    }
    sessionStorage.clear();
    setMfaVerified(false);
    await signOut(auth);
  }, [user, userData]);

  const handleSessionActivity = useCallback(() => {
    if (user && mfaVerified) {
      updateUserSessionHeartbeat({
        uid: user.uid,
        email: user.email || '',
        name: userData?.name || user.displayName || user.email?.split('@')[0],
        role: userData?.role || 'User',
        currentView: view,
        status: 'ONLINE',
      });
    }
  }, [user, userData, view, mfaVerified]);

  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout({
    enabled: !!user && mfaVerified && !isTechnician,
    timeoutMinutes: 20,
    warningSeconds: 90,
    onTimeout: handleSessionTimeout,
    onActivity: handleSessionActivity,
  });

  // 4. Remote Session Termination Listener (Super Admin force disconnect)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'user_sessions', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data?.status === 'TERMINATED') {
          logAccessEvent({
            action: 'FORCE_TERMINATED',
            details: 'Active session was terminated remotely by Super Admin',
            userEmail: user.email || '',
            role: userData?.role || 'User',
            userId: user.uid,
          });
          sessionStorage.clear();
          setMfaVerified(false);
          signOut(auth);
        }
      }
    });
    return () => unsub();
  }, [user, userData]);

  // 5. Realtime presence heartbeat & view tracking for Super Admin monitoring
  useEffect(() => {
    if (!user || !mfaVerified) return;
    updateUserSessionHeartbeat({
      uid: user.uid,
      email: user.email || '',
      name: userData?.name || user.displayName || user.email?.split('@')[0],
      role: userData?.role || 'User',
      currentView: view,
      status: 'ONLINE',
    });
    const interval = setInterval(() => {
      updateUserSessionHeartbeat({
        uid: user.uid,
        email: user.email || '',
        name: userData?.name || user.displayName || user.email?.split('@')[0],
        role: userData?.role || 'User',
        currentView: view,
        status: 'ONLINE',
      });
    }, 45000);
    return () => clearInterval(interval);
  }, [user, mfaVerified, view, userData]);

  // 6. BeforeUnload cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.uid) {
        endUserSession(user.uid);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  // Cyber Security & UI Hygiene: Clean dangling URL query parameters (e.g., ?tenant=...)
  useEffect(() => {
    if (view !== 'inventory' && !isTechnician) {
      sanitizeBrowserUrl();
    }
  }, [view, isTechnician]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setMfaVerified(false);
        sessionStorage.removeItem('mfa_verified');
        setUserData(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchUser = async () => {
        try {
          const document = await getDoc(doc(db, 'users', user.uid));
          setDbError(null);
          if (document.exists()) {
            const data = document.data();
            if ((user.email === 'zuansah.munggaran@gmail.com' || user.email === 'zuansah.munggaran@telkom.co.id') && data.role !== 'Super Admin') {
              const upgraded = { ...data, role: 'Super Admin' };
              await setDoc(doc(db, 'users', user.uid), upgraded, { merge: true });
              setUserData(upgraded);
            } else {
              setUserData(data);
            }
          } else {
            // Auto-initialize first user as Super Admin
            const newAdmin = {
              email: user.email,
              name: user.displayName || user.email?.split('@')[0],
              role: (user.email === 'zuansah.munggaran@gmail.com' || user.email === 'zuansah.munggaran@telkom.co.id') ? 'Super Admin' : 'Admin',
              mfaEnabled: false,
              mfaSecret: '',
              allowedViews: ['dashboard', 'projects', 'project_management', 'assurance', 'monitoring', 'ticket', 'task-todo']
            };
            await setDoc(doc(db, 'users', user.uid), newAdmin);
            setUserData(newAdmin);
          }
        } catch (error: any) {
          console.warn("Firestore user read error:", error);
          if (error.code === 'resource-exhausted' || error.code === 'unavailable' || error.message?.includes('Quota limit exceeded') || error.message?.includes('offline')) {
            setDbError("Database access restricted. You have reached the daily free tier read limit. Please try again tomorrow.");
            if (user.email === 'zuansah.munggaran@gmail.com' || user.email === 'zuansah.munggaran@telkom.co.id') {
              setUserData({
                email: user.email,
                name: user.displayName || user.email?.split('@')[0],
                role: 'Super Admin',
                mfaEnabled: false,
                allowedViews: ['dashboard', 'projects', 'project_management', 'assurance', 'monitoring', 'ticket', 'task-todo']
              });
            }
          } else {
            setDbError(error.message || "Failed to connect to database.");
          }
        }
      };
      fetchUser();
    }
  }, [user]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('role') === 'technician') {
      setIsTechnician(true);
    }
  }, []);

  const fetchBas = async () => {
    if (!user) return;
    setDbLoading(true);
    try {
      const q = query(collection(db, 'bas'));
      const snapshot = await getDocs(q);
      setDbError(null);
      const fetchedBas = snapshot.docs.map(doc => doc.data() as BAData);
      fetchedBas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBas(fetchedBas);
    } catch (error: any) {
      console.warn("Firestore read error:", error);
      if (error.code === 'resource-exhausted' || error.code === 'unavailable' || error.message?.includes('Quota limit exceeded') || error.message?.includes('offline')) {
        setDbError("Database access restricted. You have reached the daily free tier read limit. Please try again tomorrow.");
      } else {
        setDbError(error.message || "Failed to connect to database.");
      }
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    const viewsNeedingData: ViewState[] = ['projects', 'project_management', 'vendor_bas', 'dashboard'];
    if (viewsNeedingData.includes(view)) {
      if (bas.length === 0 && user && !dbLoading) {
        fetchBas();
      }
    }
  }, [view, user]);

  const handleSaveBA = async (data: BAData) => {
    try {
      if (!data.userId && user) {
        data.userId = user.uid;
      }
      
      // Separate main data and images
      const mainData = { ...data };
      const imagesToSave: Record<string, string> = {};
      
      IMAGE_FIELDS.forEach(field => {
        if (mainData[field as keyof BAData]) {
          imagesToSave[field] = mainData[field as keyof BAData] as string;
          delete mainData[field as keyof BAData];
        }
      });
      
      // Save main document (without images)
      const docRef = doc(db, 'bas', data.id);
      await setDoc(docRef, mainData);
      
      // Save each image in a subcollection document to bypass 1MB limit
      for (const [field, base64] of Object.entries(imagesToSave)) {
        // Only save if it's a data URL or real string
        if (base64) {
          const imgDocRef = doc(db, 'bas', data.id, 'images', field);
          await setDoc(imgDocRef, { data: base64 });
        }
      }
      
      setActiveBA(data); // Provide full data (with images) to preview
      setView('preview-ba');
    } catch (e: any) {
      console.error("Failed to save to Firestore:", e);
      throw new Error("Failed to save document. " + e.message);
    }
  };

  const handleDeleteManyBAs = async (ids: string[]) => {
    try {
      // Need to delete docs sequentially or in batches
      for (const id of ids) {
        await deleteDoc(doc(db, 'bas', id));
      }
      if (activeBA && ids.includes(activeBA.id)) {
        setActiveBA(null);
        setView('projects');
      }
      // Re-fetch after batch delete
      fetchBas();
    } catch (e: any) {
      console.error("Failed to delete multiple from Firestore:", e);
      alert("Failed to delete some documents. " + e.message);
    }
  };

  const handleDeleteBA = async (id: string) => {
    if (confirm('Are you sure you want to delete this BA?')) {
      try {
        await deleteDoc(doc(db, 'bas', id));
        if (activeBA?.id === id) {
          setActiveBA(null);
          setView('projects');
        }
      } catch (e: any) {
        console.error("Failed to delete from Firestore:", e);
        alert("Failed to delete document. " + e.message);
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'accepted' | 'rejected', rejectNote?: string) => {
    const existing = bas.find(b => b.id === id);
    if (existing) {
      try {
        const approverName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Admin';
        const updates: any = { status: newStatus };
        if (newStatus === 'accepted') {
          updates.acceptedBy = approverName;
        } else if (newStatus === 'rejected' && rejectNote) {
          updates.rejectNote = rejectNote;
        }
        await setDoc(doc(db, 'bas', id), { ...existing, ...updates });
      } catch (e: any) {
         console.error("Failed to update status:", e);
         alert("Failed to update status. " + e.message);
      }
    }
  };

  const handleCreateNew = () => {
    setActiveBA(null);
    setView('new-ba');
  };


  const fetchImagesForBA = async (ba: BAData) => {
    try {
      const imagesRef = collection(db, 'bas', ba.id, 'images');
      const snapshot = await getDocs(imagesRef);
      const images: any = {};
      snapshot.forEach(doc => {
        images[doc.id] = doc.data().data;
      });
      return { ...ba, ...images };
    } catch (e) {
      console.error("Failed to fetch images", e);
      return ba;
    }
  };

  const handleEdit = async (ba: BAData) => {
    const fullBa = await fetchImagesForBA(ba);
    setActiveBA(fullBa);
    setView('edit-ba');
  };

  const handlePreview = async (ba: BAData) => {
    const fullBa = await fetchImagesForBA(ba);
    setActiveBA(fullBa);
    setView('preview-ba');
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Require login unless it is the technician public link
  if ((!user || !mfaVerified) && !isTechnician) {
    return (
      <>
        <DevToolsBlockedBanner isOpen={showDevToolsBanner} onDismiss={() => setShowDevToolsBanner(false)} />
        <Login onMfaVerified={() => {
          sessionStorage.setItem('mfa_verified', 'true');
          setMfaVerified(true);
          if (auth.currentUser) {
            logAccessEvent({
              action: 'LOGIN',
              details: 'User authenticated via password + MFA TOTP verification',
              userEmail: auth.currentUser.email || '',
              role: userData?.role || 'User',
              userId: auth.currentUser.uid,
            });
            updateUserSessionHeartbeat({
              uid: auth.currentUser.uid,
              email: auth.currentUser.email || '',
              name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0],
              role: userData?.role || 'User',
              currentView: 'dashboard',
              status: 'ONLINE',
            });
          }
        }} />
      </>
    );
  }

  // Geolocation Restriction - Restricted strictly to Indonesia
  if (geoRestricted && !isTechnician) {
    return (
      <>
        <DevToolsBlockedBanner isOpen={showDevToolsBanner} onDismiss={() => setShowDevToolsBanner(false)} />
        <GeoRestrictionBlocked
          geoInfo={geoInfo}
          onRetry={checkGeo}
          onAdminBypass={handleAdminBypass}
          currentUserEmail={user?.email || undefined}
          isSuperAdmin={userData?.role === 'Super Admin'}
        />
      </>
    );
  }

  if (isTechnician) {
    if (submitted) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 font-sans">
          <div className="bg-white p-10 rounded-xl shadow-sm text-center max-w-md border border-slate-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Evidence Submitted</h2>
            <p className="text-slate-500">Thank you. Your Serah Terima Project evidence has been successfully submitted and saved.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto font-sans text-slate-900">
        <BAForm 
          initialData={null} 
          onSave={async (data) => {
            try {
              if (!data.userId && user) {
                data.userId = user.uid;
              }
              
              // Separate main data and images
              const mainData = { ...data };
              const imagesToSave: Record<string, string> = {};
              
              IMAGE_FIELDS.forEach(field => {
                if (mainData[field as keyof BAData]) {
                  imagesToSave[field] = mainData[field as keyof BAData] as string;
                  delete mainData[field as keyof BAData];
                }
              });
              
              // Save main document (without images)
              const docRef = doc(db, 'bas', data.id);
              await setDoc(docRef, mainData);
              
              // Save each image in a subcollection document to bypass 1MB limit
              for (const [field, base64] of Object.entries(imagesToSave)) {
                if (base64) {
                  const imgDocRef = doc(db, 'bas', data.id, 'images', field);
                  await setDoc(imgDocRef, { data: base64 });
                }
              }
              
              setSubmitted(true);
            } catch (e: any) {
              console.error("Failed to save to Firestore:", e);
              throw new Error("Failed to save document. " + e.message);
            }
          }} 
          onCancel={() => {}} 
          isTechnician={true}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 select-none">
      <DevToolsBlockedBanner isOpen={showDevToolsBanner} onDismiss={() => setShowDevToolsBanner(false)} />
      <SessionTimeoutModal 
        isOpen={showWarning} 
        remainingSeconds={remainingSeconds} 
        onExtendSession={extendSession} 
        onLogout={handleSessionTimeout} 
      />
      <Sidebar view={view} setView={setView} onCreateNew={handleCreateNew} userData={userData} />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <ErrorBoundary>
        {dbError && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-semibold text-sm">Database Error</p>
                <p className="text-sm mt-0.5">{dbError}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto relative">
          {view === 'super_admin' && <SuperAdminDashboard />}
        {view === 'dashboard' && <MainDashboard onNavigate={(v) => setView(v)} />}
        
        {view === 'vendor_bas' && (
          <VendorBADashboard
            bas={bas}
            onRefresh={fetchBas}
            loading={dbLoading}
            onPreview={handlePreview}
          />
        )}
        
        {view === 'project_management' && (
          <ProjectManagementDashboard 
            userData={userData}
            bas={bas} 
            onEdit={handleEdit} 
            onPreview={handlePreview}
            onDelete={handleDeleteBA}
            onDeleteMany={handleDeleteManyBAs}
            onCreateNew={handleCreateNew}
            onStatusChange={handleStatusChange}
            onRefresh={fetchBas}
            loading={dbLoading}
          />
        )}
        
        {view === 'projects' && (
          <ProjectList 
            bas={bas} 
          />
        )}
        
        {(view === 'new-ba' || view === 'edit-ba') && (
          <BAForm 
            key={activeBA?.id || 'new'}
            initialData={activeBA} 
            onSave={handleSaveBA} 
            onCancel={() => setView('projects')} 
          />
        )}
        
        {view === 'preview-ba' && activeBA && (
          <BAPreview 
            ba={activeBA} 
            onBack={() => setView('projects')}
            onEdit={() => handleEdit(activeBA)}
          />
        )}

        {view === 'orders' && <OrderStatusView />}

        {view === 'tracking' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Tracking Asset</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'monitoring' && (
          <MonitoringView />
        )}
        {view === 'controller' && (
          <ControllerView />
        )}

        {view === 'ticket' && (
          <TicketView />
        )}

        {view === 'assurance' && (
          <AssuranceView />
        )}


        {view === 'license' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">License</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'inventory' && (
          <InventoryDashboard />
        )}
        
        {view === 'tracing' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Tracing</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'identification' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Identification</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'label' && (
          <LabelTraceView user={user} />
        )}

        {view === 'task-todo' && (
          <TaskTodoView user={user} userData={userData} setView={setView} />
        )}

        {view === 'mass-testing-uat' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Mass Testing UAT</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'open-sdwan' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Open SDWAN</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'automation' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Automation</h2>
            <p>This module is under construction.</p>
          </div>
        )}

        {view === 'api' && (
          <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">API</h2>
            <p>This module is under construction.</p>
          </div>
        )}
        </div>
      </ErrorBoundary>
      </main>
    </div>
  );
}
