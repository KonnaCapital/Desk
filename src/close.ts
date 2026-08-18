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
};

export type PaintWaiter = () => Promise<void>;

export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(finish, 16);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(finish);
  });
}

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
  ) => void | Promise<void>,
  timeoutMs = CLOSE_FLUSH_TIMEOUT_MS,
  paint: PaintWaiter = waitForPaint,
): Promise<CloseRegistration> {
  let closing = false;
  try {
    await current.onCloseRequested(async (event) => {
      if (closing) {
        event.preventDefault();
        return;
      }
      closing = true;
      event.preventDefault();
      const result = await flushWithTimeout(flush, timeoutMs);
      try {
        if (result !== "flushed") {
          try {
            await onProblem(result);
          } catch {
            // Close must proceed if status rendering fails.
          }
          try {
            await paint();
          } catch {
            // Close must proceed if the paint opportunity fails.
          }
        }
      } finally {
        try {
          await current.destroy();
        } catch {
          closing = false;
        }
      }
    });
    return { registered: true };
  } catch {
    return { registered: false };
  }
}
