import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import api from "@/services/api";

const TOKEN_KEY = "labkom:native-push-token";
let listenersReady = false;

export function isNativePushSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function hasNativePushToken(): boolean {
  return Boolean(typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY));
}

function openNotificationLink(data: Record<string, unknown> | undefined): void {
  const link = typeof data?.link === "string" && data.link.startsWith("/") ? data.link : "/notifications";
  window.location.assign(link);
}

export async function initializeNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !localStorage.getItem("token")) return;

  await PushNotifications.createChannel({
    id: "labkom_notifications",
    name: "Notifikasi LabKom",
    description: "Jadwal, ticket, kunci, misi, dan pemberitahuan LabKom",
    importance: 5,
    visibility: 1,
    sound: "default",
  });

  if (!listenersReady) {
    await PushNotifications.addListener("registration", async (token: Token) => {
      localStorage.setItem(TOKEN_KEY, token.value);
      await api.post("/notifications/push/native/register", {
        token: token.value,
        platform: Capacitor.getPlatform(),
        deviceName: navigator.userAgent.slice(0, 160),
      });
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      openNotificationLink(event.notification.data);
    });
    listenersReady = true;
  }

  const permission = await PushNotifications.checkPermissions();
  const status = permission.receive === "prompt"
    ? await PushNotifications.requestPermissions()
    : permission;
  if (status.receive !== "granted") return;
  await PushNotifications.register();
}

export async function unregisterNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) await api.post("/notifications/push/native/unregister", { token }).catch(() => undefined);
  localStorage.removeItem(TOKEN_KEY);
  await PushNotifications.removeAllListeners();
  listenersReady = false;
}
