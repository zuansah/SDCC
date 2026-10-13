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
 * Captures any DOM element (e.g. Physical Sticker) as a high-res PNG and triggers download
 */
export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string,
  scale: number = 3
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

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
    const canvas = await html2canvas(sheet, {
      scale: 2, // 2x gives 300+ DPI equivalent for sharp barcodes/QRs
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

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
  if (!pageElements || pageElements.length === 0) {
    throw new Error('No BA report pages found to export.');
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const total = pageElements.length;

  for (let i = 0; i < total; i++) {
    if (onProgress) {
      onProgress(i + 1, total);
    }

    const page = pageElements[i];
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      ignoreElements: (el) => el.tagName === 'IFRAME',
    });

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
