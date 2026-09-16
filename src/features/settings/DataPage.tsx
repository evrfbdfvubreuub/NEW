import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { usePorts } from "@/state/store-context";
import { buildExport } from "@/application/data-transfer/export";
import { commitImport, validateImport, type ValidatedImport } from "@/application/data-transfer/import";
import { resetAllData } from "@/application/data-transfer/reset";
import { downloadTextFile, exportFilename, readTextFile } from "@/infrastructure/browser/files";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { Dialog } from "@/components/primitives/Dialog";
import { TextInput } from "@/components/primitives/form";
import { useToast } from "@/components/primitives/Toast";

export function DataPage(): JSX.Element {
  usePageTitle("Data");
  const ports = usePorts();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ValidatedImport | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const doExport = async (): Promise<void> => {
    try {
      const envelope = await buildExport(ports);
      downloadTextFile(exportFilename(ports.clock.nowMs()), JSON.stringify(envelope, null, 2));
      toast.show("Export downloaded.", "success");
    } catch {
      toast.show("Export failed.", "error");
    }
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const result = await validateImport(text);
      if (result.ok) setPreview(result.value);
      else toast.show(result.error, "error");
    } catch {
      toast.show("Could not read the file.", "error");
    }
  };

  const confirmImport = async (): Promise<void> => {
    if (!preview) return;
    setBusy(true);
    try {
      await commitImport(ports, preview.snapshot);
      setPreview(null);
      toast.show("Data imported.", "success");
      navigate("/today");
    } catch {
      toast.show("Import failed; your data was not changed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async (): Promise<void> => {
    setBusy(true);
    try {
      await resetAllData(ports);
      setResetOpen(false);
      setResetConfirm("");
      toast.show("All data was reset.", "success");
      navigate("/welcome", { replace: true });
    } catch {
      toast.show("Reset failed; your data was not changed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Data" back={{ to: "/settings", label: "Settings" }} />

      <Panel className="card">
        <div className="row-between">
          <div className="setting-row__text">
            <span className="label" style={{ fontSize: "var(--fs-sm)" }}>Export</span>
            <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Download a full JSON backup of your data.</span>
          </div>
          <Button variant="primary" icon="download" onClick={() => void doExport()}>Export JSON</Button>
        </div>
      </Panel>

      <Panel className="card">
        <div className="row-between">
          <div className="setting-row__text">
            <span className="label" style={{ fontSize: "var(--fs-sm)" }}>Import</span>
            <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Restore from a JSON backup. This replaces all current data.</span>
          </div>
          <Button variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>Import JSON</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" onChange={onFile} />
        </div>
      </Panel>

      <Panel className="card" style={{ borderColor: "var(--missed)" }}>
        <div className="row-between">
          <div className="setting-row__text">
            <span className="label" style={{ fontSize: "var(--fs-sm)" }}>Reset all data</span>
            <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Permanently delete every commitment, record, and session.</span>
          </div>
          <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>Reset</Button>
        </div>
      </Panel>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Replace all data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="primary" disabled={busy} onClick={() => void confirmImport()}>Replace all data</Button>
          </>
        }
      >
        {preview ? (
          <div className="stack gap-2">
            <p className="muted">Importing will replace everything currently stored in this browser.</p>
            <ul className="stack gap-1 muted" style={{ fontSize: "var(--fs-sm)" }}>
              <li>{preview.preview.commitments} commitments</li>
              <li>{preview.preview.records} day records</li>
              <li>{preview.preview.sessions} timer sessions</li>
              <li>Exported {new Date(preview.preview.exportedAt).toLocaleString()}</li>
            </ul>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={busy || resetConfirm !== "RESET"} onClick={() => void confirmReset()}>
              Reset everything
            </Button>
          </>
        }
      >
        <div className="stack gap-3">
          <p className="muted">
            This permanently deletes all commitments and history in this browser. Consider exporting
            first. Type <strong>RESET</strong> to confirm.
          </p>
          <TextInput aria-label="Type RESET to confirm" value={resetConfirm} onChange={(e) => setResetConfirm(e.currentTarget.value)} placeholder="RESET" />
        </div>
      </Dialog>
    </div>
  );
}
