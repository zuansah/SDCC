import React, { useState } from 'react';
import { ViewState } from '../App';
import { 
  LayoutDashboard, FileText, Settings, LogOut, Shield,
  List, Package, ShoppingCart, ChevronDown, ChevronRight, 
  MapPin, Activity, Ticket, ShieldCheck, Cpu, Key, Layers, CheckCircle, Tag, CheckSquare,
  Home, Wrench, Radio, Search, Truck, Briefcase, Database, Monitor, FlaskConical, Network, Webhook, Cog,
  Sparkles, Brain
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { logAccessEvent, endUserSession } from '../services/accessLogger';
import { CiciAvatar } from '../cici/components/CiciAvatar';

interface SidebarProps {
  view: ViewState;
  setView: (view: ViewState) => void;
  onCreateNew: () => void;
  userData?: any;
}

export default function Sidebar({ view, setView, onCreateNew, userData }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    fulfillment: false,
    operation: false,
    asset: false,
    lab: false,
  });

  const isAllowed = (viewId: string) => {
    if (!userData) return true;
    if (userData.role === 'Super Admin') return true;
    if (viewId === 'label' || viewId === 'task-todo' || viewId === 'intelligence' || viewId === 'cici') return true;
    return userData.allowedViews?.includes(viewId);
  };

    const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleLogout = async () => {
    try {
      if (auth.currentUser) {
        await logAccessEvent({
          action: 'LOGOUT',
          details: 'User logged out via sidebar menu',
          userEmail: auth.currentUser.email || '',
          role: userData?.role || 'User',
          userId: auth.currentUser.uid,
        });
        await endUserSession(auth.currentUser.uid);
      }
      sessionStorage.clear();
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0 z-10">
      <div className="p-4 border-b border-slate-100 flex flex-col items-center gap-2">
        <img 
          src="/NSM%204K%20Resolution%20Logo.jpeg" 
          alt="NSM Logo" 
          className="w-full h-auto object-contain mix-blend-multiply scale-105"
          onError={(e) => {
            // Hide the image if it hasn't been placed in the public folder yet
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="flex flex-col items-center w-full text-center mt-1">
          <span className="font-bold text-xl tracking-tight text-slate-800 leading-tight">Command Center</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {isAllowed('dashboard') && <button
          onClick={() => setView('dashboard')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            view === 'dashboard' 
              ? "bg-blue-50 text-blue-700" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          Overview
        </button>}

        {/* Top-Level Cici Agent Entry */}
        {isAllowed('cici') && (
          <button
            onClick={() => setView('cici')}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              view === 'cici'
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-3">
              <CiciAvatar size="xs" />
              <span className="font-semibold">Cici</span>
            </div>
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              view === 'cici' ? "text-slate-300" : "text-slate-400"
            )}>
              Agent
            </span>
          </button>
        )}
        
        {/* Fulfillment Dropdown */}
        {['projects', 'project_management', 'orders', 'tracking'].some(id => isAllowed(id)) && (
        <div>
          <button
            onClick={() => toggleMenu('fulfillment')}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5" />
              Fulfillment
            </div>
            {openMenus.fulfillment ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {openMenus.fulfillment && (
            <div className="ml-9 mt-1 space-y-1">
              {[
                { id: 'projects', label: 'Project List', icon: List },
                { id: 'project_management', label: 'PM', icon: Briefcase },
                { id: 'orders', label: 'Order Status', icon: ShoppingCart },
                { id: 'tracking', label: 'Tracking Asset', icon: MapPin },
              ].filter(item => isAllowed(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    view === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Operation Dropdown */}
        {['monitoring', 'ticket', 'assurance', 'controller', 'license', 'intelligence'].some(id => isAllowed(id)) && (
        <div>
          <button
            onClick={() => toggleMenu('operation')}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              Operation
            </div>
            {openMenus.operation ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {openMenus.operation && (
            <div className="ml-9 mt-1 space-y-1">
              {[
                { id: 'monitoring', label: 'Monitoring', icon: Monitor },
                { id: 'ticket', label: 'Ticket', icon: Ticket },
                { id: 'assurance', label: 'SD-WAN Assurance', icon: ShieldCheck },
                { id: 'controller', label: 'Controller', icon: Cpu },
                { id: 'license', label: 'License', icon: Key },
                { id: 'intelligence', label: 'Intelligence', icon: Brain },
              ].filter(item => isAllowed(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    view === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Asset Management Dropdown */}
        {['inventory', 'tracing', 'identification', 'label'].some(id => isAllowed(id)) && (
        <div>
          <button
            onClick={() => toggleMenu('asset')}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5" />
              Asset Management
            </div>
            {openMenus.asset ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {openMenus.asset && (
            <div className="ml-9 mt-1 space-y-1">
              {[
                { id: 'inventory', label: 'Inventory', icon: Layers },
                { id: 'tracing', label: 'Tracing', icon: Search },
                { id: 'identification', label: 'Identification', icon: CheckCircle },
                { id: 'label', label: 'Label', icon: Tag },
              ].filter(item => isAllowed(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    view === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Lab Dropdown */}
        {['mass-testing-uat', 'open-sdwan', 'automation', 'api'].some(id => isAllowed(id)) && (
        <div>
          <button
            onClick={() => toggleMenu('lab')}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5" />
              Lab
            </div>
            {openMenus.lab ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {openMenus.lab && (
            <div className="ml-9 mt-1 space-y-1">
              {[
                { id: 'mass-testing-uat', label: 'Mass Testing UAT', icon: CheckCircle },
                { id: 'open-sdwan', label: 'Open SDWAN', icon: Network },
                { id: 'automation', label: 'Automation', icon: Cog },
                { id: 'api', label: 'API', icon: Webhook },
              ].filter(item => isAllowed(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    view === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Task to do - Main Option Under Lab */}
        {isAllowed('task-todo') && (
          <button
            onClick={() => setView('task-todo')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              view === 'task-todo' 
                ? "bg-blue-50 text-blue-700 font-semibold" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <CheckSquare className="w-5 h-5" />
            Task to do
          </button>
        )}

        {userData?.role === 'Vendor PM' && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => setView('vendor_bas')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                view === 'vendor_bas' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <FileText className="w-4 h-4" />
              Vendor Dashboard
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-1 mt-auto">
        {userData?.role === 'Super Admin' && (
          <button 
            onClick={() => setView('super_admin')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer",
              view === 'super_admin' 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 shrink-0" />
              <span>User Access Mgmt</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>
        )}
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
          <Settings className="w-5 h-5" />
          Settings
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
