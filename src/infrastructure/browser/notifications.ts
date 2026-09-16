// Notification capability + delivery (Blueprint §K). Honest about limits:
// reliable only while a page runtime can execute; no closed-process guarantee.
export type NotificationCapability = "UNSUPPORTED" | "DEFAULT" | "GRANTED" | "DENIED";

function hasNotificationApi(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationCapability(): NotificationCapability {
  if (!hasNotificationApi()) return "UNSUPPORTED";
  switch (Notification.permission) {
    case "granted":
      return "GRANTED";
    case "denied":
      return "DENIED";
    default:
      return "DEFAULT";
  }
}

export async function requestNotificationPermission(): Promise<NotificationCapability> {
  if (!hasNotificationApi()) return "UNSUPPORTED";
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") return "GRANTED";
    if (result === "denied") return "DENIED";
    return "DEFAULT";
  } catch {
    return getNotificationCapability();
  }
}

export function showSystemNotification(title: string, body: string): boolean {
  if (!hasNotificationApi() || Notification.permission !== "granted") return false;
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: "architect-reminder" });
    return true;
  } catch {
    return false;
  }
}
