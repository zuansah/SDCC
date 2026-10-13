import React, { useState, useEffect, useMemo } from 'react';
import { useControllerData } from '../hooks/useControllerData';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { AlertCircle, Clock, Plus, Ticket as TicketIcon, Search, Loader2, CheckCircle2, Server, Activity, Database, CloudOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TileKey = 'total' | 'up' | 'down' | 'critical' | 'license';

interface Device {
  name?: string; serial?: string; site?: string; model?: string; version?: string;
  id: string; ip?: string; up?: boolean;
  state?: string; status?: string; tenant?: string;
  critical?: boolean; why?: string[];
  downFor?: string; downHours?: number; downSince?: string;
  before?: string; lastContact?: string;
  tunUp?: number; tunTotal?: number; tunDown?: number;
  loss?: number; latency?: number; jitter?: number; score?: number;
  configSynced?: boolean;
  _controller?: Controller;
}

interface Tenant {
  name: string;
  devices: number;
}

interface Controller {
  key: string; label: string; ownership: string; host: string;
  kind: string; platform: string; status: string; reason?: string;
  lastPoll: string;
  tiles: Record<TileKey, number>;
  license: any;
  tenants: Tenant[];
  tenantsLoadedAt?: string;
  devices: Device[];
}

interface Meta {
  generatedAt: string; source: string;
  totals: Record<string, number>;
  byOwnership: Record<string, Record<string, number>>;
  thresholds: any;
}

interface DataPayload {
  meta: Meta;
  controllers: Controller[];
}

interface AssuranceTicket {
  id: string;
  tenant: string;
  sid_sdwan: string;
  contact_person: string;
  status: string;
  createdAt: any;
  edgeInfo?: any;
}

export default function TicketView() {
  const { data, loading, error } = useControllerData();

  const [assuranceTickets, setAssuranceTickets] = useState<AssuranceTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTenant, setFormTenant] = useState('');
  const [formSid, setFormSid] = useState('');
  const [formContact, setFormContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [activeTab, setActiveTab] = useState<'proactive' | 'down24h' | 'assurance'>('proactive');

  

  useEffect(() => {
    const q = query(collection(db, 'assurance_tickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AssuranceTicket[];
      setAssuranceTickets(t);
      setTicketsLoading(false);
    }, (err) => {
      console.error("Failed to fetch tickets:", err);
      setTicketsError(err.message);
      setTicketsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const allDevices = useMemo(() => {
    if (!data) return [];
    return data.controllers.flatMap(c => 
      (c.devices || []).map(d => ({ ...d, _controller: c }))
    );
  }, [data]);

  const proactiveTickets = useMemo(() => {
    return allDevices.filter(d => {
      if (!d.critical) return false;
      
      // Exclude Forti Cloud from IBL Procurement
      const isFortiCloudIBL = d._controller?.ownership === 'IBL Procurement' && 
        (d._controller?.platform?.toLowerCase().includes('forti') || 
         d._controller?.kind?.toLowerCase().includes('forti') || 
         d._controller?.label?.toLowerCase().includes('forti'));
         
      if (isFortiCloudIBL) return false;
      
      return true;
    });
  }, [allDevices]);

  const down24hTickets = useMemo(() => {
    return allDevices.filter(d => {
      if (d.up) return false; // auto close if active
      
      // Exclude Forti Cloud from IBL Procurement
      const isFortiCloudIBL = d._controller?.ownership === 'IBL Procurement' && 
        (d._controller?.platform?.toLowerCase().includes('forti') || 
         d._controller?.kind?.toLowerCase().includes('forti') || 
         d._controller?.label?.toLowerCase().includes('forti'));
         
      if (isFortiCloudIBL) return false;
      
      return d.downHours !== undefined && d.downHours >= 24;
    }).sort((a, b) => (b.downHours || 0) - (a.downHours || 0));
  }, [allDevices]);

  const matchedEdge = useMemo(() => {
    if (!formSid || formSid.trim().length < 3) return null;
    const searchTerm = formSid.toLowerCase().trim();
    return allDevices.find(d => 
      (d.name && d.name.toLowerCase().includes(searchTerm)) || 
      (d.id && d.id.toLowerCase().includes(searchTerm)) ||
      (d.site && d.site.toLowerCase().includes(searchTerm))
    );
  }, [formSid, allDevices]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTenant || !formSid || !formContact) {
      setFormError('All fields are required');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      // Try to find edge identity info using SID SDWAN
      const searchTerm = formSid.toLowerCase();
      const edge = matchedEdge;

      const edgeInfo = edge ? {
        name: edge.name || null,
        ip: edge.ip || null,
        site: edge.site || null,
        model: edge.model || null,
        controller: edge._controller?.label || null,
        status: edge.status || null
      } : null;

      await addDoc(collection(db, 'assurance_tickets'), {
        tenant: formTenant,
        sid_sdwan: formSid,
        contact_person: formContact,
        status: 'Open',
        createdAt: serverTimestamp(),
        edgeInfo
      });

      setShowForm(false);
      setFormTenant('');
      setFormSid('');
      setFormContact('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tickets & Assurance</h1>
          <p className="text-sm text-slate-500 mt-1">Manage proactive edge alerts, down devices, and manual assurance tickets.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Open Assurance Ticket
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 shrink-0">
        <div className="flex space-x-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('proactive')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'proactive' 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <AlertCircle className="w-4 h-4" />
            Proactive Tickets
            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{proactiveTickets.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('down24h')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'down24h' 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Clock className="w-4 h-4" />
            Down {'>'} 24h
            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{down24hTickets.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('assurance')}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'assurance' 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <TicketIcon className="w-4 h-4" />
            Assurance
            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{assuranceTickets.length}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'proactive' && (
          <div className="space-y-4">
            {proactiveTickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="font-medium text-slate-700">No Critical Edges</p>
                <p className="text-sm mt-1">There are no edges currently in Critical condition.</p>
              </div>
            ) : (
              proactiveTickets.map(device => (
                <div key={device.id} className="bg-white border border-red-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 truncate">{device.name || device.id}</h3>
                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                          <Server className="w-3.5 h-3.5" />
                          {device._controller?.label}
                          {device.tenant && (
                            <>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              {device.tenant}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                        Critical
                      </span>
                    </div>
                    {device.why && device.why.length > 0 && (
                      <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Reasons</p>
                        <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                          {device.why.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'down24h' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
              <p>Tickets in this view automatically close (disappear) as soon as the edge becomes active. Excluding <strong>Forti Cloud</strong> devices from <strong>IBL Procurement</strong>.</p>
            </div>
            
            {down24hTickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="font-medium text-slate-700">No Devices Down {'>'} 24h</p>
                <p className="text-sm mt-1">All qualified edges are currently online or down for less than 24 hours.</p>
              </div>
            ) : (
              down24hTickets.map(device => (
                <div key={device.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center shrink-0">
                    <CloudOff className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 truncate">{device.name || device.id}</h3>
                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                          <Server className="w-3.5 h-3.5" />
                          {device._controller?.label}
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          {device._controller?.ownership}
                          {device.tenant && (
                            <>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              {device.tenant}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                          Down {device.downHours?.toFixed(1)}h
                        </span>
                        {device.downSince && (
                          <p className="text-xs text-slate-400 mt-1.5">{device.downSince}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'assurance' && (
          <div className="space-y-4">
            {ticketsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : ticketsError ? (
              <div className="bg-red-50 rounded-xl border border-red-200 p-8 text-center text-red-600">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                <p className="font-medium">Failed to load tickets</p>
                <p className="text-sm mt-1">{ticketsError}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50">Retry</button>
              </div>
            ) : assuranceTickets.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
                <TicketIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-700">No Assurance Tickets</p>
                <p className="text-sm mt-1">Open a new assurance ticket to start tracking.</p>
              </div>
            ) : (
              assuranceTickets.map(ticket => (
                <div key={ticket.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{ticket.tenant}</h3>
                      <p className="text-sm text-slate-500 font-mono mt-0.5">SID: {ticket.sid_sdwan}</p>
                    </div>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {ticket.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1 text-xs uppercase tracking-wider font-semibold">Contact Person</p>
                      <p className="text-slate-800 font-medium">{ticket.contact_person}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1 text-xs uppercase tracking-wider font-semibold">Created At</p>
                      <p className="text-slate-800">{ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleString() : 'Just now'}</p>
                    </div>
                  </div>

                  {ticket.edgeInfo && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Edge Identity Match</p>
                      <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-4">
                        <Database className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{ticket.edgeInfo.name}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {ticket.edgeInfo.controller} • IP: {ticket.edgeInfo.ip || 'N/A'} • Status: {ticket.edgeInfo.status || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Open Assurance Ticket</h2>
            </div>
            
            <form onSubmit={handleSubmitTicket} className="p-6 overflow-y-auto">
              {formError && (
                <div className="mb-4 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg border border-red-100">
                  {formError}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tenant Name</label>
                  <input
                    type="text"
                    value={formTenant}
                    onChange={e => setFormTenant(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="e.g. Bank Mandiri"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">SID SDWAN</label>
                  <input
                    type="text"
                    value={formSid}
                    onChange={e => setFormSid(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Enter SID to map edge identity..."
                  />
                  {matchedEdge && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                      <Database className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 truncate">Edge Found: {matchedEdge.name || matchedEdge.id}</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          {matchedEdge._controller?.label} • {matchedEdge.status || 'Unknown'} • IP: {matchedEdge.ip || 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Person</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={e => setFormContact(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Name / Phone Number"
                  />
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
