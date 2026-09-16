// Create commitment use-case (Blueprint §A4): validate, build the immutable
// aggregate, and persist the commitment + all day records in ONE transaction.
import type { Commitment } from "@/domain/types";
import {
  buildCommitmentAggregate,
  validateCommitmentForm,
  type CommitmentFormErrors,
  type CommitmentFormInput,
} from "@/domain/commitments/commitment";
import type { AppPorts } from "../ports";

export type CreateCommitmentResult =
  | { ok: true; commitment: Commitment }
  | { ok: false; errors: CommitmentFormErrors };

export async function createCommitment(
  ports: AppPorts,
  form: CommitmentFormInput,
): Promise<CreateCommitmentResult> {
  const validation = validateCommitmentForm(form);
  if (!validation.valid || !validation.normalized) {
    return { ok: false, errors: validation.errors };
  }

  const { commitment, records } = buildCommitmentAggregate(validation.normalized, {
    nowMs: ports.clock.nowMs(),
    timeZone: ports.timeZone(),
    newId: ports.newId,
  });

  const tx = ports.db.transaction(["commitments", "dayRecords"], "readwrite");
  await tx.objectStore("commitments").put(commitment);
  const recordStore = tx.objectStore("dayRecords");
  for (const record of records) {
    await recordStore.put(record);
  }
  await tx.done;

  ports.onChanged?.();
  return { ok: true, commitment };
}
