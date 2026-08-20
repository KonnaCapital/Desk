import type { View } from "./model.ts";

export type ClockSoloTarget = "digits" | "face" | "control";

export function clockSoloTarget(el: EventTarget | null): ClockSoloTarget {
  const node = el as { closest?: (selector: string) => unknown } | null;
  if (!node || typeof node.closest !== "function") return "face";
  if (node.closest(".clock-presets, .custom-duration, .clock-actions, input, #clock-duration-status")) {
    return "control";
  }
  if (node.closest("#clock-digits")) return "digits";
  return "face";
}

/** Pinned clock only. First click on the time or face hides chrome. Click the face again to restore. Digits keep solo so start/pause still works. */
export function nextClockSolo(
  pinned: boolean,
  view: View,
  solo: boolean,
  target: ClockSoloTarget,
): boolean {
  if (!pinned || view !== "clock") return false;
  if (target === "control") return solo;
  if (!solo) return true;
  return target !== "face";
}

export function shouldBlockTimerToggle(
  pinned: boolean,
  view: View,
  solo: boolean,
  target: ClockSoloTarget,
): boolean {
  return !solo && nextClockSolo(pinned, view, solo, target) && target !== "control";
}
