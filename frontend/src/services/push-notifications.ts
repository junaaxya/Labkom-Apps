import api from "@/services/api";

type PushPublicKeyResponse = {
  success: boolean;
  data: {
    publicKey: string;
    enabled: boolean;
  };
};

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

async function getPublicKey(): Promise<string> {
  const res = await api.get<PushPublicKeyResponse>("/notifications/push/public-key");
  if (!res.data.enabled || !res.data.publicKey) {
    throw new Error("Web Push belum dikonfigurasi di server");
  }
  return res.data.publicKey;
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Browser ini belum mendukung Web Push");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi belum diberikan");
  }

  const publicKey = await getPublicKey();
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(publicKey),
  });

  await api.post("/notifications/push/subscribe", subscription.toJSON());
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  await api.post("/notifications/push/unsubscribe", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export async function syncExistingPushSubscription(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  await api.post("/notifications/push/subscribe", subscription.toJSON());
}
