export interface InventoryMeta {
  generatedAt?: string;
  dataAsOf?: string;
  source?: {
    file?: string;
    sha256?: string;
    batch?: number;
  };
  rows: number;
  byPlatform: Record<string, number>;
  byPosition: Record<string, number>;
  byLicence: Record<string, number>;
  byWitelTaxonomy: Record<string, number>;
  tenants: number;
  sidIssued: number;
  withCoords: number;
  omittedFields?: string[];
  omittedReason?: string;
}

export interface AssetItem {
  serial_number: string;
  platform?: 'CISCO' | 'FORTINET' | 'VELO' | string;
  device_model?: string;
  hostname?: string;
  tenant_name?: string;
  tenant_canonical?: string;
  tenant_is_location?: number;
  position_category?: string;
  sid_sdwan?: string | number;
  sid_connectivity?: string | number;
  sid_issued?: number;
  location_address?: string;
  sto?: string;
  region_witel?: string;
  witel_norm?: string;
  witel_taxonomy?: 'region' | 'division' | 'witel' | 'unknown' | string;
  latitude?: number | string;
  longitude?: number | string;
  has_coords?: number;
  warehouse?: string;
  warehouse_owner?: 'DCS' | 'DS' | 'DIGISERVE' | string;
  warehouse_condition?: 'BAIK' | 'RUSAK' | string;
  no_kontrak?: string;
  nama_pengadaan?: string;
  kode_kontrak?: string;
  acq_value_per_unit?: number | string;
  nka?: string;
  license_status?: string;
  license_norm?: 'ACTIVE' | 'EXPIRED' | 'NEEDED' | 'UNKNOWN' | string;
  system_ip?: string;
  logical_id?: string;
  software_version?: string;
  ip_wan_public?: string;
  replaces_serial?: string;
  // User Validation & Modification metadata
  is_modified?: boolean;
  is_custom_added?: boolean;
  validation_status?: 'VALIDATED' | 'NEEDS_REVIEW' | 'PENDING' | 'UNVALIDATED' | string;
  validation_notes?: string;
  validated_by?: string;
  validated_at?: string;
  last_modified_by?: string;
  last_modified_at?: string;
}

export interface InventoryPayload {
  meta: InventoryMeta;
  assets: AssetItem[];
}

export interface InventoryFilters {
  platform: string; // 'ALL' | 'CISCO' | 'FORTINET' | 'VELO'
  position: string; // 'ALL' | specific position category
  tenant: string; // 'ALL' | specific tenant
  witel: string; // 'ALL' | specific region_witel value or '__NOT_RECORDED__'
  licence: string; // 'ALL' | 'ACTIVE' | 'EXPIRED' | 'NEEDED' | 'UNKNOWN'
  warehouseOwner: string; // 'ALL' | 'DCS' | 'DS' | 'DIGISERVE'
  warehouseCondition: string; // 'ALL' | 'BAIK' | 'RUSAK'
  sidIssued: string; // 'ALL' | 'issued' | 'not_issued'
  hasCoords: string; // 'ALL' | 'with_coords' | 'no_coords'
  validationStatus: string; // 'ALL' | 'VALIDATED' | 'MODIFIED' | 'NEEDS_REVIEW'
  search: string;
}
