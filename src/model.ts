export type Column = "inbox" | "today" | "todo" | "done";
export type View = "board" | "clock";
export type SizeClass = "lg" | "md" | "sm" | "xs";

export type Card = {
  id: string;
  text: string;
  column: Column;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export type TimerState = {
  durationMs: number;
  endsAt: number | null;
  running: boolean;
  remainingMs: number;
};

export type BoardState = {
  version: 1;
  view: View;
  pinned: boolean;
  narrowColumn: Column;
  cards: Card[];
  timer: TimerState;
};

export const COLUMNS: { id: Column; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "todo", label: "To Do" },
  { id: "done", label: "Done" },
];

export const PRESETS: { label: string; ms: number }[] = [
  { label: "25m", ms: 25 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "2h", ms: 2 * 60 * 60 * 1000 },
];

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

export function emptyState(): BoardState {
  const durationMs = 25 * MIN;
  return {
    version: 1,
    view: "board",
    pinned: false,
    narrowColumn: "inbox",
    cards: [],
    timer: {
      durationMs,
      endsAt: null,
      running: false,
      remainingMs: durationMs,
    },
  };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isColumn(value: unknown): value is Column {
  return value === "inbox" || value === "today" || value === "todo" || value === "done";
}

function isView(value: unknown): value is View {
  return value === "board" || value === "clock";
}

export function isStateEnvelope(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const data = raw as Record<string, unknown>;
  const timer = data.timer;
  return (
    data.version === 1 &&
    Array.isArray(data.cards) &&
    timer !== null &&
    typeof timer === "object" &&
    !Array.isArray(timer)
  );
}

export function parseState(raw: unknown): BoardState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const cardsIn = Array.isArray(data.cards) ? data.cards : [];
  const timerIn =
    data.timer && typeof data.timer === "object"
      ? (data.timer as Record<string, unknown>)
      : {};

  const cards: Card[] = [];
  for (const item of cardsIn) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.text !== "string") continue;
    if (!isColumn(c.column)) continue;
    cards.push({
      id: c.id,
      text: c.text,
      column: c.column,
      createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
      updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now(),
      archivedAt: typeof c.archivedAt === "number" ? c.archivedAt : null,
    });
  }

  const durationMs =
    typeof timerIn.durationMs === "number" && timerIn.durationMs > 0
      ? timerIn.durationMs
      : base.timer.durationMs;

  return {
    version: 1,
    view: isView(data.view) ? data.view : base.view,
    pinned: typeof data.pinned === "boolean" ? data.pinned : false,
    narrowColumn: isColumn(data.narrowColumn) ? data.narrowColumn : "inbox",
    cards,
    timer: {
      durationMs,
      endsAt: typeof timerIn.endsAt === "number" ? timerIn.endsAt : null,
      running: Boolean(timerIn.running),
      remainingMs:
        typeof timerIn.remainingMs === "number"
          ? Math.max(0, timerIn.remainingMs)
          : durationMs,
    },
  };
}

export function addToInbox(
  state: BoardState,
  text: string,
  now = Date.now(),
): BoardState {
  const trimmed = text.trim();
  if (!trimmed) return state;
  const card: Card = {
    id: newId(),
    text: trimmed,
    column: "inbox",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  return { ...state, cards: [card, ...state.cards] };
}

export function moveCard(
  state: BoardState,
  id: string,
  column: Column,
  now = Date.now(),
): BoardState {
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === id ? { ...card, column, updatedAt: now } : card,
    ),
  };
}

export function editCard(
  state: BoardState,
  id: string,
  text: string,
  now = Date.now(),
): BoardState {
  const trimmed = text.trim();
  if (!trimmed) return state;
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === id ? { ...card, text: trimmed, updatedAt: now } : card,
    ),
  };
}

export function archiveDone(state: BoardState, now = Date.now()): BoardState {
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.column === "done" && card.archivedAt == null
        ? { ...card, archivedAt: now, updatedAt: now }
        : card,
    ),
  };
}

export function restoreCard(
  state: BoardState,
  id: string,
  now = Date.now(),
): BoardState {
  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === id && card.archivedAt != null
        ? { ...card, archivedAt: null, updatedAt: now }
        : card,
    ),
  };
}

export function visibleCards(state: BoardState, column: Column): Card[] {
  return state.cards.filter(
    (card) => card.column === column && card.archivedAt == null,
  );
}

export function setView(state: BoardState, view: View): BoardState {
  return { ...state, view };
}

export function setPinned(state: BoardState, pinned: boolean): BoardState {
  return { ...state, pinned };
}

export function setNarrowColumn(state: BoardState, column: Column): BoardState {
  return { ...state, narrowColumn: column };
}

export function remainingMs(timer: TimerState, now = Date.now()): number {
  if (timer.running && timer.endsAt != null) {
    return Math.max(0, timer.endsAt - now);
  }
  return Math.max(0, timer.remainingMs);
}

export function formatTime(ms: number): string {
  const parts = clockParts(ms);
  return parts.hours
    ? `${parts.hours}:${parts.minutes}:${parts.seconds}`
    : `${parts.minutes}:${parts.seconds}`;
}

export type ClockParts = {
  hours: string | null;
  minutes: string;
  seconds: string;
};

export function clockParts(ms: number): ClockParts {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return {
      hours: String(h),
      minutes: String(m).padStart(2, "0"),
      seconds: String(s).padStart(2, "0"),
    };
  }
  return {
    hours: null,
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  };
}

export type ClockDigitsLayout = "row" | "stack";

/** Portrait clock: MM over SS. Landscape or square stay one line. */
export function clockDigitsLayout(width: number, height: number): ClockDigitsLayout {
  if (width <= 0 || height <= 0) return "row";
  if (height > width) return "stack";
  return "row";
}

export function setDuration(
  state: BoardState,
  durationMs: number,
  now = Date.now(),
): BoardState {
  const ms = Math.round(durationMs);
  if (!Number.isFinite(ms) || ms < MIN) return state;
  if (state.timer.running) {
    return {
      ...state,
      timer: {
        ...state.timer,
        durationMs: ms,
        remainingMs: ms,
        endsAt: now + ms,
      },
    };
  }
  return {
    ...state,
    timer: {
      durationMs: ms,
      endsAt: null,
      running: false,
      remainingMs: ms,
    },
  };
}

export function hoursToDurationMs(hours: number, minutes = 0): number {
  const h = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return h * HOUR + m * MIN;
}

export function startTimer(state: BoardState, now = Date.now()): BoardState {
  const rem = remainingMs(state.timer, now);
  const nextRemaining = rem > 0 ? rem : state.timer.durationMs;
  return {
    ...state,
    timer: {
      ...state.timer,
      running: true,
      remainingMs: nextRemaining,
      endsAt: now + nextRemaining,
    },
  };
}

export function pauseTimer(state: BoardState, now = Date.now()): BoardState {
  const rem = remainingMs(state.timer, now);
  return {
    ...state,
    timer: {
      ...state.timer,
      running: false,
      remainingMs: rem,
      endsAt: null,
    },
  };
}

export function resetTimer(state: BoardState): BoardState {
  return {
    ...state,
    timer: {
      ...state.timer,
      running: false,
      remainingMs: state.timer.durationMs,
      endsAt: null,
    },
  };
}

export function completeTimer(state: BoardState): BoardState {
  return {
    ...state,
    timer: {
      ...state.timer,
      running: false,
      remainingMs: 0,
      endsAt: null,
    },
  };
}

export function isFinished(timer: TimerState, now = Date.now()): boolean {
  return timer.running && remainingMs(timer, now) <= 0;
}

export function sizeClass(width: number, height: number): SizeClass {
  if (width < 280 || height < 200) return "xs";
  if (width < 520) return "sm";
  if (width < 900) return "md";
  return "lg";
}
