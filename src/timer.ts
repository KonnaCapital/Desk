import {
  PRESETS,
  clockParts,
  formatTime,
  hoursToDurationMs,
  nudgeDurationMs,
  remainingMs,
  timerPhase,
} from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

/** One mouse-wheel notch; trackpads add up small deltas until they reach it. */
const WHEEL_NOTCH = 40;

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

  presetsEl.innerHTML =
    PRESETS.map(
      (preset) =>
        `<button type="button" data-ms="${preset.ms}">${preset.label}</button>`,
    ).join("") +
    `<button type="button" data-custom aria-controls="custom-duration" aria-expanded="false">${t("custom")}</button>`;

  let customOpen = false;
  let displayedDuration: number | null = null;
  setCustomOpen(false);

  presetsEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!btn) return;
    if (btn.dataset.custom !== undefined) {
      setCustomOpen(!customOpen);
      if (customOpen) minsInput.focus();
      return;
    }
    if (!btn.dataset.ms) return;
    store.setDuration(Number(btn.dataset.ms));
    setCustomOpen(false);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const hours = Number(hoursInput.value || 0);
    const minutes = Number(minsInput.value || 0);
    const applied = store.setDuration(hoursToDurationMs(hours, minutes));
    if (applied) {
      setCustomOpen(false);
      return;
    }
    durationStatus.textContent = t("durationTooShort");
    durationStatus.classList.remove("hidden");
  });

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setCustomOpen(false);
    presetsEl.querySelector<HTMLButtonElement>("[data-custom]")?.focus();
  });

  // Scroll over the time to set it: one minute a notch, five with Shift.
  let wheelDelta = 0;
  digits.addEventListener(
    "wheel",
    (event) => {
      if (store.state.timer.running) return;
      event.preventDefault();
      // Shift turns the wheel horizontal in Chromium.
      const delta = event.deltaY || event.deltaX;
      if (Math.sign(delta) !== Math.sign(wheelDelta)) wheelDelta = 0;
      wheelDelta += delta;
      if (Math.abs(wheelDelta) < WHEEL_NOTCH) return;
      const minutes = (event.shiftKey ? 5 : 1) * (wheelDelta < 0 ? 1 : -1);
      wheelDelta = 0;
      store.setDuration(nudgeDurationMs(store.state.timer.durationMs, minutes));
    },
    { passive: false },
  );

  function setCustomOpen(open: boolean) {
    const closing = customOpen && !open;
    customOpen = open;
    form.classList.toggle("hidden", !open);
    document.body.dataset.clockCustom = open ? "open" : "closed";
    presetsEl.querySelectorAll("button").forEach((btn) => {
      if (btn.dataset.custom !== undefined) btn.setAttribute("aria-expanded", String(open));
    });
    if (!open) {
      durationStatus.textContent = "";
      durationStatus.classList.add("hidden");
    }
    // Drop unapplied edits so the fields show the current time when reopened.
    if (closing) showDuration(store.state.timer.durationMs);
  }

  function showDuration(durationMs: number) {
    displayedDuration = durationMs;
    hoursInput.value = String(Math.floor(durationMs / 3_600_000));
    minsInput.value = String(Math.floor(durationMs / 60_000) % 60);
  }

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
    digits.dataset.hours = String(parts.hours !== null);
    digits.setAttribute("aria-label", `${timer.running ? t("pause") : t("start")}: ${formatTime(rem)}`);
    minsEl.textContent = parts.minutes;
    secsEl.textContent = parts.seconds;
    document.body.dataset.timer = timerPhase(timer, now);
    const ratio = timer.durationMs > 0 ? rem / timer.durationMs : 0;
    progressFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    toggle.textContent = timer.running ? t("pause") : t("start");
    if (displayedDuration !== timer.durationMs) showDuration(timer.durationMs);
    digits.title = timer.running ? "" : t("clockHint");
    const onPreset = PRESETS.some((preset) => preset.ms === timer.durationMs);
    presetsEl.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.custom !== undefined
          ? !onPreset
          : Number(btn.dataset.ms) === timer.durationMs,
      );
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

    const untilNextSecond = rem % 1000 || 1000;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      paint();
    }, Math.min(rem, untilNextSecond));
  }
}
