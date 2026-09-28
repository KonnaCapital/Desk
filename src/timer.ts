import {
  PRESETS,
  clockParts,
  formatTime,
  hoursToDurationMs,
  remainingMs,
  timerPhase,
  windowTitle,
} from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

export type TimerHooks = {
  /** Runs once each time the clock reaches zero. */
  onComplete?: () => void;
  /** Receives the window title for the time left, when it changes or ticks. */
  onTitle?: (title: string) => void;
  appName?: string;
};

/** One mouse-wheel notch in pixels; trackpads add up small deltas until they reach it. */
export const WHEEL_NOTCH = 40;

const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;

/**
 * Add one wheel event to the running total and report a whole step, if any:
 * +1 for a notch up (more time), -1 for a notch down. Reversing direction
 * starts a new count.
 */
export function wheelStep(
  total: number,
  delta: number,
  deltaMode = 0,
): { total: number; step: -1 | 0 | 1 } {
  const px = delta * (deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_PAGE_PX : 1);
  if (px === 0) return { total, step: 0 };
  const next = Math.sign(px) === Math.sign(total) ? total + px : px;
  if (Math.abs(next) < WHEEL_NOTCH) return { total: next, step: 0 };
  return { total: 0, step: next < 0 ? 1 : -1 };
}

export function mountTimer(store: Store, hooks: TimerHooks = {}): void {
  const { onComplete, onTitle, appName = "Desk" } = hooks;
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

  // Scroll over the time to set it: a minute a notch, five with Shift.
  let wheelTotal = 0;
  digits.addEventListener(
    "wheel",
    (event) => {
      if (store.state.timer.running) return;
      event.preventDefault();
      // Shift turns the wheel horizontal in Chromium.
      const delta = event.deltaY || event.deltaX;
      const { total, step } = wheelStep(wheelTotal, delta, event.deltaMode);
      wheelTotal = total;
      if (step !== 0) store.nudgeDuration(step * (event.shiftKey ? 5 : 1));
    },
    { passive: false },
  );

  function setCustomOpen(open: boolean) {
    const closing = customOpen && !open;
    customOpen = open;
    form.classList.toggle("hidden", !open);
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

  toggle.addEventListener("click", () => store.toggleTimer());
  reset.addEventListener("click", () => store.resetTimer());
  digits.addEventListener("click", () => store.toggleTimer());

  let completedFor: number | null = null;
  let refreshTimer: number | null = null;

  function paint(now = Date.now()) {
    const { timer } = store.state;
    const rem = remainingMs(timer, now);
    const parts = clockParts(rem);
    hoursEl.hidden = parts.hours === null;
    hoursEl.textContent = parts.hours ?? "";
    digits.setAttribute("aria-label", `${timer.running ? t("pause") : t("start")}: ${formatTime(rem)}`);
    minsEl.textContent = parts.minutes;
    secsEl.textContent = parts.seconds;
    document.body.dataset.timer = timerPhase(timer, now);
    document.body.dataset.clockHours = String(parts.hours !== null);
    onTitle?.(windowTitle(timer, now, appName));
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
        onComplete?.();
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
