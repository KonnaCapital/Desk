import { Store, createMemoryPersist, createTauriPersist } from "./store.ts";
import { mountBoard } from "./board.ts";
import { mountChrome } from "./chrome.ts";
import { mountTimer } from "./timer.ts";
import { mountClockKeys } from "./clock-keys.ts";
import { initI18n, t } from "./i18n.ts";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

function beep() {
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.7);
  osc.onended = () => void ctx.close();
}

async function notifyDone() {
  beep();
  try {
    const notification = await import("@tauri-apps/plugin-notification");
    const granted = await notification.isPermissionGranted();
    if (!granted) {
      const permission = await notification.requestPermission();
      if (permission !== "granted") return;
    }
    await notification.sendNotification({
      title: "Desk",
      body: t("timerDone"),
    });
  } catch {
    // Browser preview: sound is enough.
  }
}

/** Mirror the clock into the window title so the taskbar and Alt-Tab show it. */
function createTitleSync(): (title: string) => void {
  let current = document.title;
  let pending = Promise.resolve();
  return (title) => {
    if (title === current) return;
    current = title;
    document.title = title;
    if (!isTauri()) return;
    pending = pending.then(async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setTitle(title);
      } catch {
        // The taskbar keeps its last title.
      }
    });
  };
}

async function boot() {
  initI18n();
  const persist = isTauri() ? await createTauriPersist() : createMemoryPersist();
  const store = await Store.load(persist);

  await mountChrome(store);
  mountBoard(store);
  mountTimer(
    store,
    () => {
      void notifyDone();
    },
    createTitleSync(),
  );
  mountClockKeys(store);

  const flush = () => {
    void store.flush();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("beforeunload", flush);
}

void boot();
