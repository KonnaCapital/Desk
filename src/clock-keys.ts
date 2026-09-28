import { PRESETS, type View } from "./model.ts";
import type { Store } from "./store.ts";

export type ClockKeyInput = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
};

/** Text fields keep their keys; a focused button answers Space on its own. */
export type ClockKeyTarget = "text" | "button" | "other";

export type ClockKeyContext = {
  view: View;
  running: boolean;
  overlayOpen: boolean;
  target: ClockKeyTarget;
};

export type ClockKeyAction =
  | { kind: "toggle" }
  | { kind: "reset" }
  | { kind: "preset"; index: number }
  | { kind: "nudge"; minutes: number };

export function clockKeyTarget(el: EventTarget | null): ClockKeyTarget {
  const node = el as { tagName?: string; isContentEditable?: boolean } | null;
  if (!node || typeof node.tagName !== "string") return "other";
  if (node.isContentEditable) return "text";
  const tag = node.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return "text";
  if (tag === "BUTTON") return "button";
  return "other";
}

/** Clock view only: Space starts or pauses, R resets, 1–3 pick a preset, arrows nudge the time. */
export function clockKeyAction(
  event: ClockKeyInput,
  context: ClockKeyContext,
): ClockKeyAction | null {
  if (context.view !== "clock" || context.overlayOpen || context.target === "text") return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    if (context.running) return null;
    const step = event.shiftKey ? 5 : 1;
    return { kind: "nudge", minutes: event.key === "ArrowUp" ? step : -step };
  }
  if (event.repeat) return null;
  if (event.key === " ") {
    return context.target === "button" ? null : { kind: "toggle" };
  }
  if (event.key === "r" || event.key === "R") return { kind: "reset" };
  if (!context.running && /^[1-9]$/.test(event.key)) {
    const index = Number(event.key) - 1;
    return index < PRESETS.length ? { kind: "preset", index } : null;
  }
  return null;
}

export function mountClockKeys(store: Store): void {
  document.addEventListener("keydown", (event) => {
    const action = clockKeyAction(event, {
      view: store.state.view,
      running: store.state.timer.running,
      overlayOpen: document.querySelector(".overlay:not(.hidden), dialog[open]") !== null,
      target: clockKeyTarget(event.target),
    });
    if (!action) return;
    event.preventDefault();
    switch (action.kind) {
      case "toggle":
        store.toggleTimer();
        break;
      case "reset":
        store.resetTimer();
        break;
      case "preset":
        store.setDuration(PRESETS[action.index].ms);
        break;
      case "nudge":
        store.nudgeDuration(action.minutes);
        break;
    }
  });
}
