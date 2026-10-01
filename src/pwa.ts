import { registerSW } from 'virtual:pwa-register';

let deferredPrompt: any = null;
let updateSWHandler: ((reloadPage?: boolean) => Promise<void>) | null = null;
let onInstallAvailableCallback: (() => void) | null = null;

export function initPWA(options?: {
  onNeedRefresh?: (update: () => void) => void;
  onOfflineReady?: () => void;
}) {
  if ('serviceWorker' in navigator) {
    updateSWHandler = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (options?.onNeedRefresh && updateSWHandler) {
          options.onNeedRefresh(() => updateSWHandler!(true));
        }
      },
      onOfflineReady() {
        if (options?.onOfflineReady) {
          options.onOfflineReady();
        }
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (onInstallAvailableCallback) {
      onInstallAvailableCallback();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (onInstallAvailableCallback) {
      onInstallAvailableCallback();
    }
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export function canInstallPWA(): boolean {
  return !isStandalone() && deferredPrompt !== null;
}

export function onInstallAvailable(cb: () => void) {
  onInstallAvailableCallback = cb;
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (onInstallAvailableCallback) {
    onInstallAvailableCallback();
  }
  return choiceResult.outcome === 'accepted';
}
