import { EvidenceCheckVerdict } from '../types';
import { AssetItem } from '../types/inventory';

/**
 * Downscales an image base64 data URL in-browser before sending to Gemini vision API.
 * Caps dimension to maxDim (e.g. 800px) and compresses to 0.75 quality JPEG (~60-120 KB).
 */
export async function downscaleImageForVision(
  base64DataUrl: string,
  maxDim = 800
): Promise<string> {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) {
    return base64DataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64DataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      resolve(base64DataUrl);
    };

    img.src = base64DataUrl;
  });
}

/**
 * Cross-checks an extracted serial number from Gemini against:
 * 1. The form's specified serialNumber
 * 2. The live inventory feed (assets/sdwan-live.json)
 */
export function crossCheckExtractedSerial(
  extractedSerial: string,
  inventoryAssets: AssetItem[] | null,
  formSerial?: string
): {
  isMatch: boolean;
  inventoryFound: boolean;
  inventoryVerified: boolean;
  contradictsForm: boolean;
  note: string;
} {
  const cleanExtracted = extractedSerial.trim().toUpperCase();
  const cleanForm = formSerial?.trim().toUpperCase();

  let inventoryFound = false;
  let assetModel = '';
  let assetTenant = '';

  if (inventoryAssets && cleanExtracted) {
    const matched = inventoryAssets.find(
      (a) =>
        a.serial_number?.toUpperCase() === cleanExtracted ||
        cleanExtracted.includes(a.serial_number?.toUpperCase() || '___')
    );
    if (matched) {
      inventoryFound = true;
      assetModel = matched.device_model || matched.hostname || '';
      assetTenant = matched.tenant_name || matched.tenant_canonical || '';
    }
  }

  let contradictsForm = false;
  let isMatch = true;

  if (cleanForm && cleanForm !== cleanExtracted) {
    // Only contradict if both are non-empty and clearly different
    if (!cleanExtracted.includes(cleanForm) && !cleanForm.includes(cleanExtracted)) {
      contradictsForm = true;
      isMatch = false;
    }
  }

  let note = '';
  if (contradictsForm) {
    note = `Photo serial (${cleanExtracted}) contradicts form serial (${cleanForm})`;
  } else if (inventoryFound) {
    note = `Verified against inventory${assetTenant ? ` (${assetTenant}${assetModel ? ` • ${assetModel}` : ''})` : ''}`;
  } else if (cleanForm && cleanForm === cleanExtracted) {
    note = `Matches form serial (${cleanExtracted})`;
  } else {
    note = `Serial read: ${cleanExtracted}`;
  }

  return {
    isMatch,
    inventoryFound,
    inventoryVerified: inventoryFound || (Boolean(cleanForm) && !contradictsForm),
    contradictsForm,
    note,
  };
}

/**
 * Sends a photo to Gemini vision model for automated verification and data extraction.
 * Advisory only: degrades gracefully if offline.
 */
export async function verifyEvidencePhoto(
  fieldName: string,
  base64Image: string,
  formSerialNumber?: string,
  inventoryAssets?: AssetItem[] | null
): Promise<EvidenceCheckVerdict> {
  try {
    // 1. Downscale on-device before sending
    const downscaled = await downscaleImageForVision(base64Image, 800);

    // 2. Call server proxy route
    const response = await fetch('/api/ai-evidence/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldName,
        imageBase64: downscaled,
        formSerialNumber,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const verdict: EvidenceCheckVerdict = await response.json();

    // 3. Cross-check serial if serial was extracted
    const extractedSerial = verdict.extracted?.serialNumber;
    if (extractedSerial) {
      const crossCheck = crossCheckExtractedSerial(
        extractedSerial,
        inventoryAssets || null,
        formSerialNumber
      );

      verdict.inventoryVerified = crossCheck.inventoryVerified;
      verdict.contradictsForm = crossCheck.contradictsForm;

      if (crossCheck.contradictsForm) {
        verdict.ok = false;
        verdict.status = 'warning';
        verdict.issues = [
          ...(verdict.issues || []),
          crossCheck.note,
        ];
        verdict.verdictText = crossCheck.note;
      } else {
        verdict.verdictText = crossCheck.note;
      }
    }

    return verdict;
  } catch (err: any) {
    console.warn('AI Evidence verification skipped (offline/error):', err?.message);
    return {
      ok: true,
      subjectMatch: true,
      status: 'unchecked',
      issues: ['Unchecked (AI offline)'],
      checkedAt: new Date().toISOString(),
    };
  }
}
