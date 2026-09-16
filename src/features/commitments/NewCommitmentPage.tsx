import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions, useAppState } from "@/state/store-context";
import type { CommitmentFormErrors } from "@/domain/commitments/commitment";
import { addDaysISO, formatDateMedium, todayISOInZone } from "@/domain/time/calendar";
import { currentTimeZone } from "@/infrastructure/browser/system";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/primitives/Panel";
import { Button, IconButton } from "@/components/primitives/Button";
import { Field, TextInput } from "@/components/primitives/form";
import { Icon } from "@/components/primitives/Icon";

export function NewCommitmentPage(): JSX.Element {
  usePageTitle("New commitment");
  const { nowMs } = useAppState();
  const actions = useActions();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [errors, setErrors] = useState<CommitmentFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const startDate = todayISOInZone(nowMs, currentTimeZone());
  const endDate = addDaysISO(startDate, Math.max(0, (Number(durationDays) || 1) - 1));

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    const result = await actions.createCommitment({
      name,
      targetHours: Number(hours) || 0,
      targetMinutes: Number(minutes) || 0,
      durationDays: Number(durationDays) || 0,
      reminderTimes,
    });
    setSubmitting(false);
    if (result.ok) navigate(`/commitments/${result.commitment.id}`, { replace: true });
    else setErrors(result.errors);
  };

  const updateReminder = (index: number, value: string): void =>
    setReminderTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  const addReminder = (): void => setReminderTimes((prev) => (prev.length < 10 ? [...prev, "09:00"] : prev));
  const removeReminder = (index: number): void =>
    setReminderTimes((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <PageHeader title="New commitment" back={{ to: "/commitments", label: "Commitments" }} />
      <form onSubmit={submit}>
        <Panel className="form-grid">
          <Field label="Commitment name" htmlFor="name" error={errors.name}>
            <TextInput
              id="name"
              value={name}
              maxLength={80}
              placeholder="e.g. Study Electronics"
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </Field>

          <Field label="Daily target" error={errors.target} hint="At least 1 minute, up to 24 hours.">
            <div className="target-inputs">
              <TextInput
                aria-label="Target hours"
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.max(0, Math.min(24, Number(e.currentTarget.value))))}
              />
              <TextInput
                aria-label="Target minutes"
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.currentTarget.value))))}
              />
            </div>
          </Field>

          <Field
            label="Duration (days)"
            htmlFor="duration"
            error={errors.durationDays}
            hint={`Starts today · ends ${formatDateMedium(endDate)}`}
          >
            <TextInput
              id="duration"
              type="number"
              min={1}
              max={3650}
              value={durationDays}
              onChange={(e) => setDurationDays(Math.max(1, Math.min(3650, Number(e.currentTarget.value))))}
            />
          </Field>

          <Field label="Reminder times (optional)" error={errors.reminderTimes}>
            <div className="stack gap-2">
              {reminderTimes.map((time, index) => (
                <div className="reminder-row" key={index}>
                  <TextInput
                    aria-label={`Reminder ${index + 1}`}
                    type="time"
                    value={time}
                    onChange={(e) => updateReminder(index, e.currentTarget.value)}
                  />
                  <IconButton icon="trash" label={`Remove reminder ${index + 1}`} onClick={() => removeReminder(index)} />
                </div>
              ))}
              {reminderTimes.length < 10 ? (
                <Button variant="ghost" size="sm" icon="plus" onClick={addReminder}>
                  Add reminder
                </Button>
              ) : null}
            </div>
          </Field>

          <div className="banner banner--info" role="note">
            <Icon name="lock" size={18} />
            <span>
              Once started, this commitment is fixed. Name, target, duration, and dates cannot be
              changed. Create a new commitment for different parameters.
            </span>
          </div>

          <Button type="submit" variant="primary" size="lg" block disabled={submitting}>
            Start commitment
          </Button>
        </Panel>
      </form>
    </div>
  );
}
