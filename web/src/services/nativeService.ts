import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NativeShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export interface NativeSavePdfResult {
  success: boolean;
  filename?: string;
  path?: string;
  uri?: string;
  sizeBytes?: number;
  error?: string;
}

export interface NativeCallPromptData {
  callEventId: string;
  phoneNumber: string;
  ownerName?: string;
  patientName?: string;
  durationSeconds: number;
  action?: string;
  timestamp: number;
}

export interface VetRxNativePluginInterface {
  savePdfToDownloads(options: { base64Data: string; filename: string; title?: string }): Promise<{
    success: boolean;
    filename: string;
    path: string;
    uri: string;
    sizeBytes: number;
  }>;
  openPdfFile(options: { uri?: string; path?: string; base64Data?: string; filename?: string }): Promise<{ success: boolean }>;
  printPdf(options: { base64Data: string; title?: string }): Promise<{ success: boolean }>;
  sharePdf(options: {
    base64Data: string;
    filename: string;
    title?: string;
    text?: string;
    targetApp?: string;
  }): Promise<{ success: boolean; target?: string; fallback?: boolean; message?: string }>;
  getPendingCallPrompt(): Promise<{ hasPrompt: boolean; prompt?: NativeCallPromptData }>;
  dismissPendingCallPrompt(): Promise<{ success: boolean }>;
  addListener(eventName: 'callEnded', listenerFunc: (data: NativeCallPromptData) => void): Promise<any>;
}

export const VetRxNative = registerPlugin<VetRxNativePluginInterface>('VetRxNative');

/**
 * Utility helper to encode Blob as Base64 string for plugin bridge transfer.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Node.js runtime / test environment fallback
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined'
    ? btoa(binary)
    : (globalThis as any).Buffer?.from(buffer).toString('base64') || '';
}

/**
 * Native integration service for VetRx Android and mobile platforms.
 * Handles system back navigation, status bar styling, native share sheets,
 * real PDF filesystem export to Downloads, native PrintManager printing,
 * file attachment sharing (PDF & WhatsApp), haptics, dialer intents, and maps routing.
 */
class NativeService {
  private isInitialized = false;

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Initialize native Android listeners and status bar configurations.
   */
  public async initNativeApp(): Promise<void> {
    if (this.isInitialized || !this.isNative()) {
      return;
    }
    this.isInitialized = true;

    try {
      // 1. Configure Android status bar to match VetRx teal identity
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00685F' });
    } catch (err) {
      console.warn('[NativeService] StatusBar init error:', err);
    }

    try {
      // 2. Hardware Android Back Button Handling
      await App.addListener('backButton', ({ canGoBack }) => {
        const activeModal = document.querySelector(
          '[role="dialog"], .modal-overlay, .modal-backdrop, .dialog-backdrop, .cvp-modal-overlay'
        );
        if (activeModal) {
          const closeBtn = activeModal.querySelector<HTMLElement>(
            'button[aria-label="Close"], button.modal-close, button.close-btn, button:has(.fa-times), button:has(svg)'
          );
          if (closeBtn) {
            closeBtn.click();
            return;
          }
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          return;
        }

        const activeDropdown = document.querySelector<HTMLElement>(
          '.profile-dropdown, .notifications-dropdown, .action-menu-dropdown, .combobox-dropdown'
        );
        if (activeDropdown && activeDropdown.style.display !== 'none') {
          window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }

        const currentPath = window.location.pathname;
        const isRoot = currentPath === '/' || currentPath === '/dashboard' || currentPath === '/login';

        if (!isRoot) {
          window.history.back();
          return;
        }

        if (!canGoBack || isRoot) {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
    } catch (err) {
      console.warn('[NativeService] BackButton listener init error:', err);
    }
  }

  /**
   * Native Android Save PDF to User-Accessible Downloads Directory.
   * Ensures physical file write, verifies path and non-zero byte size before returning.
   */
  public async savePdfToDownloads(base64Data: string, filename: string, title?: string): Promise<NativeSavePdfResult> {
    if (!this.isNative()) {
      return { success: false, error: 'Native platform not active' };
    }
    try {
      const res = await VetRxNative.savePdfToDownloads({ base64Data, filename, title });
      if (res && res.success && res.sizeBytes > 0) {
        return {
          success: true,
          filename: res.filename,
          path: res.path,
          uri: res.uri,
          sizeBytes: res.sizeBytes,
        };
      }
      return { success: false, error: 'PDF export produced an empty file (0 bytes).' };
    } catch (err) {
      console.error('[NativeService] savePdfToDownloads error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to write PDF to Downloads';
      return { success: false, error: msg };
    }
  }

  /**
   * Opens a PDF file in Android's default viewer app.
   */
  public async openPdf(options: { uri?: string; path?: string; base64Data?: string; filename?: string }): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const res = await VetRxNative.openPdfFile(options);
      return Boolean(res?.success);
    } catch (err) {
      console.error('[NativeService] openPdf error:', err);
      return false;
    }
  }

  /**
   * Opens Android system print dialogue using PrintManager.
   */
  public async printPdf(base64Data: string, title: string = 'VetRx Document'): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const res = await VetRxNative.printPdf({ base64Data, title });
      return Boolean(res?.success);
    } catch (err) {
      console.error('[NativeService] printPdf error:', err);
      throw err;
    }
  }

  /**
   * Native file attachment sharing (real PDF with application/pdf MIME type)
   * or direct WhatsApp document attachment.
   */
  public async sharePdfFile(options: {
    base64Data: string;
    filename: string;
    title?: string;
    text?: string;
    targetApp?: 'whatsapp';
  }): Promise<{ success: boolean; fallback?: boolean; message?: string }> {
    if (!this.isNative()) {
      return { success: false, message: 'Native platform not active' };
    }
    try {
      const res = await VetRxNative.sharePdf({
        base64Data: options.base64Data,
        filename: options.filename,
        title: options.title,
        text: options.text,
        targetApp: options.targetApp,
      });
      return {
        success: Boolean(res?.success),
        fallback: res?.fallback,
        message: res?.message,
      };
    } catch (err) {
      console.error('[NativeService] sharePdfFile error:', err);
      const msg = err instanceof Error ? err.message : 'Sharing failed';
      return { success: false, message: msg };
    }
  }

  /**
   * Native Share sheet integration for web links / text fallback.
   */
  public async shareDocument(options: NativeShareOptions): Promise<boolean> {
    const { title = 'VetRx Document', text = '', url = '', dialogTitle = 'Share with VetRx' } = options;

    if (this.isNative()) {
      try {
        await Share.share({
          title,
          text,
          url,
          dialogTitle,
        });
        return true;
      } catch (err) {
        console.warn('[NativeService] Native Share failed, falling back:', err);
      }
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ title, text, url })) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (err) {
        console.warn('[NativeService] Web navigator.share failed:', err);
      }
    }

    return false;
  }

  /**
   * Check for a pending telephony call registration session.
   */
  public async getPendingCallPrompt(): Promise<NativeCallPromptData | null> {
    if (!this.isNative()) return null;
    try {
      const res = await VetRxNative.getPendingCallPrompt();
      if (res?.hasPrompt && res.prompt) {
        return res.prompt;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Dismiss/clear pending call prompt in native layer.
   */
  public async dismissPendingCallPrompt(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await VetRxNative.dismissPendingCallPrompt();
    } catch {}
  }

  /**
   * Register a listener for real-time post-call prompt events.
   */
  public async addCallEndedListener(listener: (data: NativeCallPromptData) => void): Promise<() => void> {
    if (!this.isNative()) return () => {};
    try {
      const handle = await VetRxNative.addListener('callEnded', listener);
      return () => {
        handle.remove();
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Subtle haptic feedback for phone interactions.
   */
  public async triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'selection' = 'light'): Promise<void> {
    if (!this.isNative()) return;
    try {
      if (style === 'selection') {
        await Haptics.selectionChanged();
      } else {
        const impactStyle =
          style === 'heavy' ? ImpactStyle.Heavy : style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style: impactStyle });
      }
    } catch {}
  }

  /**
   * Launch native phone dialer for owner contact.
   */
  public openDialer(phone: string): void {
    if (!phone) return;
    const cleanNumber = phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanNumber}`;
  }

  /**
   * Launch Google Maps / native navigation for owner or visit location.
   */
  public openMaps(queryOrCoordinates: string): void {
    if (!queryOrCoordinates) return;
    const encoded = encodeURIComponent(queryOrCoordinates);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(url, '_system');
  }
}

export const nativeService = new NativeService();
