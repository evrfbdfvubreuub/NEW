// File download / upload helpers for JSON export & import (Blueprint §U).
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType = "application/json",
): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Release the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}

/** Export filename with a UTC timestamp, e.g. the-architect-export-20260916T143000Z.json */
export function exportFilename(nowMs: number): string {
  const stamp = new Date(nowMs)
    .toISOString() // 2026-09-16T14:30:00.000Z
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z"); // 20260916T143000Z
  return `the-architect-export-${stamp}.json`;
}
