import { useEffect, useRef } from "react";
import { useAppState, usePorts } from "@/state/store-context";
import {
  claimReminder,
  collectDueReminders,
  markReminderDelivered,
} from "@/application/reminders/reminders";
import { showSystemNotification } from "@/infrastructure/browser/notifications";
import { playCue, vibrate } from "@/infrastructure/browser/feedback";
import { useToast } from "@/components/primitives/Toast";

/** Delivers in-app reminders while the app is open (Blueprint §K1). */
export function ReminderHost(): null {
  const { data, nowMs, notificationCapability } = useAppState();
  const ports = usePorts();
  const toast = useToast();
  const processing = useRef(false);
  const lastProcessedMs = useRef(0);

  const settings = data?.settings;

  useEffect(() => {
    if (!settings) return;
    if (processing.current) return;
    // Throttle DB scans to ~10s even while the render tick runs at 250ms.
    if (nowMs - lastProcessedMs.current < 10_000) return;
    lastProcessedMs.current = nowMs;
    processing.current = true;

    void (async () => {
      try {
        const due = await collectDueReminders(ports, nowMs);
        for (const reminder of due) {
          const won = await claimReminder(ports, reminder, nowMs);
          if (!won) continue;
          toast.show(`Reminder: ${reminder.commitmentName}`, "info");
          if (settings.notificationsEnabled && notificationCapability === "GRANTED") {
            showSystemNotification("THE ARCHITECT", `Time to work on ${reminder.commitmentName}.`);
          }
          if (settings.soundEnabled) playCue("reminder");
          if (settings.vibrationEnabled) vibrate(120);
          await markReminderDelivered(ports, reminder.occurrenceId, nowMs);
        }
      } finally {
        processing.current = false;
      }
    })();
  }, [nowMs, settings, notificationCapability, ports, toast]);

  return null;
}
