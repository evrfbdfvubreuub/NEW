// Temporal adapter (Blueprint §B1, §I1): prefer native Temporal, fall back to polyfill.
import { Temporal as TemporalPolyfill } from "@js-temporal/polyfill";

type TemporalNamespace = typeof TemporalPolyfill;

const nativeTemporal = (globalThis as unknown as { Temporal?: TemporalNamespace })
  .Temporal;

export const Temporal: TemporalNamespace = nativeTemporal ?? TemporalPolyfill;

// Re-export the *type* namespace so annotations like TemporalTypes.PlainDate work.
export type { Temporal as TemporalTypes } from "@js-temporal/polyfill";
