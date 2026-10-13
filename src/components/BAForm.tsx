import React, { useState } from 'react';
import { BAData } from '../types';
import { generateId, fileToBase64, fileToBase64WithGeotag, formatDate } from '../lib/utils';
import { Save, X, UploadCloud, Image as ImageIcon, MapPin, QrCode } from 'lucide-react';
import QRScanner from './QRScanner';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BAFormProps {
  key?: string | number;
  initialData: BAData | null;
  onSave: (data: BAData) => Promise<void> | void;
  onCancel: () => void;
  isTechnician?: boolean;
}

const defaultData: Partial<BAData> = {
  status: 'draft',
  projectName: '',
  siteName: '',
  preparedBy: '',
  companyName: '',
  locationName: '',
  installAddress: '',
  deliveryAddress: '',
  operationalHours: '',
  coordinator: '',
  installLocation: '',
  deviceType: '',
};

export default function BAForm({ initialData, onSave, onCancel, isTechnician }: BAFormProps) {
  const [formData, setFormData] = useState<Partial<BAData>>(initialData || defaultData);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  
  const handleScan = async (decodedText: string) => {
    setShowQRScanner(false);
    setScanning(true);
    setErrorMsg(null);
    try {
      const docRef = doc(db, 'traceMappings', decodedText);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData(prev => ({
          ...prev,
          ...data,
          siteName: data.Hostname || data.hostname || data.siteName || '',
          orderNumber: data.Order || data['Order Number'] || data.orderNumber || '',
          city: data.Kota || data.city || '',
          // Do not override id or other system fields
          id: prev.id,
          createdAt: prev.createdAt,
          startedAt: prev.startedAt || new Date().toISOString()
        }));
      } else {
        setErrorMsg("Trace ID not found in database: " + decodedText);
      }
    } catch (err: any) {
      setErrorMsg("Failed to fetch mapping data: " + err.message);
    } finally {
      setScanning(false);
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      startedAt: prev.startedAt || new Date().toISOString()
    }));
    setErrorMsg(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof BAData) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setGeoLoading(true);
        // Get Geo Location
        let geoText = "";
        let timeText = formatDate(new Date().toISOString());
        
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 });
          });
          geoText = `Lat: ${position.coords.latitude.toFixed(6)}, Lon: ${position.coords.longitude.toFixed(6)}`;
        } catch (geoErr) {
          console.warn("Geolocation failed or denied", geoErr);
          geoText = "Location: Unavailable";
        }
        
        // Convert to base64 with Watermark (Geotag)
        const base64 = await fileToBase64WithGeotag(file, geoText, timeText);
        setFormData((prev) => ({ ...prev, [fieldName]: base64 }));
      } catch (err) {
        console.error("Error converting image", err);
        alert("Failed to read image file.");
      } finally {
        setGeoLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields = [
      { key: 'projectName', label: 'Project Name' },
      { key: 'siteName', label: 'Site Name' },
      { key: 'preparedBy', label: 'Prepared By (Name)' },
      { key: 'companyName', label: 'Company Name (Pelaksana)' }
    ];

    const missing = requiredFields.filter(f => !formData[f.key as keyof BAData]);
    if (missing.length > 0) {
      setErrorMsg(`Please fill out the following required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    const isNew = !initialData?.id;
    
    // DUPLICATE GUARDRAIL
    // Check if a BA with the same project name and site name already exists
    try {
      const q = query(
        collection(db, 'bas'),
        where('projectName', '==', formData.projectName),
        where('siteName', '==', formData.siteName)
      );
      const snapshot = await getDocs(q);
      
      // If there are matches, check if any of them is NOT the current BA we are editing
      if (!snapshot.empty) {
        const isDuplicate = snapshot.docs.some(d => {
          const data = d.data();
          const notCurrentDoc = d.id !== initialData?.id;
          const notRejected = data.status !== 'rejected';
          return notCurrentDoc && notRejected;
        });
        
        if (isDuplicate) {
          setErrorMsg(`A document for "${formData.projectName}" at "${formData.siteName}" already exists. Please avoid creating duplicates.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    } catch (e) {
      console.error("Duplicate check failed:", e);
      // Proceed if check fails due to offline mode or permissions
    }
    
    let submittedAt = new Date().toISOString();
    let formDurationSeconds = formData.formDurationSeconds;
    
    if (formData.startedAt && !formDurationSeconds) {
      const start = new Date(formData.startedAt).getTime();
      const end = new Date(submittedAt).getTime();
      formDurationSeconds = Math.floor((end - start) / 1000);
    }

    const rawData = {
      ...formData,
      id: isNew ? generateId() : initialData.id,
      createdAt: isNew ? new Date().toISOString() : initialData.createdAt,
      submittedAt: formData.submittedAt || submittedAt,
      formDurationSeconds: formDurationSeconds,
    };
    
    // Remove undefined values that might crash Firestore SDK
    const submissionData = Object.fromEntries(
      Object.entries(rawData).filter(([_, v]) => v !== undefined)
    ) as unknown as BAData;

    try {
      await onSave(submissionData);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during submission.');
    }
  };

  const renderInputGroup = (label: string, name: keyof BAData, required = false, type = 'text') => (
    <div key={name}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-blue-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        value={(formData[name] as string) || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
      />
    </div>
  );

  const renderImageUploadGroup = (label: string, name: keyof BAData, allowGallery = false) => (
    <div key={name} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="h-40 border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden group">
        {formData[name] ? (
          <div className="absolute inset-0">
            <img src={formData[name] as string} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Click to change</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs text-slate-500 block">Tap to upload</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          {...(!allowGallery ? { capture: "environment" } : {})}
          onChange={(e) => handleImageUpload(e, name)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {geoLoading && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-800 font-medium">Processing Image & Geo-tagging...</p>
            <p className="text-slate-500 text-sm mt-1">Please allow location access if prompted</p>
          </div>
        </div>
      )}
      <div className="px-8 py-6 border-b border-slate-200 bg-white sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isTechnician ? 'Form Serah Terima Project' : initialData ? 'Edit Berita Acara' : 'Create New Berita Acara'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isTechnician ? 'Please fill out all the evidence required for the project handover.' : 'Fill out the details for the installation report.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isTechnician && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            form="ba-form"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Save className="w-4 h-4" />
            {isTechnician ? 'Submit Evidence' : 'Save Document'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50">


        {errorMsg && (
          <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMsg}
          </div>
        )}
        <div className="max-w-4xl mx-auto mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowQRScanner(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
            disabled={scanning}
          >
            <QrCode className="w-5 h-5" />
            {scanning ? 'Loading...' : 'Scan QR Mapping Code'}
          </button>
        </div>

        <form id="ba-form" onSubmit={handleSubmit} noValidate className="max-w-4xl mx-auto space-y-8 pb-20">
          
          {/* Section: General Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">1. General Information</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <select
                  name="projectName"
                  value={formData.projectName || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                >
                  <option value="">Select Project</option>
                  <option value="Indomarco 2026">Indomarco 2026</option>
                  <option value="Bank NTT 2026">Bank NTT 2026</option>
                </select>
              </div>
              {renderInputGroup("Order Number", "orderNumber")}
              {renderInputGroup("Site Name", "siteName", true)}
              {renderInputGroup("Prepared By (Name)", "preparedBy", true)}
              {renderInputGroup("Company Name (Pelaksana)", "companyName", true)}
            </div>
          </div>
          </div>

          {/* Section: Site Location */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">2. Site Location Details</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderInputGroup("Location Name", "locationName")}
              {renderInputGroup("City", "city")}
              {renderInputGroup("Installation Address", "installAddress")}
              {renderInputGroup("Delivery Address", "deliveryAddress")}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Operational Hours
                </label>
                <select
                  name="operationalHours"
                  value={formData.operationalHours || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                >
                  <option value="">Select Operational Hours</option>
                  <option value="24 Hours">24 Hours</option>
                  <option value="08:00 - 17:00">08:00 - 17:00</option>
                  <option value="09:00 - 18:00">09:00 - 18:00</option>
                  <option value="10:00 - 22:00">10:00 - 22:00</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {renderInputGroup("Coordinator Name", "coordinator")}
              {renderInputGroup("Coordinator Telp", "coordinatorTelp")}
              {renderInputGroup("Installation Location (Floor/Room)", "installLocation")}
            </div>
          </div>
          </div>

          {/* Section: Equipment Details */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">3. Equipment Information</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Device Type / Model
                </label>
                <select
                  name="deviceType"
                  value={formData.deviceType || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                >
                  <option value="">Select Device</option>
                  <option value="FORTINET — FortiGate 40F">FORTINET — FortiGate 40F</option>
                  <option value="CISCO — ISR1100-4G-LTE">CISCO — ISR1100-4G-LTE</option>
                  <option value="CISCO — ISR1100-4G">CISCO — ISR1100-4G</option>
                  <option value="CISCO — ISR1100X-4G">CISCO — ISR1100X-4G</option>
                  <option value="CISCO — ISR1100-4GLTEGB">CISCO — ISR1100-4GLTEGB</option>
                  <option value="CISCO — ISR1100-6G">CISCO — ISR1100-6G</option>
                  <option value="CISCO — C8300-1N1S-4T2X">CISCO — C8300-1N1S-4T2X</option>
                  <option value="CISCO — C8300-1N1S-6T">CISCO — C8300-1N1S-6T</option>
                  <option value="CISCO — C8200-1N-4T">CISCO — C8200-1N-4T</option>
                  <option value="CISCO — C1111X-8P">CISCO — C1111X-8P</option>
                  <option value="CISCO — C1121X-8PLTEP">CISCO — C1121X-8PLTEP</option>
                  <option value="CISCO — vEdge 2001">CISCO — vEdge 2001</option>
                  <option value="VELO — VELO 710">VELO — VELO 710</option>
                  <option value="VELO — VELO 510">VELO — VELO 510</option>
                  <option value="VELO — vEdge 2000">VELO — vEdge 2000</option>
                </select>
              </div>
              {renderInputGroup("Serial Number", "serialNumber")}
            </div>
          </div>
          </div>

          {/* Section: Core Diagrams */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">4. Core Diagrams & Layouts</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {renderImageUploadGroup("Network Topology Diagram", "networkTopologyImg")}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Map / Site Coordinate</span>
                <div className="h-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col relative overflow-hidden bg-slate-50 group">
                <div className="absolute inset-0 bottom-12 flex flex-col items-center justify-center z-0">
                  <MapPin className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 mt-1">Tap button below to get location</span>
                </div>
                {formData.mapCoordinateLink ? (
                  <iframe 
                    className="absolute inset-0 bottom-12 w-full h-[calc(100%-3rem)] z-10 pointer-events-none"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://maps.google.com/maps?q=${formData.mapCoordinateLink.split('q=')[1]}&hl=en&z=15&output=embed`}
                  />
                ) : null}
                
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-white border-t border-slate-200 z-30 flex items-center justify-center px-2">
                  {formData.mapCoordinateLink ? (
                    <div className="flex flex-col items-center w-full">
                       <a href={formData.mapCoordinateLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline truncate w-full text-center block">{formData.mapCoordinateLink}</a>
                       <button type="button" onClick={() => setFormData(prev => ({...prev, mapCoordinateLink: ''}))} className="text-[10px] text-red-500 mt-1 cursor-pointer">Clear Link</button>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const lat = position.coords.latitude;
                              const lon = position.coords.longitude;
                              setFormData(prev => ({ ...prev, mapCoordinateLink: `https://www.google.com/maps?q=${lat},${lon}` }));
                            },
                            (error) => {
                              alert('Error getting location: ' + error.message);
                            }
                          );
                        } else {
                          alert('Geolocation is not supported by this browser.');
                        }
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 w-full h-full text-center flex items-center justify-center"
                    >
                      Use My Location
                    </button>
                  )}
                </div>
              </div>
              </div>
              {renderImageUploadGroup("Rack / Equipment Placement", "equipmentPlacementImg")}
              {renderImageUploadGroup("Floor / Room Layout", "floorLayoutImg")}
            </div>
          </div>
          </div>

          {/* Section: Photo Attachments - Page 7 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">5. General Photos</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {renderImageUploadGroup("Foto Depan Bangunan", "frontViewImg")}
              {renderImageUploadGroup("Foto Bersama PIC", "withPicImg")}
              {renderImageUploadGroup("Rack Before", "rackBeforeImg")}
              {renderImageUploadGroup("Rack After", "rackAfterImg")}
            </div>
          </div>
          </div>

          {/* Section: Photo Attachments - Page 8 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">6. Device & Testing Photos</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {renderImageUploadGroup("SN Perangkat SD-WAN", "snSdwanImg")}
              {renderImageUploadGroup("Asset Label", "snOntImg")}
              {renderImageUploadGroup("Speedtest Global", "speedtestGlobalImg")}
              {renderImageUploadGroup("Speedtest Domestik", "speedtestDomestikImg")}
            </div>
          </div>
          </div>

          {/* Section: Photo Attachments - Page 9 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 ml-1">7. Cabling & Connectivity Photos</h3>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {renderImageUploadGroup("Cabling SD-WAN", "cablingSdwanImg")}
              {renderImageUploadGroup("SD-WAN Box", "sdwanBoxImg")}
              {renderImageUploadGroup("Ping - Traceroute", "pingTracerouteImg")}
              {renderImageUploadGroup("Ping P2P Astinet", "pingAstinetImg")}
            </div>
          </div>
          </div>
          
        </form>
      </div>

      {showQRScanner && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setShowQRScanner(false)} 
        />
      )}
    </div>
  );
}

