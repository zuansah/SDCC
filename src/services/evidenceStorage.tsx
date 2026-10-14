import React, { useState, useEffect } from 'react';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { BAData } from '../types';

export const IMAGE_FIELDS = [
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
] as const;

export type ImageFieldKey = typeof IMAGE_FIELDS[number];

/**
 * Convert a base64 data URL to a binary Blob
 */
export function base64ToBlob(base64DataUrl: string): Blob {
  const parts = base64DataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binaryStr = atob(parts[1] || '');
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload an evidence photo to Firebase Storage at ba-evidence/<baId>/<fieldName>.jpg
 * Returns the storage path (not a download URL)
 */
export async function uploadEvidence(baId: string, fieldName: string, blob: Blob): Promise<string> {
  const path = `ba-evidence/${baId}/${fieldName}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return path; // Store the PATH, not a download URL
}

/**
 * Scan all evidence fields in BA form data. For every field containing a base64 data URL,
 * upload the photo to Firebase Storage and replace the base64 string with its Storage path.
 */
export async function processAndUploadEvidencePhotos(
  baId: string,
  data: Partial<BAData>,
  onProgress?: (current: number, total: number, fieldName: string) => void
): Promise<Partial<BAData>> {
  const updated: any = { ...data };
  const uploadTasks: { key: string; blob: Blob }[] = [];

  for (const field of IMAGE_FIELDS) {
    const val = updated[field];
    if (typeof val === 'string' && val.startsWith('data:')) {
      try {
        const blob = base64ToBlob(val);
        uploadTasks.push({ key: field, blob });
      } catch (err) {
        console.warn(`Failed to convert base64 to blob for field: ${field}`, err);
      }
    }
  }

  if (uploadTasks.length === 0) {
    return updated;
  }

  let completed = 0;
  const total = uploadTasks.length;

  for (const task of uploadTasks) {
    onProgress?.(completed + 1, total, task.key);
    try {
      const path = await uploadEvidence(baId, task.key, task.blob);
      updated[task.key] = path;
    } catch (err: any) {
      console.error(`Failed to upload ${task.key} to Storage:`, err);
      throw new Error(`Gagal mengunggah foto bukti (${task.key}): ${err.message || 'Storage error'}`);
    }
    completed++;
    onProgress?.(completed, total, task.key);
  }

  return updated;
}

// In-memory cache for loaded Object URLs to prevent duplicate network downloads
const urlCache = new Map<string, string>();

/**
 * Load evidence photo bytes from Firebase Storage and create an Object URL.
 * Supports backward compatibility for inline base64 and standard URLs.
 */
export async function loadEvidenceUrl(pathOrDataUrl: string): Promise<string> {
  if (!pathOrDataUrl) return '';

  // Backward compatibility: inline base64 or direct URLs
  if (
    pathOrDataUrl.startsWith('data:') ||
    pathOrDataUrl.startsWith('blob:') ||
    pathOrDataUrl.startsWith('http://') ||
    pathOrDataUrl.startsWith('https://')
  ) {
    return pathOrDataUrl;
  }

  // Check in-memory cache
  if (urlCache.has(pathOrDataUrl)) {
    return urlCache.get(pathOrDataUrl)!;
  }

  try {
    const storageRef = ref(storage, pathOrDataUrl);
    const bytes = await getBytes(storageRef);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const objectUrl = URL.createObjectURL(blob);
    urlCache.set(pathOrDataUrl, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn(`Failed to load evidence from storage for path: ${pathOrDataUrl}`, err);
    return '';
  }
}

/**
 * Preload all evidence photos for a given BA document into memory
 */
export async function preloadBAEvidence(ba: BAData): Promise<void> {
  const promises: Promise<string>[] = [];
  for (const field of IMAGE_FIELDS) {
    const val = (ba as any)[field];
    if (typeof val === 'string' && val && !val.startsWith('data:') && !val.startsWith('http')) {
      promises.push(loadEvidenceUrl(val));
    }
  }
  await Promise.all(promises);
}

/**
 * React hook to load and manage an evidence image URL (from Storage path or base64)
 */
export function useEvidenceImage(src: string | undefined): { url: string; loading: boolean; error: boolean } {
  const [url, setUrl] = useState<string>(() => {
    if (!src) return '';
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src;
    return urlCache.get(src) || '';
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!src) return false;
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return false;
    return !urlCache.has(src);
  });
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setUrl('');
      setLoading(false);
      setError(false);
      return;
    }

    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) {
      setUrl(src);
      setLoading(false);
      setError(false);
      return;
    }

    if (urlCache.has(src)) {
      setUrl(urlCache.get(src)!);
      setLoading(false);
      setError(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);

    loadEvidenceUrl(src)
      .then((resolvedUrl) => {
        if (!active) return;
        if (resolvedUrl) {
          setUrl(resolvedUrl);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [src]);

  return { url, loading, error };
}

export interface EvidenceImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackText?: string;
  containerClassName?: string;
}

/**
 * React Component for rendering evidence photos.
 * - If src starts with data:, renders inline base64 directly (backward compatible / local preview).
 * - Otherwise, fetches bytes via Firebase Storage getBytes() and renders the Object URL.
 */
export function EvidenceImage({
  src,
  fallbackText,
  className,
  containerClassName,
  alt = 'Evidence photo',
  ...rest
}: EvidenceImageProps) {
  const { url, loading, error } = useEvidenceImage(src);

  if (!src) {
    return fallbackText ? <span className="text-slate-400 text-xs">{fallbackText}</span> : null;
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${containerClassName || className || 'w-full h-full'}`}>
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs p-2 text-center ${containerClassName || className || 'w-full h-full'}`}>
        <span className="font-medium text-slate-500">Gambar Tidak Tersedia</span>
        <span className="text-[10px] text-slate-400 mt-0.5">{src.startsWith('ba-evidence') ? 'Storage path' : 'File'}</span>
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} {...rest} />;
}
