import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Server, 
  Building2, 
  MapPin, 
  Radio, 
  FileSpreadsheet, 
  Key, 
  RotateCcw, 
  Loader2,
  Save,
  Check
} from 'lucide-react';
import { AssetItem } from '../types/inventory';

interface AssetEditModalProps {
  isOpen: boolean;
  asset: AssetItem | null;
  mode: 'edit' | 'create';
  userEmail: string;
  onClose: () => void;
  onSave: (serial: string, updates: Partial<AssetItem>) => Promise<void>;
  onRevert?: (serial: string) => Promise<void>;
}

export default function AssetEditModal({
  isOpen,
  asset,
  mode,
  userEmail,
  onClose,
  onSave,
  onRevert,
}: AssetEditModalProps) {
  if (!isOpen) return null;

  const [serial, setSerial] = useState(asset?.serial_number || '');
  const [platform, setPlatform] = useState(asset?.platform || 'CISCO');
  const [deviceModel, setDeviceModel] = useState(asset?.device_model || '');
  const [hostname, setHostname] = useState(asset?.hostname || '');
  const [tenantName, setTenantName] = useState(asset?.tenant_name || '');
  const [positionCategory, setPositionCategory] = useState(asset?.position_category || 'EDGES');
  
  const [sidSdwan, setSidSdwan] = useState(asset?.sid_sdwan ? String(asset.sid_sdwan) : '');
  const [sidConnectivity, setSidConnectivity] = useState(asset?.sid_connectivity ? String(asset.sid_connectivity) : '');
  
  const [regionWitel, setRegionWitel] = useState(asset?.region_witel || '');
  const [witelNorm, setWitelNorm] = useState(asset?.witel_norm || '');
  const [sto, setSto] = useState(asset?.sto || '');
  const [locationAddress, setLocationAddress] = useState(asset?.location_address || '');
  const [latitude, setLatitude] = useState(asset?.latitude ? String(asset.latitude) : '');
  const [longitude, setLongitude] = useState(asset?.longitude ? String(asset.longitude) : '');
  
  const [warehouse, setWarehouse] = useState(asset?.warehouse || '');
  const [warehouseOwner, setWarehouseOwner] = useState(asset?.warehouse_owner || 'DCS');
  const [warehouseCondition, setWarehouseCondition] = useState(asset?.warehouse_condition || 'BAIK');
  
  const [noKontrak, setNoKontrak] = useState(asset?.no_kontrak || '');
  const [namaPengadaan, setNamaPengadaan] = useState(asset?.nama_pengadaan || '');
  const [kodeKontrak, setKodeKontrak] = useState(asset?.kode_kontrak || '');
  const [nka, setNka] = useState(asset?.nka || '');
  
  const [licenseNorm, setLicenseNorm] = useState(asset?.license_norm || 'ACTIVE');
  const [licenseStatus, setLicenseStatus] = useState(asset?.license_status || '');
  const [systemIp, setSystemIp] = useState(asset?.system_ip || '');
  const [logicalId, setLogicalId] = useState(asset?.logical_id || '');
  const [softwareVersion, setSoftwareVersion] = useState(asset?.software_version || '');
  const [ipWanPublic, setIpWanPublic] = useState(asset?.ip_wan_public || '');

  // Validation status & remarks
  const [validationStatus, setValidationStatus] = useState<'VALIDATED' | 'NEEDS_REVIEW' | 'PENDING' | 'UNVALIDATED'>(
    (asset?.validation_status as any) || 'VALIDATED'
  );
  const [validationNotes, setValidationNotes] = useState(asset?.validation_notes || '');

  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'service' | 'location' | 'contract' | 'validation'>('general');
  const [formError, setFormError] = useState<string | null>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  useEffect(() => {
    setFormError(null);
    setShowRevertConfirm(false);
    if (asset) {
      setSerial(asset.serial_number || '');
      setPlatform(asset.platform || 'CISCO');
      setDeviceModel(asset.device_model || '');
      setHostname(asset.hostname || '');
      setTenantName(asset.tenant_name || '');
      setPositionCategory(asset.position_category || 'EDGES');
      setSidSdwan(asset.sid_sdwan ? String(asset.sid_sdwan) : '');
      setSidConnectivity(asset.sid_connectivity ? String(asset.sid_connectivity) : '');
      setRegionWitel(asset.region_witel || '');
      setWitelNorm(asset.witel_norm || '');
      setSto(asset.sto || '');
      setLocationAddress(asset.location_address || '');
      setLatitude(asset.latitude ? String(asset.latitude) : '');
      setLongitude(asset.longitude ? String(asset.longitude) : '');
      setWarehouse(asset.warehouse || '');
      setWarehouseOwner(asset.warehouse_owner || 'DCS');
      setWarehouseCondition(asset.warehouse_condition || 'BAIK');
      setNoKontrak(asset.no_kontrak || '');
      setNamaPengadaan(asset.nama_pengadaan || '');
      setKodeKontrak(asset.kode_kontrak || '');
      setNka(asset.nka || '');
      setLicenseNorm(asset.license_norm || 'ACTIVE');
      setLicenseStatus(asset.license_status || '');
      setSystemIp(asset.system_ip || '');
      setLogicalId(asset.logical_id || '');
      setSoftwareVersion(asset.software_version || '');
      setIpWanPublic(asset.ip_wan_public || '');
      setValidationStatus((asset.validation_status as any) || 'VALIDATED');
      setValidationNotes(asset.validation_notes || '');
    } else {
      setSerial('');
      setPlatform('CISCO');
      setDeviceModel('');
      setHostname('');
      setTenantName('');
      setPositionCategory('EDGES');
      setSidSdwan('');
      setSidConnectivity('');
      setRegionWitel('');
      setWitelNorm('');
      setSto('');
      setLocationAddress('');
      setLatitude('');
      setLongitude('');
      setWarehouse('');
      setWarehouseOwner('DCS');
      setWarehouseCondition('BAIK');
      setNoKontrak('');
      setNamaPengadaan('');
      setKodeKontrak('');
      setNka('');
      setLicenseNorm('ACTIVE');
      setLicenseStatus('');
      setSystemIp('');
      setLogicalId('');
      setSoftwareVersion('');
      setIpWanPublic('');
      setValidationStatus('VALIDATED');
      setValidationNotes('');
    }
  }, [asset, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!serial.trim()) {
      setFormError('Serial number is required.');
      return;
    }

    setSaving(true);
    try {
      const hasCoordsVal = latitude.trim() && longitude.trim() ? 1 : 0;
      const updates: Partial<AssetItem> = {
        serial_number: serial.trim().toUpperCase(),
        platform,
        device_model: deviceModel.trim(),
        hostname: hostname.trim().toUpperCase(),
        tenant_name: tenantName.trim(),
        position_category: positionCategory.trim(),
        sid_sdwan: sidSdwan.trim(),
        sid_connectivity: sidConnectivity.trim(),
        sid_issued: sidSdwan.trim() ? 1 : 0,
        region_witel: regionWitel.trim(),
        witel_norm: witelNorm.trim() || regionWitel.trim(),
        sto: sto.trim().toUpperCase(),
        location_address: locationAddress.trim(),
        latitude: latitude.trim(),
        longitude: longitude.trim(),
        has_coords: hasCoordsVal,
        warehouse: warehouse.trim(),
        warehouse_owner: warehouseOwner,
        warehouse_condition: warehouseCondition,
        no_kontrak: noKontrak.trim(),
        nama_pengadaan: namaPengadaan.trim(),
        kode_kontrak: kodeKontrak.trim(),
        nka: nka.trim(),
        license_norm: licenseNorm,
        license_status: licenseStatus.trim() || licenseNorm,
        system_ip: systemIp.trim(),
        logical_id: logicalId.trim(),
        software_version: softwareVersion.trim(),
        ip_wan_public: ipWanPublic.trim(),
        validation_status: validationStatus,
        validation_notes: validationNotes.trim(),
        validated_by: userEmail,
        validated_at: new Date().toISOString(),
      };

      await onSave(serial.trim().toUpperCase(), updates);
      onClose();
    } catch (err: any) {
      setFormError('Failed to save asset modifications: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!asset || !onRevert) return;
    setReverting(true);
    setFormError(null);
    try {
      await onRevert(asset.serial_number);
      onClose();
    } catch (err: any) {
      setFormError('Failed to revert: ' + (err.message || 'Unknown error'));
    } finally {
      setReverting(false);
      setShowRevertConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 relative flex flex-col max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {mode === 'create' ? 'Add New Inventory Asset' : `Edit & Validate Asset: ${asset?.serial_number}`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Modify attributes, correct field records, and certify data validation. Changes persist to cloud Firestore.
              </p>
            </div>
          </div>

          {/* Audit banner if previously modified */}
          {asset?.is_modified && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Modified by <strong>{asset.last_modified_by || 'User'}</strong> on{' '}
                  {asset.last_modified_at ? new Date(asset.last_modified_at).toLocaleString() : 'earlier date'}.
                  {asset.validation_notes ? ` Note: "${asset.validation_notes}"` : ''}
                </span>
              </div>
              {onRevert && (
                showRevertConfirm ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-rose-800">Restore master data?</span>
                    <button
                      type="button"
                      onClick={handleRevert}
                      disabled={reverting}
                      className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                    >
                      {reverting ? 'Restoring...' : 'Yes, Revert'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRevertConfirm(false)}
                      className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] hover:bg-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRevertConfirm(true)}
                    disabled={reverting}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer shrink-0"
                  >
                    Revert to Master Feed
                  </button>
                )
              )}
            </div>
          )}

          {/* Form Error Banner */}
          {formError && (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-2 mb-4 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'general' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Identity & Model</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('service')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'service' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Tenant & SID</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'location' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Location & Site</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contract')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'contract' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Procurement & WH</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'validation' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verification Status</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
          {/* TAB 1: GENERAL IDENTITY */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Serial Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={mode === 'edit'}
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="e.g. FGT60FTK21000000 or FTX20000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {mode === 'edit' && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Serial number serves as primary key
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Hostname</label>
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="e.g. JKT-SDWAN-BRANCH-01"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="CISCO">CISCO</option>
                    <option value="FORTINET">FORTINET</option>
                    <option value="VELO">VELO (VMware)</option>
                    <option value="HUAWEI">HUAWEI</option>
                    <option value="NOKIA">NOKIA</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Device Model</label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    placeholder="e.g. C1111-8P, FortiGate 60F"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Position Category</label>
                  <select
                    value={positionCategory}
                    onChange={(e) => setPositionCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="EDGES">EDGES (Customer Site)</option>
                    <option value="Warehouse Digiserve">Warehouse Digiserve</option>
                    <option value="Warehouse DCS">Warehouse DCS</option>
                    <option value="Warehouse DS">Warehouse DS</option>
                    <option value="Deployed / Live">Deployed / Live</option>
                    <option value="Dormant / RMA">Dormant / RMA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Software Version</label>
                  <input
                    type="text"
                    value={softwareVersion}
                    onChange={(e) => setSoftwareVersion(e.target.value)}
                    placeholder="e.g. 17.06.03a or 7.0.5"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">System IP</label>
                  <input
                    type="text"
                    value={systemIp}
                    onChange={(e) => setSystemIp(e.target.value)}
                    placeholder="e.g. 10.254.1.20"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE & TENANT */}
          {activeTab === 'service' && (
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tenant / Customer Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. BANK MANDIRI, PT PERTAMINA, KEMENKEU"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">SID SD-WAN</label>
                  <input
                    type="text"
                    value={sidSdwan}
                    onChange={(e) => setSidSdwan(e.target.value)}
                    placeholder="e.g. 150000000000"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Service Instance Identifier for SD-WAN overlay
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">SID Connectivity (Underlay)</label>
                  <input
                    type="text"
                    value={sidConnectivity}
                    onChange={(e) => setSidConnectivity(e.target.value)}
                    placeholder="e.g. Astinet / IndiHome SID"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Logical ID</label>
                  <input
                    type="text"
                    value={logicalId}
                    onChange={(e) => setLogicalId(e.target.value)}
                    placeholder="e.g. LOG-JKT-001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Public IP / WAN IP</label>
                  <input
                    type="text"
                    value={ipWanPublic}
                    onChange={(e) => setIpWanPublic(e.target.value)}
                    placeholder="e.g. 180.250.x.x"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOCATION & SITE */}
          {activeTab === 'location' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Region / Witel</label>
                  <input
                    type="text"
                    value={regionWitel}
                    onChange={(e) => setRegionWitel(e.target.value)}
                    placeholder="e.g. WITEL JAKARTA PUSAT, WITEL SURABAYA"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Witel Norm (Clean Kota)</label>
                  <input
                    type="text"
                    value={witelNorm}
                    onChange={(e) => setWitelNorm(e.target.value)}
                    placeholder="e.g. JAKARTA PUSAT"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">STO Code</label>
                  <input
                    type="text"
                    value={sto}
                    onChange={(e) => setSto(e.target.value)}
                    placeholder="e.g. CKG, GBR, KMY"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Location Address / Building</label>
                <textarea
                  rows={2}
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="e.g. Gedung Telkom Landmark Tower Lantai 15, Jl. Jend Gatot Subroto Kav 52"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Latitude</label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. -6.2297465"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Longitude</label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 106.829518"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROCUREMENT & WAREHOUSE */}
          {activeTab === 'contract' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Warehouse Name</label>
                  <input
                    type="text"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    placeholder="e.g. WH Cikarang / WH Digiserve"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Warehouse Owner</label>
                  <select
                    value={warehouseOwner}
                    onChange={(e) => setWarehouseOwner(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="DCS">DCS</option>
                    <option value="DS">DS</option>
                    <option value="DIGISERVE">DIGISERVE</option>
                    <option value="TELKOM">TELKOM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Physical Condition</label>
                  <select
                    value={warehouseCondition}
                    onChange={(e) => setWarehouseCondition(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="BAIK">BAIK (Operational Good)</option>
                    <option value="RUSAK">RUSAK (Defective / RMA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">No. Kontrak</label>
                  <input
                    type="text"
                    value={noKontrak}
                    onChange={(e) => setNoKontrak(e.target.value)}
                    placeholder="e.g. K.TEL.000882/HK.810/GPP-000000/2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Pengadaan</label>
                  <input
                    type="text"
                    value={namaPengadaan}
                    onChange={(e) => setNamaPengadaan(e.target.value)}
                    placeholder="e.g. PENGADAAN PERANGKAT SDWAN CISCO 2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Kontrak</label>
                  <input
                    type="text"
                    value={kodeKontrak}
                    onChange={(e) => setKodeKontrak(e.target.value)}
                    placeholder="e.g. KTR-2026-01"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">NKA</label>
                  <input
                    type="text"
                    value={nka}
                    onChange={(e) => setNka(e.target.value)}
                    placeholder="e.g. NKA-1002"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Licence Status</label>
                  <select
                    value={licenseNorm}
                    onChange={(e) => setLicenseNorm(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="NEEDED">NEEDED</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VALIDATION & VERIFICATION */}
          {activeTab === 'validation' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Validation & Data Quality Certification</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-xs">
                  Certify that this device's serial, hostname, customer mapping, and site location have been verified accurate.
                </p>

                <div className="pt-2">
                  <label className="block text-slate-800 font-bold mb-1.5">Certification Status</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                        validationStatus === 'VALIDATED'
                          ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-300 text-emerald-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="validation_status"
                        value="VALIDATED"
                        checked={validationStatus === 'VALIDATED'}
                        onChange={() => setValidationStatus('VALIDATED')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>✓ Validated / Verified</span>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                        validationStatus === 'NEEDS_REVIEW'
                          ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-300 text-amber-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="validation_status"
                        value="NEEDS_REVIEW"
                        checked={validationStatus === 'NEEDS_REVIEW'}
                        onChange={() => setValidationStatus('NEEDS_REVIEW')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>⚠️ Needs Review</span>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                        validationStatus === 'PENDING'
                          ? 'bg-blue-100/90 border-blue-400 ring-2 ring-blue-300 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="validation_status"
                        value="PENDING"
                        checked={validationStatus === 'PENDING'}
                        onChange={() => setValidationStatus('PENDING')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>⏳ Pending Check</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Validation Notes & Audit Remarks
                </label>
                <textarea
                  rows={3}
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  placeholder="e.g. Verified by engineer on-site: hostname updated to match rack switch labeling, GPS coordinates verified via live controller telemetry."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-500 text-[11px] space-y-1">
                <div>
                  Certified by: <strong className="text-slate-800">{userEmail}</strong>
                </div>
                <div>Timestamp: <strong className="text-slate-800">{new Date().toLocaleString()}</strong></div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Validate Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
