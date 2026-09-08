import type { FlushOutcome } from "./store.ts";

export const CLOSE_FLUSH_TIMEOUT_MS = 2_000;

export type CloseFlushResult = "flushed" | "timed-out" | "failed";

export type CloseFlush = () => Promise<void | FlushOutcome>;

export type CloseRequestEvent = {
  preventDefault(): void;
};

export type CloseWindow = {
  onCloseRequested(
    handler: (event: CloseRequestEvent) => void | Promise<void>,
  ): Promise<() => void>;
  destroy(): Promise<void>;
};

export type CloseRegistration = {
  registered: boolean;
  requestClose(): Promise<void>;
};

export type CloseDecision = "retry" | "discard" | "keep-open";

export function flushWithTimeout(
  flush: CloseFlush,
  timeoutMs = CLOSE_FLUSH_TIMEOUT_MS,
): Promise<CloseFlushResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: CloseFlushResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve(result);
    };

    timeoutId = setTimeout(() => finish("timed-out"), Math.max(0, timeoutMs));
    void Promise.resolve()
      .then(flush)
      .then((outcome) => finish(outcome === "error" ? "failed" : "flushed"), () =>
        finish("failed"),
      );
  });
}

export async function registerCloseHandler(
  current: CloseWindow,
  flush: CloseFlush,
  onProblem: (
    result: Exclude<CloseFlushResult, "flushed">,
  ) => CloseDecision | void | Promise<CloseDecision | void>,
  timeoutMs = CLOSE_FLUSH_TIMEOUT_MS,
): Promise<CloseRegistration> {
  let closing = false;
  const requestClose = async () => {
    if (closing) return;
    closing = true;
    try {
      while (true) {
        const result = await flushWithTimeout(flush, timeoutMs);
        if (result === "flushed") break;
        const decision = await onProblem(result);
        if (decision === "retry") continue;
        if (decision !== "discard") return;
        break;
      }
      await current.destroy();
    } catch {
      // A failed prompt or native operation must leave the window available.
    } finally {
      closing = false;
    }
  };
  try {
    await current.onCloseRequested((event) => {
      event.preventDefault();
      return requestClose();
    });
    return { registered: true, requestClose };
  } catch {
    return { registered: false, requestClose };
  }
}
