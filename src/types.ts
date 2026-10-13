export interface BAData {
  id: string;
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
}
