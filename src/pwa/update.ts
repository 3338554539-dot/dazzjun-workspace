import { registerSW } from "virtual:pwa-register";

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function setupPWAUpdate() {
  if (!("serviceWorker" in navigator)) return;
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() { window.dispatchEvent(new Event("dazzjun:pwa-update")); },
  });
}

export async function applyPWAUpdate() {
  await updateServiceWorker?.(true);
}
