export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "NotAllowedError") return "The passkey prompt was closed. Try again.";
    return e.message;
  }
  return "Something went wrong. Try again.";
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupported(): boolean {
  return "Notification" in window && ("PushManager" in window || "pushManager" in window);
}

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Push still works through Declarative Web Push on iOS 18.4+
  }
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getPushManager(): Promise<PushManager> {
  // iOS 18.4+ exposes window.pushManager (Declarative Web Push). Others need the service worker.
  const w = window as Window & { pushManager?: PushManager };
  if (w.pushManager) return w.pushManager;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager;
}

async function saveSubscription(sub: PushSubscription) {
  await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
}

/** Call from a tap. Asks permission, subscribes this device, and saves it. */
export async function enablePush(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications weren't allowed. Turn them on in Settings > Notifications > Nudge Me.");
  }
  const pm = await getPushManager();
  let sub = await pm.getSubscription();
  if (!sub) {
    sub = await pm.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidPublicKey) });
  }
  await saveSubscription(sub);
}

/** Re-saves the current subscription on every open, in case it rotated. */
export async function syncPush(vapidPublicKey: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const pm = await getPushManager();
  let sub = await pm.getSubscription();
  if (!sub) {
    sub = await pm.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidPublicKey) });
  }
  await saveSubscription(sub);
}

export function setBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) nav.setAppBadge?.(count).catch(() => {});
  else nav.clearAppBadge?.().catch(() => {});
}

export type Nudge = {
  id: string;
  text: string;
  dueAt: string;
  status: "pending" | "firing" | "done" | "cancelled";
  fireCount: number;
};

export type Me = {
  user: { id: string; name: string };
  vapidPublicKey: string;
  smartParse: boolean;
};
