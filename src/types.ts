export interface BAData {
  id: string;
  baNumber?: string;
  userId?: string;
  createdAt: string;
  startedAt?: string;
  submittedAt?: string;
  formDurationSeconds?: number;
  status: 'draft' | 'completed' | 'accepted' | 'rejected';
  acceptedBy?: string;
  rejectNote?: string;
  
  // General
  projectName: string;
  orderNumber?: string;
  siteName: string;
  preparedBy: string;
  companyName: string;

  // Site Location
  locationName: string;
  city?: string;
  installAddress: string;
  deliveryAddress: string;
  operationalHours: string;
  coordinator: string;
  coordinatorTelp?: string;
  installLocation: string;
  roomTemp?: string;

  // Equipment Placement
  deviceType: string;
  serialNumber?: string;

  // Images (Stored as Data URLs for MVP, or just placeholders if empty)
  networkTopologyImg?: string;
  mapCoordinateImg?: string;
  mapCoordinateLink?: string;
  equipmentPlacementImg?: string;
  floorLayoutImg?: string;
  
  // Photo Attachments (Page 7)
  frontViewImg?: string;
  withPicImg?: string;
  rackBeforeImg?: string;
  rackAfterImg?: string;

  // Photo Attachments (Page 8)
  snSdwanImg?: string;
  snOntImg?: string;
  modemMainImg?: string;
  modemBackupImg?: string;
  speedtestGlobalImg?: string;
  speedtestDomestikImg?: string;

  // Photo Attachments (Page 9)
  cablingSdwanImg?: string;
  sdwanBoxImg?: string;
  pingTracerouteImg?: string;
  pingAstinetImg?: string;

  // AI Evidence Verification (Gemini Vision)
  evidenceChecks?: Record<string, EvidenceCheckVerdict>;
}

export interface EvidenceCheckVerdict {
  ok: boolean;
  subjectMatch: boolean;
  status: 'checking' | 'verified' | 'warning' | 'unchecked';
  extracted?: {
    serialNumber?: string;
    deviceModel?: string;
    pingResult?: string;
    latencyMs?: number;
    downloadMbps?: number;
    uploadMbps?: number;
    details?: string;
  };
  issues: string[];
  checkedAt?: string;
  modelUsed?: string;
  verdictText?: string;
  inventoryVerified?: boolean;
  contradictsForm?: boolean;
}
