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

  const atomicSelectors = [
    '.avoid-break',
    '.signature-block',
    'tr',
    '.medication-row',
    '.stationery-signalment-grid',
    '.stationery-findings-box',
    '.stationery-advice-grid',
    '.invoice-print-ledger-and-signoff',
    '.invoice-print-ledger-grid',
    '.invoice-print-footer-wrap',
    '.invoice-print-signature-section',
  ];

  interface AvoidBreakBox {
    topPx: number;
    bottomPx: number;
  }

  const avoidBoxes: AvoidBreakBox[] = [];

  // Render element canvas at 2x resolution for print-grade clarity
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1200,
    onclone: (clonedDoc) => {
      const target = (typeof elementOrId === 'string'
        ? clonedDoc.getElementById(elementOrId)
        : clonedDoc.getElementById(element.id)) ||
        (element.className ? clonedDoc.querySelector(`.${element.className.split(' ')[0]}`) : null);

      if (target) {
        // Expand any narrow flex/grid workspace parents in the cloned document so sheet has true 794px width
        let parent = target.parentElement;
        while (parent && parent !== clonedDoc.body) {
          parent.style.width = '1200px';
          parent.style.maxWidth = 'none';
          parent.style.display = 'block';
          parent = parent.parentElement;
        }

        (target as HTMLElement).style.width = '794px';
        (target as HTMLElement).style.maxWidth = '794px';
        (target as HTMLElement).style.minWidth = '794px';
        (target as HTMLElement).style.boxSizing = 'border-box';

        // Measure avoidBoxes in the EXACT cloned target that html2canvas renders
        const targetRect = target.getBoundingClientRect();
        target.querySelectorAll(atomicSelectors.join(',')).forEach((el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const topPx = Math.round((rect.top - targetRect.top) * 2);
          const bottomPx = Math.round((rect.bottom - targetRect.top) * 2);
          if (bottomPx > topPx) {
            avoidBoxes.push({ topPx, bottomPx });
          }
        });
      }
    },
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

  // If height fits within page height (allowing 3mm tolerance for subpixel margins)
  if (totalHeightMm <= contentHeightMm + 3) {
    // Fits comfortably on a single A4 page
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const renderHeightMm = Math.min(contentHeightMm, totalHeightMm);
    pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, renderHeightMm);
  } else {
    // Multi-page document: smart boundary-aware canvas slicing
    const pxPerMm = imgWidthPx / contentWidthMm;
    const pageHeightPx = Math.floor(contentHeightMm * pxPerMm);

    let renderedHeightPx = 0;
    let pageIndex = 0;

    while (renderedHeightPx < imgHeightPx) {
      if (pageIndex > 0) {
        pdf.addPage('a4', 'portrait');
      }

      let sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - renderedHeightPx);
      const tentativeCutPx = renderedHeightPx + sliceHeightPx;

      // If this slice doesn't reach the end, verify if cut line intersects an indivisible block
      if (tentativeCutPx < imgHeightPx) {
        const intersectingBoxes = avoidBoxes.filter(
          (b) =>
            b.topPx < tentativeCutPx &&
            b.bottomPx > tentativeCutPx &&
            b.topPx > renderedHeightPx + pageHeightPx * 0.25
        );

        if (intersectingBoxes.length > 0) {
          // Adjust cut line to just above the earliest intersecting element
          const earliestTop = Math.min(...intersectingBoxes.map((b) => b.topPx));
          const adjustedSlice = Math.floor(earliestTop - renderedHeightPx);
          if (adjustedSlice > 0) {
            sliceHeightPx = adjustedSlice;
          }
        }

        // Guard against orphan signature fragment on trailing page:
        // If remaining content after cut is very small (< 130px at 2x scale),
        // pull the cut earlier so preceding card (advice/ledger/item) moves together with sign-off
        const remainingAfterCut = imgHeightPx - (renderedHeightPx + sliceHeightPx);
        if (remainingAfterCut > 0 && remainingAfterCut < 130 * 2) {
          const prevBoxes = avoidBoxes
            .filter((b) => b.bottomPx <= (renderedHeightPx + sliceHeightPx) && b.topPx > renderedHeightPx + pageHeightPx * 0.3)
            .sort((a, b) => b.topPx - a.topPx);
          if (prevBoxes.length > 0) {
            const pullBackSlice = Math.floor(prevBoxes[0].topPx - renderedHeightPx);
            if (pullBackSlice > pageHeightPx * 0.25) {
              sliceHeightPx = pullBackSlice;
            }
          }
        }
      }

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

if (typeof window !== 'undefined') {
  (window as any).generatePdfBlob = generatePdfBlob;
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
