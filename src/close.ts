export const CLOSE_FLUSH_TIMEOUT_MS = 2_000;

export type CloseFlushResult = "flushed" | "timed-out" | "failed";

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

export function flushWithTimeout(
  flush: () => Promise<void>,
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
      .then(
        () => finish("flushed"),
        () => finish("failed"),
      );
  });
}

export async function registerCloseHandler(
  current: CloseWindow,
  flush: () => Promise<void>,
  onProblem: (result: Exclude<CloseFlushResult, "flushed">) => void,
  timeoutMs = CLOSE_FLUSH_TIMEOUT_MS,
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
        if (result !== "flushed") onProblem(result);
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
