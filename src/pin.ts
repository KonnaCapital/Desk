export type PinTarget = {
  setAlwaysOnTop(flag: boolean): Promise<void>;
  setResizable(flag: boolean): Promise<void>;
};

export async function applyWindowPin(
  win: PinTarget | null,
  pinned: boolean,
): Promise<void> {
  if (!win) return;
  const results = await Promise.allSettled([
    win.setAlwaysOnTop(pinned), win.setResizable(!pinned),
  ]);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

/** Serialize native changes and skip writes when the requested state is applied. */
export class WindowPinController {
  private applied: boolean | null = null;
  private pending: Promise<void> = Promise.resolve();
  private win: PinTarget | null;

  constructor(win: PinTarget | null) {
    this.win = win;
  }

  apply(pinned: boolean): Promise<void> {
    const next = this.pending.then(async () => {
      if (this.applied === pinned) return;
      this.applied = null;
      await applyWindowPin(this.win, pinned);
      this.applied = pinned;
    });
    this.pending = next.catch(() => {});
    return next;
  }
}
