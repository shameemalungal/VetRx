// =============================================================
// VetRx — pdfGenerator.ts
// Direct client-side PDF generation, Save As File Picker,
// and filename sanitization utilities.
// =============================================================

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Sanitizes a file name for safe cross-platform saving.
 * Strips illegal characters: < > : " / \ | ? * and controls.
 * Ensures single .pdf extension.
 */
export function sanitizeFilename(rawName: string): string {
  let clean = rawName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();

  // Strip existing .pdf if present before enforcing lowercase .pdf
  clean = clean.replace(/\.pdf$/i, '');
  if (!clean) {
    clean = 'Document';
  }
  return `${clean}.pdf`;
}

/**
 * Formats a date string or object as YYYY-MM-DD for filenames.
 */
function getFormattedDate(date?: string | Date): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Standard prescription filename:
 * Rx_{patientName}_{date}.pdf
 */
export function buildPrescriptionFilename(patientName?: string, rxNumberOrDate?: string, date?: string | Date): string {
  const patient = patientName && patientName.trim() ? patientName.trim() : 'Patient';
  const dt = getFormattedDate(date || (rxNumberOrDate && !rxNumberOrDate.startsWith('RX-') ? rxNumberOrDate : undefined));
  return sanitizeFilename(`Rx_${patient}_${dt}.pdf`);
}

/**
 * Standard invoice filename:
 * Invoice_{invoiceNumber}_{patientName}_{date}.pdf
 */
export function buildInvoiceFilename(invoiceNumber?: string, patientName?: string, date?: string | Date): string {
  const docNum = invoiceNumber && invoiceNumber.trim() ? invoiceNumber.trim() : 'INV';
  const patient = patientName && patientName.trim() ? patientName.trim() : 'Patient';
  const dt = getFormattedDate(date);
  return sanitizeFilename(`Invoice_${docNum}_${patient}_${dt}.pdf`);
}

/**
 * Standard receipt filename:
 * Receipt_{receiptNumber}_{patientName}_{date}.pdf
 */
export function buildReceiptFilename(receiptNumber?: string, patientName?: string, date?: string | Date): string {
  const docNum = receiptNumber && receiptNumber.trim() ? receiptNumber.trim() : 'RCP';
  const patient = patientName && patientName.trim() ? patientName.trim() : 'Patient';
  const dt = getFormattedDate(date);
  return sanitizeFilename(`Receipt_${docNum}_${patient}_${dt}.pdf`);
}

/**
 * Renders an HTML DOM element into an A4 PDF Blob.
 * Handles multi-page splitting cleanly when content exceeds one page.
 */
export async function generatePdfBlob(elementOrId: HTMLElement | string): Promise<Blob> {
  const element =
    typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;

  if (!element) {
    throw new Error(`Target printable element "${String(elementOrId)}" not found in DOM.`);
  }

  // Render element canvas at 2x resolution for print-grade clarity
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth || 794,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 6;
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;

  // Convert canvas to mm height
  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;
  const totalHeightMm = (imgHeightPx * contentWidthMm) / imgWidthPx;

  if (totalHeightMm <= contentHeightMm) {
    // Fits comfortably on a single A4 page
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, totalHeightMm);
  } else {
    // Multi-page document: slice canvas page-by-page
    const pxPerMm = imgWidthPx / contentWidthMm;
    const pageHeightPx = Math.floor(contentHeightMm * pxPerMm);
    let renderedHeightPx = 0;
    let pageIndex = 0;

    while (renderedHeightPx < imgHeightPx) {
      if (pageIndex > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - renderedHeightPx);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = imgWidthPx;
      pageCanvas.height = sliceHeightPx;

      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, imgWidthPx, sliceHeightPx);
        pageCtx.drawImage(
          canvas,
          0,
          renderedHeightPx,
          imgWidthPx,
          sliceHeightPx,
          0,
          0,
          imgWidthPx,
          sliceHeightPx
        );

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = (sliceHeightPx * contentWidthMm) / imgWidthPx;
        pdf.addImage(pageImgData, 'JPEG', marginMm, marginMm, contentWidthMm, sliceHeightMm);
      }

      renderedHeightPx += sliceHeightPx;
      pageIndex++;
    }
  }

  return pdf.output('blob');
}

/**
 * Saves a PDF Blob to disk using the File System Access API (showSaveFilePicker)
 * where supported, allowing filename editing.
 * Falls back to an invisible <a> download anchor for unsupported browsers.
 * Never opens the system print dialog.
 */
export async function savePdfWithFilePicker(
  blob: Blob,
  suggestedFilename: string
): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const cleanName = sanitizeFilename(suggestedFilename);

  // 1. Try File System Access API (Chrome, Edge, Opera, Desktop Safari 15.2+)
  if (typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function') {
    try {
      const picker = (window as unknown as {
        showSaveFilePicker: (options: {
          suggestedName: string;
          types: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
      }).showSaveFilePicker;

      const handle = await picker({
        suggestedName: cleanName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User deliberately cancelled the file picker dialog
        return { success: false, canceled: true };
      }
      console.warn('File System Access API failed, falling back to download anchor:', err);
    }
  }

  // 2. Direct browser download fallback (<a download>)
  try {
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = cleanName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return { success: false, error: message };
  }
}
