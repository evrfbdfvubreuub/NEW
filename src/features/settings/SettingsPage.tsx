import { Link } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions, useAppState, useStore } from "@/state/store-context";
import type { ThemePreference } from "@/domain/types";
import { requestNotificationPermission } from "@/infrastructure/browser/notifications";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/version";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { Switch, SegmentedControl } from "@/components/primitives/form";
import { Icon } from "@/components/primitives/Icon";
import { useToast } from "@/components/primitives/Toast";

const CAPABILITY_NOTE: Record<string, string> = {
  UNSUPPORTED: "This browser does not support notifications.",
  DEFAULT: "Enable browser notifications to be reminded at your scheduled times.",
  GRANTED: "Browser notifications are enabled while the app is open or in the background.",
  DENIED: "Notifications are blocked in your browser settings.",
};

function Row({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: JSX.Element;
}): JSX.Element {
  return (
    <div className="setting-row">
      <div className="setting-row__text">
        <span className="label" style={{ fontSize: "var(--fs-sm)" }}>
          {title}
        </span>
        {description ? <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>{description}</span> : null}
      </div>
      {control}
    </div>
  );
}

export function SettingsPage(): JSX.Element | null {
  usePageTitle("Settings");
  const { data, notificationCapability } = useAppState();
  const actions = useActions();
  const store = useStore();
  const toast = useToast();
  if (!data) return null;

  const settings = data.settings;

  const enableNotifications = async (): Promise<void> => {
    const result = await requestNotificationPermission();
    store.refreshNotificationCapability();
    if (result === "GRANTED") {
      await actions.updateSettings({ notificationsEnabled: true });
      toast.show("Notifications enabled.", "success");
    } else if (result === "DENIED") {
      toast.show("Notifications were blocked.", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Settings" />

      <span className="section-title" style={{ display: "block", marginBottom: "var(--space-2)" }}>
        Appearance
      </span>
      <Panel className="card">
        <SegmentedControl<ThemePreference>
          ariaLabel="Theme"
          value={settings.theme}
          onChange={(theme) => void actions.updateSettings({ theme })}
          options={[
            { value: "SYSTEM", label: "System" },
            { value: "DARK", label: "Dark" },
            { value: "LIGHT", label: "Light" },
          ]}
        />
      </Panel>

      <span className="section-title" style={{ display: "block", margin: "var(--space-6) 0 var(--space-2)" }}>
        Notifications
      </span>
      <Panel flush>
        <div className="settings-list">
          <Row
            title="Reminders"
            description={CAPABILITY_NOTE[notificationCapability]}
            control={
              notificationCapability === "GRANTED" ? (
                <Switch
                  label="Enable reminders"
                  checked={settings.notificationsEnabled}
                  onChange={(checked) => void actions.updateSettings({ notificationsEnabled: checked })}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={notificationCapability === "UNSUPPORTED" || notificationCapability === "DENIED"}
                  onClick={() => void enableNotifications()}
                >
                  Enable
                </Button>
              )
            }
          />
          <Row
            title="Sound"
            control={
              <Switch
                label="Enable sound"
                checked={settings.soundEnabled}
                onChange={(checked) => void actions.updateSettings({ soundEnabled: checked })}
              />
            }
          />
          <Row
            title="Vibration"
            description="Where supported by your device."
            control={
              <Switch
                label="Enable vibration"
                checked={settings.vibrationEnabled}
                onChange={(checked) => void actions.updateSettings({ vibrationEnabled: checked })}
              />
            }
          />
        </div>
      </Panel>
      <p className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "var(--space-2)" }}>
        A local-only app cannot guarantee reminders after the browser is fully closed.
      </p>

      <span className="section-title" style={{ display: "block", margin: "var(--space-6) 0 var(--space-2)" }}>
        Data
      </span>
      <Panel flush>
        <div className="settings-list">
          <Link to="/settings/data" className="setting-row">
            <div className="setting-row__text">
              <span className="label" style={{ fontSize: "var(--fs-sm)" }}>
                Export, import & reset
              </span>
              <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                Back up your data as JSON, restore it, or reset everything.
              </span>
            </div>
            <Icon name="chevron-right" />
          </Link>
        </div>
      </Panel>

      <span className="section-title" style={{ display: "block", margin: "var(--space-6) 0 var(--space-2)" }}>
        About
      </span>
      <Panel className="card">
        <div className="stack gap-2">
          <span className="brand" style={{ fontSize: "var(--fs-lg)" }}>
            {APP_NAME}
          </span>
          <span className="muted">{APP_TAGLINE} · v{APP_VERSION}</span>
          <p className="muted">Plan → Execute → Record → Repeat.</p>
          <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            Your data stays in this browser unless you export it. No account, no tracking.
          </p>
        </div>
      </Panel>
    </div>
  );
}
