export type PinTarget = {
  setAlwaysOnTop(flag: boolean): Promise<void>;
  setResizable(flag: boolean): Promise<void>;
};

export async function applyWindowPin(
  win: PinTarget | null,
  pinned: boolean,
): Promise<void> {
  if (!win) return;
  await Promise.all([win.setAlwaysOnTop(pinned), win.setResizable(!pinned)]);
}
