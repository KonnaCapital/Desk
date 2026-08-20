import type { PersistenceStatus } from "./store.ts";

export type PersistChromeCopy = {
  text: string | null;
  hideAfterMs: number;
};

export function persistChromeCopy(
  status: PersistenceStatus,
  closeMessage: string | null,
  dataPath: string,
  allowSavedFlash: boolean,
): PersistChromeCopy {
  if (closeMessage) return { text: closeMessage, hideAfterMs: 0 };
  if (status === "saving") return { text: "Saving…", hideAfterMs: 0 };
  if (status === "recovered") return { text: "Recovered from backup.", hideAfterMs: 0 };
  if (status === "error") {
    return { text: `Desk data could not be saved. Data path: ${dataPath}`, hideAfterMs: 0 };
  }
  if (status === "saved" && allowSavedFlash) return { text: "Saved", hideAfterMs: 700 };
  return { text: null, hideAfterMs: 0 };
}
