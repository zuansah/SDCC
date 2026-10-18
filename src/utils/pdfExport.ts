import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import JSZip from 'jszip';
import { generateAndVerifyQrSvg } from './traceUtils';

/**
 * Downloads a single SVG string directly as an .svg file
 */
export function downloadSvgFile(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Safely renders an HTMLElement to canvas using html2canvas-pro.
 * If html2canvas fails with "Unable to find element in cloned iframe" or similar DOM tree issues,
 * it falls back to mounting a pristine clone directly to document.body, rendering it, and cleaning up.
 */
async function renderElementToCanvasSafe(
  element: HTMLElement,
  scale: number = 2
): Promise<HTMLCanvasElement> {
  const html2canvasOptions = {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (el: Element) =>
      el.tagName === 'IFRAME' ||
      el.getAttribute('data-html2canvas-ignore') === 'true',
  };

  try {
    return await html2canvas(element, html2canvasOptions);
  } catch (err: any) {
    console.warn('Direct html2canvas capture failed, attempting isolated staging fallback:', err);

    // Create an isolated staging container directly attached to document.body
    const staging = document.createElement('div');
    staging.style.position = 'fixed';
    staging.style.left = '-10000px';
    staging.style.top = '0';
    staging.style.width = element.offsetWidth ? `${element.offsetWidth}px` : '297mm';
    staging.style.height = element.offsetHeight ? `${element.offsetHeight}px` : '210mm';
    staging.style.overflow = 'hidden';
    staging.style.backgroundColor = '#ffffff';
    staging.style.zIndex = '-9999';

    // Clone element and strip iframes to prevent cross-origin issues
    const cloned = element.cloneNode(true) as HTMLElement;
    cloned.querySelectorAll('iframe').forEach((ifr) => ifr.remove());
    staging.appendChild(cloned);
    document.body.appendChild(staging);

    try {
      return await html2canvas(cloned, html2canvasOptions);
    } finally {
      if (staging.parentNode) {
        staging.parentNode.removeChild(staging);
      }
    }
  }
}

/**
 * Captures any DOM element (e.g. Physical Sticker) as a high-res PNG and triggers download
 */
export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
  scale: number = 3
): Promise<void> {
  const canvas = await renderElementToCanvasSafe(element, scale);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports multiple A4 portrait sticker sheets to a multi-page PDF (210mm x 297mm per page)
 */
export async function exportStickerSheetsToPdf(
  sheetElements: HTMLElement[],
  filename: string = 'Telkom_SDWAN_Stickers_A4.pdf',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!sheetElements || sheetElements.length === 0) {
    throw new Error('No sticker sheets found to export.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const total = sheetElements.length;

  for (let i = 0; i < total; i++) {
    if (onProgress) {
      onProgress(i + 1, total);
    }

    const sheet = sheetElements[i];
    const canvas = await renderElementToCanvasSafe(sheet, 2);

    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // 210mm wide x 297mm high A4
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Exports BA Report pages to a multi-page A4 landscape PDF (297mm x 210mm per page)
 */
export async function exportBaReportToPdf(
  pageElements: HTMLElement[],
  filename: string = 'BA_Report.pdf',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = pageElements.length;
  if (total === 0) {
    throw new Error('No BA report pages found to export.');
  }

  // Pre-wait to ensure images inside pages are ready
  try {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.ba-report-page img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 2000); // 2s max wait per image
        });
      })
    );
  } catch (_) {}

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  for (let i = 0; i < total; i++) {
    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Always fetch the live attached DOM element to avoid any detached element issues
    const livePages = Array.from(document.querySelectorAll<HTMLElement>('.ba-report-page'));
    const page = (livePages[i] && livePages[i].isConnected) ? livePages[i] : pageElements[i];

    if (!page) {
      throw new Error(`Page ${i + 1} could not be found.`);
    }

    const canvas = await renderElementToCanvasSafe(page, 2);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (i > 0) {
      pdf.addPage('a4', 'landscape');
    }

    // 297mm wide x 210mm high A4 landscape
    pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Packages multiple QR code SVG vectors into a single zip archive for instant bulk download
 */
export async function downloadQrCodesZip(
  items: { trace: string; hostname?: string }[],
  zipFilename: string = 'Telkom_QR_Labels.zip',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!items || items.length === 0) {
    throw new Error('No QR items provided to zip.');
  }

  const zip = new JSZip();
  const folder = zip.folder('qr_codes') || zip;
  const total = items.length;

  for (let i = 0; i < total; i++) {
    if (onProgress) {
      onProgress(i + 1, total);
    }
    const item = items[i];
    const { svg } = await generateAndVerifyQrSvg(item.trace);
    const safeHost = (item.hostname || item.trace).replace(/[^a-zA-Z0-9_-]/g, '_');
    folder.file(`${item.trace}_${safeHost}.svg`, svg);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
