import { PRESETS, formatTime, hoursToDurationMs, remainingMs } from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

export function mountTimer(store: Store, onComplete: () => void): void {
  const digits = document.querySelector<HTMLButtonElement>("#clock-digits")!;
  const progressFill = document.querySelector<HTMLElement>("#clock-progress-fill")!;
  const presetsEl = document.querySelector<HTMLElement>("#clock-presets")!;
  const form = document.querySelector<HTMLFormElement>("#custom-duration")!;
  const hoursInput = document.querySelector<HTMLInputElement>("#hours-input")!;
  const minsInput = document.querySelector<HTMLInputElement>("#mins-input")!;
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
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const hours = Number(hoursInput.value || 0);
    const minutes = Number(minsInput.value || 0);
    store.setDuration(hoursToDurationMs(hours, minutes));
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

  function paint(now = Date.now()) {
    const { timer } = store.state;
    const rem = remainingMs(timer, now);
    digits.textContent = formatTime(rem);
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
  }

  store.subscribe(() => paint());
  paint();
  window.setInterval(() => paint(), 200);
}
