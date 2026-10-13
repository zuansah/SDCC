import { collection, addDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GeoLocationInfo {
  ip: string;
  countryCode: string;
  countryName: string;
  city: string;
  region: string;
  isp?: string;
  isIndonesia: boolean;
}

export type AccessActionType = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'SESSION_TIMEOUT'
  | 'VIEW_NAVIGATE'
  | 'PERMISSION_UPDATE'
  | 'GEO_BLOCKED'
  | 'DEVTOOLS_BLOCKED'
  | 'FORCE_TERMINATED'
  | 'USER_CREATED'
  | 'USER_DELETED';

export interface AccessLogItem {
  id?: string;
  timestamp: string;
  userId?: string;
  userEmail: string;
  userName?: string;
  role?: string;
  action: AccessActionType;
  details: string;
  ipAddress?: string;
  country?: string;
  userAgent?: string;
}

export interface UserSessionItem {
  uid: string;
  email: string;
  name: string;
  role: string;
  currentView: string;
  ipAddress: string;
  country: string;
  city: string;
  userAgent: string;
  loginAt: string;
  lastActiveAt: string;
  status: 'ONLINE' | 'IDLE' | 'TERMINATED';
}

// In-memory cache for geolocation to prevent repeated external calls
let cachedGeo: GeoLocationInfo | null = null;
let geoPromise: Promise<GeoLocationInfo> | null = null;

export function resetCachedGeo() {
  cachedGeo = null;
  geoPromise = null;
  try {
    sessionStorage.removeItem('telkom_client_geo');
  } catch (_) {}
}

/**
 * Detect client IP and Country with multi-provider fallback & timezone check
 */
export async function detectClientGeoLocation(): Promise<GeoLocationInfo> {
  // Check if admin bypass is active in session
  try {
    const bypass = sessionStorage.getItem('telkom_geo_bypass');
    if (bypass === 'true') {
      const bypassGeo: GeoLocationInfo = {
        ip: '127.0.0.1 (Bypass)',
        countryCode: 'ID',
        countryName: 'Indonesia (Admin Override)',
        city: 'Jakarta',
        region: 'DKI Jakarta',
        isp: 'Telkom Indonesia Network',
        isIndonesia: true,
      };
      cachedGeo = bypassGeo;
      return bypassGeo;
    }
  } catch (_) {}

  if (cachedGeo) return cachedGeo;
  if (geoPromise) return geoPromise;

  geoPromise = (async () => {
    // Check sessionStorage first
    try {
      const stored = sessionStorage.getItem('telkom_client_geo');
      if (stored) {
        const parsed = JSON.parse(stored);
        cachedGeo = parsed;
        return parsed;
      }
    } catch (_) {}

    // Fallback detection using Indonesian timezones
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isIndonesianTimezone = 
      tz === 'Asia/Jakarta' || 
      tz === 'Asia/Pontianak' || 
      tz === 'Asia/Makassar' || 
      tz === 'Asia/Jayapura';

    const fallback: GeoLocationInfo = {
      ip: '127.0.0.1',
      countryCode: isIndonesianTimezone ? 'ID' : 'UNKNOWN',
      countryName: isIndonesianTimezone ? 'Indonesia' : 'Unknown',
      city: isIndonesianTimezone ? 'Jakarta' : 'Unknown',
      region: isIndonesianTimezone ? 'DKI Jakarta' : 'Unknown',
      isp: 'Telkom Indonesia Network',
      isIndonesia: isIndonesianTimezone,
    };

    // Attempt 1: ipapi.co (reliable, accurate countryCode)
    try {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const code = (data.country_code || data.country || '').toUpperCase();
        const info: GeoLocationInfo = {
          ip: data.ip || '127.0.0.1',
          countryCode: code,
          countryName: data.country_name || (code === 'ID' ? 'Indonesia' : 'International'),
          city: data.city || 'Jakarta',
          region: data.region || '',
          isp: data.org || data.asn || 'Internet Provider',
          isIndonesia: code === 'ID' || isIndonesianTimezone,
        };
        cachedGeo = info;
        try { sessionStorage.setItem('telkom_client_geo', JSON.stringify(info)); } catch (_) {}
        return info;
      }
    } catch (_) {}

    // Attempt 2: ipwho.is fallback
    try {
      const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const code = (data.country_code || '').toUpperCase();
        const info: GeoLocationInfo = {
          ip: data.ip || '127.0.0.1',
          countryCode: code,
          countryName: data.country || (code === 'ID' ? 'Indonesia' : 'International'),
          city: data.city || 'Jakarta',
          region: data.region || '',
          isp: data.connection?.isp || data.connection?.org || 'Internet Provider',
          isIndonesia: code === 'ID' || isIndonesianTimezone,
        };
        cachedGeo = info;
        try { sessionStorage.setItem('telkom_client_geo', JSON.stringify(info)); } catch (_) {}
        return info;
      }
    } catch (_) {}

    cachedGeo = fallback;
    return fallback;
  })();

  return geoPromise;
}

/**
 * Log access event to Firestore access_logs collection
 */
export async function logAccessEvent(params: {
  action: AccessActionType;
  details: string;
  userEmail: string;
  userName?: string;
  userId?: string;
  role?: string;
  ipAddress?: string;
  country?: string;
}): Promise<void> {
  try {
    const geo = cachedGeo || await detectClientGeoLocation();
    const logItem: AccessLogItem = {
      timestamp: new Date().toISOString(),
      action: params.action,
      details: params.details,
      userEmail: params.userEmail || 'anonymous@telkom.co.id',
      userName: params.userName || params.userEmail?.split('@')[0] || 'User',
      userId: params.userId || '',
      role: params.role || 'User',
      ipAddress: params.ipAddress || geo.ip,
      country: params.country || geo.countryName,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    await addDoc(collection(db, 'access_logs'), logItem);
  } catch (err) {
    // Non-blocking security audit failure logging
    console.warn('Silent logAccessEvent error:', err);
  }
}

/**
 * Upsert active user session presence in user_sessions
 */
export async function updateUserSessionHeartbeat(params: {
  uid: string;
  email: string;
  name?: string;
  role?: string;
  currentView?: string;
  status?: 'ONLINE' | 'IDLE';
}): Promise<void> {
  if (!params.uid) return;
  try {
    const geo = cachedGeo || await detectClientGeoLocation();
    const now = new Date().toISOString();
    const sessionDocRef = doc(db, 'user_sessions', params.uid);

    const payload: Partial<UserSessionItem> = {
      uid: params.uid,
      email: params.email,
      name: params.name || params.email?.split('@')[0] || 'User',
      role: params.role || 'User',
      currentView: params.currentView || 'dashboard',
      ipAddress: geo.ip,
      country: geo.countryName,
      city: geo.city,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      lastActiveAt: now,
      status: params.status || 'ONLINE',
    };

    await setDoc(sessionDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Silent session update error:', err);
  }
}

/**
 * Terminate a user session (called by Super Admin)
 */
export async function forceTerminateSession(uid: string): Promise<void> {
  try {
    const sessionDocRef = doc(db, 'user_sessions', uid);
    await updateDoc(sessionDocRef, {
      status: 'TERMINATED',
      lastActiveAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error terminating session:', err);
    throw err;
  }
}

/**
 * End a user session cleanly on logout
 */
export async function endUserSession(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const sessionDocRef = doc(db, 'user_sessions', uid);
    await deleteDoc(sessionDocRef);
  } catch (err) {
    console.warn('Silent session end error:', err);
  }
}
