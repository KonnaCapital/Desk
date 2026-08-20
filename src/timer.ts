import { PRESETS, clockParts, hoursToDurationMs, remainingMs } from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

export function mountTimer(store: Store, onComplete: () => void): void {
  const digits = document.querySelector<HTMLButtonElement>("#clock-digits")!;
  const hoursEl = document.querySelector<HTMLElement>(".clock-hours")!;
  const minsEl = document.querySelector<HTMLElement>(".clock-mins")!;
  const secsEl = document.querySelector<HTMLElement>(".clock-secs")!;
  const progressFill = document.querySelector<HTMLElement>("#clock-progress-fill")!;
  const presetsEl = document.querySelector<HTMLElement>("#clock-presets")!;
  const form = document.querySelector<HTMLFormElement>("#custom-duration")!;
  const hoursInput = document.querySelector<HTMLInputElement>("#hours-input")!;
  const minsInput = document.querySelector<HTMLInputElement>("#mins-input")!;
  const durationStatus = document.querySelector<HTMLElement>("#clock-duration-status")!;
  const toggle = document.querySelector<HTMLButtonElement>("#timer-toggle")!;
  const reset = document.querySelector<HTMLButtonElement>("#timer-reset")!;

  presetsEl.innerHTML = PRESETS.map(
    (preset) =>
      `<button type="button" data-ms="${preset.ms}">${preset.label}</button>`,
  ).join("");

  presetsEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-ms]");
    if (!btn) return;
    store.setDuration(Number(btn.dataset.ms));
    durationStatus.textContent = "";
    durationStatus.classList.add("hidden");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const hours = Number(hoursInput.value || 0);
    const minutes = Number(minsInput.value || 0);
    const applied = store.setDuration(hoursToDurationMs(hours, minutes));
    durationStatus.textContent = applied ? "" : t("durationTooShort");
    durationStatus.classList.toggle("hidden", applied);
  });

  toggle.addEventListener("click", () => {
    if (store.state.timer.running) store.pauseTimer();
    else store.startTimer();
  });

  reset.addEventListener("click", () => store.resetTimer());

  digits.addEventListener("click", () => {
    if (store.state.timer.running) store.pauseTimer();
    else store.startTimer();
  });

  let completedFor: number | null = null;
  let refreshTimer: number | null = null;

  function paint(now = Date.now()) {
    const { timer } = store.state;
    const rem = remainingMs(timer, now);
    const parts = clockParts(rem);
    hoursEl.hidden = parts.hours === null;
    hoursEl.textContent = parts.hours ?? "";
    minsEl.textContent = parts.minutes;
    secsEl.textContent = parts.seconds;
    digits.classList.toggle("running", timer.running);
    digits.classList.toggle("done", rem === 0 && !timer.running);
    document.body.dataset.timer = timer.running ? "running" : rem === 0 ? "done" : "idle";
    const ratio = timer.durationMs > 0 ? rem / timer.durationMs : 0;
    progressFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    toggle.textContent = timer.running ? t("pause") : t("start");
    presetsEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.ms) === timer.durationMs);
    });

    if (timer.running && rem <= 0) {
      const stamp = timer.endsAt ?? now;
      if (completedFor !== stamp) {
        completedFor = stamp;
        store.completeTimer();
        onComplete();
      }
    }

    scheduleRefresh(now);
  }

  store.subscribe(() => paint());
  paint();

  function scheduleRefresh(now: number) {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (!store.state.timer.running) return;

    const rem = remainingMs(store.state.timer, now);
    if (rem <= 0) return;

    const untilNextSecond = Math.max(1, 1000 - (now % 1000));
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      paint();
    }, Math.min(rem, untilNextSecond));
  }
}
