import { useEffect, useState } from "react";
import type { TimerSession } from "@/domain/types";
import { getSessionsByRecord } from "@/infrastructure/db/repositories";
import { useAppState, usePorts } from "@/state/store-context";

/** Loads a record's timer sessions on demand; refreshes when store data changes. */
export function useRecordSessions(recordId: string | undefined): TimerSession[] {
  const ports = usePorts();
  const { data } = useAppState();
  const [sessions, setSessions] = useState<TimerSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!recordId) {
      setSessions([]);
      return;
    }
    getSessionsByRecord(ports.db, recordId)
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, ports.db, data]);

  return sessions;
}
