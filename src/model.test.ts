import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addToInbox,
  archiveDone,
  clockDigitsLayout,
  clockParts,
  COLUMNS,
  emptyState,
  formatTime,
  hoursToDurationMs,
  isFinished,
  isStateEnvelope,
  moveCard,
  parseState,
  pauseTimer,
  remainingMs,
  resetTimer,
  restoreCard,
  setDuration,
  sizeClass,
  startTimer,
  visibleCards,
} from "./model.ts";
import {
  Store,
  createMemoryPersist,
  createTauriPersist,
  type Persist,
} from "./store.ts";
import { registerCloseHandler } from "./close.ts";
import { mountTimer } from "./timer.ts";

function snapshotPersist(
  primary: string | null = null,
  backup: string | null = null,
): Persist {
  let currentPrimary = primary;
  let currentBackup = backup;
  const persist = {
    dataPath: "test-data/board.json",
    get primary() {
      return currentPrimary;
    },
    get backup() {
      return currentBackup;
    },
    async load() {
      return { primary: currentPrimary, backup: currentBackup } as unknown as string | null;
    },
    async save(json: string) {
      if (currentPrimary !== null) {
        try {
          if (isStateEnvelope(JSON.parse(currentPrimary))) currentBackup = currentPrimary;
        } catch {
          /* keep backup when the primary is not a valid board */
        }
      }
      currentPrimary = json;
    },
  } as Persist & { primary: string | null; backup: string | null };
  return persist;
}

function persistenceOf(store: Store): {
  status: "saved" | "saving" | "error" | "recovered";
  error: string | null;
  dataPath: string;
} {
  return store.persistenceStatus;
}

async function assertRecoversFromInvalidPrimary(primary: string): Promise<void> {
  const backupState = JSON.stringify({ ...emptyState(), pinned: false });
  const persist = snapshotPersist(primary, backupState);
  const store = await Store.load(persist);

  assert.equal(store.state.pinned, false);
  assert.equal(persistenceOf(store).status, "recovered");
  assert.equal(JSON.parse((persist as { primary: string }).primary).pinned, false);
  assert.equal((persist as { backup: string }).backup, backupState);
}

describe("addToInbox", () => {
  it("creates a card in inbox", () => {
    const next = addToInbox(emptyState(), "  buy milk  ", 1000);
    assert.equal(next.cards.length, 1);
    assert.equal(next.cards[0].text, "buy milk");
    assert.equal(next.cards[0].column, "inbox");
    assert.equal(next.cards[0].archivedAt, null);
    assert.equal(next.cards[0].createdAt, 1000);
  });

  it("ignores blank capture", () => {
    const next = addToInbox(emptyState(), "   ");
    assert.equal(next.cards.length, 0);
  });
});

describe("moveCard", () => {
  it("moves a card between columns", () => {
    const withCard = addToInbox(emptyState(), "task", 1);
    const id = withCard.cards[0].id;
    const moved = moveCard(withCard, id, "today", 2);
    assert.equal(moved.cards[0].column, "today");
    assert.equal(moved.cards[0].updatedAt, 2);
  });
});

describe("timer", () => {
  it("remaining is endsAt minus now while running", () => {
    const started = startTimer(emptyState(), 10_000);
    assert.equal(started.timer.running, true);
    assert.equal(started.timer.endsAt, 10_000 + 25 * 60 * 1000);
    assert.equal(remainingMs(started.timer, 10_000 + 5_000), 25 * 60 * 1000 - 5_000);
  });

  it("pause and resume keep remaining time", () => {
    let state = startTimer(emptyState(), 0);
    state = pauseTimer(state, 10_000);
    assert.equal(state.timer.running, false);
    assert.equal(state.timer.endsAt, null);
    assert.equal(state.timer.remainingMs, 25 * 60 * 1000 - 10_000);
    state = startTimer(state, 50_000);
    assert.equal(state.timer.endsAt, 50_000 + (25 * 60 * 1000 - 10_000));
  });

  it("reset restores duration", () => {
    let state = startTimer(emptyState(), 0);
    state = resetTimer(state);
    assert.equal(state.timer.running, false);
    assert.equal(state.timer.remainingMs, 25 * 60 * 1000);
  });

  it("applies a new duration from now while running", () => {
    let state = startTimer(emptyState(), 10_000);
    state = setDuration(state, 2 * 60 * 60 * 1000, 20_000);
    assert.equal(state.timer.running, true);
    assert.equal(state.timer.durationMs, 2 * 60 * 60 * 1000);
    assert.equal(state.timer.remainingMs, 2 * 60 * 60 * 1000);
    assert.equal(state.timer.endsAt, 20_000 + 2 * 60 * 60 * 1000);
  });

  it("ignores a duration below one minute", () => {
    const state = emptyState();
    const next = setDuration(state, hoursToDurationMs(0, 0));
    assert.equal(next, state);
    assert.equal(hoursToDurationMs(0, 0), 0);
  });

  it("is finished when endsAt has passed", () => {
    const started = startTimer(emptyState(), 0);
    assert.equal(isFinished(started.timer, started.timer.endsAt! + 1), true);
    assert.equal(isFinished(started.timer, 1), false);
  });
});

describe("archive", () => {
  it("hides done cards from the board", () => {
    let state = addToInbox(emptyState(), "done thing", 1);
    const id = state.cards[0].id;
    state = moveCard(state, id, "done", 2);
    assert.equal(visibleCards(state, "done").length, 1);
    state = archiveDone(state, 3);
    assert.equal(visibleCards(state, "done").length, 0);
    assert.equal(state.cards[0].archivedAt, 3);
    state = restoreCard(state, id, 4);
    assert.equal(visibleCards(state, "done").length, 1);
    assert.equal(state.cards[0].archivedAt, null);
  });
});

describe("columns", () => {
  it("keeps board labels in English", () => {
    assert.deepEqual(
      COLUMNS.map((col) => col.label),
      ["Inbox", "Today", "To Do", "Done"],
    );
  });
});

describe("sizeClass", () => {
  it("treats a short window as compact even when it is still wide", () => {
    assert.equal(sizeClass(1100, 160), "xs");
    assert.equal(sizeClass(1100, 720), "lg");
  });
});

describe("clockDigitsLayout", () => {
  it("stacks minutes over seconds in a tall narrow window", () => {
    assert.equal(clockDigitsLayout(220, 700), "stack");
  });

  it("keeps one line in a wide, short, or square window", () => {
    assert.equal(clockDigitsLayout(1100, 160), "row");
    assert.equal(clockDigitsLayout(1100, 720), "row");
    assert.equal(clockDigitsLayout(400, 400), "row");
    assert.equal(clockDigitsLayout(400, 220), "row");
  });

  it("stacks in any window that is taller than it is wide", () => {
    assert.equal(clockDigitsLayout(600, 800), "stack");
    assert.equal(clockDigitsLayout(720, 900), "stack");
  });
});

describe("clockParts", () => {
  it("pads minutes and seconds and omits hours below one hour", () => {
    assert.deepEqual(clockParts(58 * 60_000 + 12_000), {
      hours: null,
      minutes: "58",
      seconds: "12",
    });
    assert.equal(formatTime(58 * 60_000 + 12_000), "58:12");
  });

  it("includes hours when the remaining time is at least an hour", () => {
    assert.deepEqual(clockParts(3661_000), {
      hours: "1",
      minutes: "01",
      seconds: "01",
    });
  });
});

describe("Store", () => {
  it("persists inbox cards through flush and reload", async () => {
    const persist = createMemoryPersist();
    const store = await Store.load(persist);
    store.addToInbox("remember this");
    await store.flush();
    const reloaded = await Store.load(persist);
    assert.equal(reloaded.state.cards.length, 1);
    assert.equal(reloaded.state.cards[0].text, "remember this");
    assert.equal(reloaded.state.cards[0].column, "inbox");
  });

  it("ignores the removed autostart field when loading old JSON", () => {
    const state = parseState({
      ...emptyState(),
      autostartEnabled: true,
    } as unknown as Record<string, unknown>);
    assert.equal("autostartEnabled" in state, false);
    assert.equal(state.version, 1);
  });

  it("accepts a legacy version-1 persisted state with autostartEnabled", async () => {
    const legacy = JSON.stringify({ ...emptyState(), autostartEnabled: true });
    const store = await Store.load(snapshotPersist(legacy));

    assert.equal(persistenceOf(store).status, "saved");
    assert.equal(store.state.version, 1);
    assert.equal("autostartEnabled" in store.state, false);
  });

  it("accepts legacy states that omitted optional chrome fields", () => {
    const legacy = {
      ...emptyState(),
      autostartEnabled: true,
    } as Record<string, unknown>;
    delete legacy.view;
    delete legacy.pinned;
    delete legacy.narrowColumn;

    assert.equal(isStateEnvelope(legacy), true);
    const parsed = parseState(legacy);
    assert.equal(parsed.view, "board");
    assert.equal(parsed.pinned, false);
    assert.equal(parsed.narrowColumn, "inbox");
    assert.equal("autostartEnabled" in parsed, false);
  });

  it("rejects empty or duplicate card IDs and malformed card records", () => {
    const card = {
      id: "card-1",
      text: "A task",
      column: "inbox",
      createdAt: 1,
      updatedAt: 1,
      archivedAt: null,
    };

    assert.equal(
      isStateEnvelope({ ...emptyState(), cards: [{ ...card, id: "" }] }),
      false,
    );
    assert.equal(
      isStateEnvelope({ ...emptyState(), cards: [{ ...card, id: "   " }] }),
      false,
    );
    assert.equal(
      isStateEnvelope({
        ...emptyState(),
        cards: [card, { ...card, text: "Another task" }],
      }),
      false,
    );
    assert.equal(
      isStateEnvelope({
        ...emptyState(),
        cards: [{ ...card, column: "invalid" }],
      }),
      false,
    );
    assert.equal(
      isStateEnvelope({
        ...emptyState(),
        cards: [{ ...card, createdAt: Number.POSITIVE_INFINITY }],
      }),
      false,
    );
  });

  it("rejects non-finite and wrongly typed timer fields", () => {
    const fromPersistedJson = JSON.parse(
      '{"version":1,"view":"board","pinned":false,"narrowColumn":"inbox","cards":[],"timer":{"durationMs":1e400,"endsAt":1e400,"running":"false","remainingMs":1e400}}',
    );

    assert.equal(isStateEnvelope(fromPersistedJson), false);
    assert.equal(
      isStateEnvelope({
        ...emptyState(),
        timer: { ...emptyState().timer, running: "false" },
      }),
      false,
    );
    assert.equal(
      isStateEnvelope({
        ...emptyState(),
        timer: { ...emptyState().timer, remainingMs: -1 },
      }),
      false,
    );
  });

  it("serializes overlapping flushes and leaves the latest state last", async () => {
    let releaseFirst!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let active = 0;
    let maxActive = 0;
    const saves: string[] = [];
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return { primary: null, backup: null } as unknown as string | null;
      },
      async save(json: string) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        saves.push(json);
        if (saves.length === 1) await firstSave;
        active -= 1;
      },
    } as Persist;
    const store = await Store.load(persist);

    store.addToInbox("first");
    const firstFlush = store.flush();
    store.addToInbox("latest");
    const secondFlush = store.flush();
    releaseFirst();
    await Promise.all([firstFlush, secondFlush]);

    assert.equal(maxActive, 1);
    assert.equal(JSON.parse(saves.at(-1)!).cards[0].text, "latest");
  });

  it("keeps the previous successful JSON as backup", async () => {
    const persist = snapshotPersist();
    const store = await Store.load(persist);
    store.addToInbox("first");
    await store.flush();
    const first = JSON.stringify(store.state, null, 2);

    store.setPinned(false);
    await store.flush();

    const files = persist as unknown as { primary: string; backup: string };
    assert.equal(files.backup, first);
    assert.equal(JSON.parse(files.primary).pinned, false);
  });

  it("recovers from a malformed primary using valid backup JSON", async () => {
    const backupState = JSON.stringify({ ...emptyState(), pinned: false });
    const store = await Store.load(snapshotPersist("{ malformed", backupState));

    assert.equal(store.state.pinned, false);
    assert.equal(persistenceOf(store).status, "recovered");
  });

  it("recovers instead of dropping a malformed card in primary JSON", async () => {
    const backupState = JSON.stringify({
      ...emptyState(),
      cards: [{
        id: "safe-card",
        text: "Keep this task",
        column: "inbox",
        createdAt: 1,
        updatedAt: 1,
        archivedAt: null,
      }],
    });
    const malformedPrimary = JSON.stringify({
      ...emptyState(),
      cards: [{
        id: "lost-card",
        text: "Do not silently drop this",
        column: "invalid",
        createdAt: 1,
        updatedAt: 1,
        archivedAt: null,
      }],
    });
    const store = await Store.load(snapshotPersist(malformedPrimary, backupState));

    assert.equal(persistenceOf(store).status, "recovered");
    assert.equal(store.state.cards.length, 1);
    assert.equal(store.state.cards[0].text, "Keep this task");
  });

  it("recovers instead of accepting malformed timer JSON", async () => {
    const backupState = JSON.stringify({ ...emptyState(), pinned: true });
    const malformedPrimary =
      '{"version":1,"view":"board","pinned":false,"narrowColumn":"inbox","cards":[],"timer":{"durationMs":1e400,"endsAt":1e400,"running":"false","remainingMs":1e400}}';
    const store = await Store.load(snapshotPersist(malformedPrimary, backupState));

    assert.equal(persistenceOf(store).status, "recovered");
    assert.equal(store.state.pinned, true);
    assert.equal(store.state.timer.running, false);
  });

  it("retries a failed primary rewrite after backup recovery", async () => {
    const backupState = JSON.stringify({ ...emptyState(), pinned: false });
    let currentPrimary = "{ malformed";
    let writes = 0;
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return { primary: currentPrimary, backup: backupState };
      },
      async save(json: string) {
        writes += 1;
        if (writes === 1) throw new Error("transient disk failure");
        currentPrimary = json;
      },
    } as Persist;
    const store = await Store.load(persist);

    assert.equal(writes, 1);
    assert.equal(persistenceOf(store).status, "error");
    assert.equal(await store.flush(), "saved");
    assert.equal(writes, 2);
    assert.equal(persistenceOf(store).status, "saved");
    assert.equal(currentPrimary, JSON.stringify(store.state, null, 2));
  });

  it("recovers from a null primary using valid backup JSON", async () => {
    await assertRecoversFromInvalidPrimary(JSON.stringify(null));
  });

  it("recovers from an empty object primary using valid backup JSON", async () => {
    await assertRecoversFromInvalidPrimary(JSON.stringify({}));
  });

  it("recovers from an unknown-version primary using valid backup JSON", async () => {
    await assertRecoversFromInvalidPrimary(
      JSON.stringify({ ...emptyState(), version: 99 }),
    );
  });

  it("recovers when a required root container is absent", async () => {
    const withoutCards = { ...emptyState() } as Record<string, unknown>;
    delete withoutCards.cards;
    const withoutTimer = { ...emptyState() } as Record<string, unknown>;
    delete withoutTimer.timer;

    await assertRecoversFromInvalidPrimary(JSON.stringify(withoutCards));
    await assertRecoversFromInvalidPrimary(JSON.stringify(withoutTimer));
  });

  it("preserves the valid backup when saving after primary recovery", async () => {
    const backupState = JSON.stringify({ ...emptyState(), pinned: false });
    const persist = createMemoryPersist(JSON.stringify({}), backupState);
    const store = await Store.load(persist);

    assert.equal(persistenceOf(store).status, "recovered");
    assert.equal(JSON.parse(persist.primary!).pinned, false);
    assert.equal(persist.backup, backupState);

    store.setPinned(true);
    await store.flush();

    assert.equal(JSON.parse(persist.backup!).pinned, false);
    assert.equal(JSON.parse(persist.primary!).pinned, true);
  });

  it("blocks automatic writes when primary and backup are both corrupt", async () => {
    const persist = snapshotPersist("{ malformed", "[ malformed");
    const store = await Store.load(persist);
    const before = persist as unknown as { primary: string; backup: string };

    assert.equal(persistenceOf(store).status, "error");
    assert.match(persistenceOf(store).error ?? "", /could not be loaded/);
    assert.equal(store.writesBlocked, true);
    store.addToInbox("must not overwrite corrupt files");
    await store.flush();

    assert.equal(store.state.cards.length, 0);

    assert.equal(before.primary, "{ malformed");
    assert.equal(before.backup, "[ malformed");
  });

  it("blocks writes when structurally invalid primary and backup are both valid JSON", async () => {
    const primary = JSON.stringify({});
    const backup = JSON.stringify({ version: 99, cards: [], timer: {} });
    const persist = snapshotPersist(primary, backup);
    const store = await Store.load(persist);
    const before = persist as unknown as { primary: string; backup: string };

    assert.equal(persistenceOf(store).status, "error");
    store.addToInbox("must not overwrite structurally invalid files");
    await store.flush();

    assert.equal(store.state.cards.length, 0);

    assert.equal(before.primary, primary);
    assert.equal(before.backup, backup);
  });

  it("blocks writes when loading persistence returns an invalid shape", async () => {
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return undefined as unknown as string | null;
      },
      async save() {
        throw new Error("must not write");
      },
    } as Persist;
    const store = await Store.load(persist);

    assert.equal(persistenceOf(store).status, "error");
    store.addToInbox("must not write");
    await store.flush();
    assert.equal(store.state.cards.length, 0);
  });

  it("blocks writes when a persistence envelope is incomplete", async () => {
    let writes = 0;
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return {} as unknown as string | null;
      },
      async save() {
        writes += 1;
      },
    } as Persist;
    const store = await Store.load(persist);

    assert.equal(persistenceOf(store).status, "error");
    store.addToInbox("must not overwrite an invalid envelope");
    await store.flush();
    assert.equal(writes, 0);
  });

  it("emits one saving transition for a pending change", async () => {
    const store = await Store.load(createMemoryPersist());
    const statuses: string[] = [];
    store.subscribe(() => statuses.push(store.persistenceStatus.status));

    store.addToInbox("one status");
    await store.flush();

    assert.equal(statuses.filter((status) => status === "saving").length, 1);
  });

  it("uses the resolved Tauri data path in its persistence boundary", async () => {
    const resolveDataPath = async () => "C:/Desk/AppLocalData/board.json";
    const createWithResolver = createTauriPersist as unknown as (
      resolvePath: () => Promise<string>,
    ) => Promise<Persist>;
    const persist = await createWithResolver(resolveDataPath);

    assert.equal(persist.dataPath, "C:/Desk/AppLocalData/board.json");
  });

  it("reports save failures without throwing into event handlers", async () => {
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return { primary: null, backup: null } as unknown as string | null;
      },
      async save() {
        throw new Error("secret backend details");
      },
    } as Persist;
    const store = await Store.load(persist);

    store.addToInbox("failure");
    let flushOutcome: unknown;
    await assert.doesNotReject(async () => {
      flushOutcome = await store.flush();
    });

    const status = persistenceOf(store);
    assert.equal(flushOutcome, "error");
    assert.equal(status.status, "error");
    assert.equal(status.dataPath, "test-data/board.json");
    assert.ok(status.error);
    assert.equal(status.error.includes("secret backend details"), false);
  });

  it("surfaces a Store save failure before native close destroys the window", async () => {
    const persist = {
      dataPath: "test-data/board.json",
      async load() {
        return { primary: null, backup: null } as unknown as string | null;
      },
      async save() {
        throw new Error("secret backend details");
      },
    } as Persist;
    const store = await Store.load(persist);
    store.addToInbox("failure before close");

    let handler!: (event: { preventDefault(): void }) => void | Promise<void>;
    const events: string[] = [];
    const registration = await registerCloseHandler(
      {
        async onCloseRequested(next) {
          handler = next;
          return () => {};
        },
        async destroy() {
          events.push("destroy");
        },
      },
      () => store.flush(),
      (result) => {
        events.push(`problem:${result}`);
        assert.equal(store.persistenceStatus.status, "error");
        assert.ok(store.persistenceStatus.error);
      },
      2_000,
      async () => {
        events.push("paint");
      },
    );

    assert.equal(registration.registered, true);
    await handler({ preventDefault: () => events.push("prevent") });

    assert.deepEqual(events, ["prevent", "problem:failed", "paint", "destroy"]);
  });
});

describe("timer refresh scheduling", () => {
  it("does not schedule a refresh while stopped", () => {
    const originalDocument = (globalThis as { document?: unknown }).document;
    const originalWindow = (globalThis as { window?: unknown }).window;
    let intervalCalls = 0;
    let timeoutCalls = 0;
    const elements = new Map<string, Record<string, unknown>>();
    for (const selector of [
      "#clock-digits",
      ".clock-hours",
      ".clock-mins",
      ".clock-secs",
      "#clock-progress-fill",
      "#clock-presets",
      "#custom-duration",
      "#hours-input",
      "#mins-input",
      "#clock-duration-status",
      "#timer-toggle",
      "#timer-reset",
    ]) {
      elements.set(selector, {
        innerHTML: "",
        textContent: "",
        hidden: true,
        dataset: {},
        style: {},
        classList: { toggle() {}, add() {} },
        addEventListener() {},
        querySelectorAll() { return []; },
      });
    }
    (globalThis as { document?: unknown }).document = {
      body: { dataset: {} },
      querySelector(selector: string) {
        return elements.get(selector);
      },
    };
    (globalThis as { window?: unknown }).window = {
      setInterval() {
        intervalCalls += 1;
        return 1;
      },
      clearInterval() {},
      setTimeout() {
        timeoutCalls += 1;
        return 1;
      },
      clearTimeout() {},
    };

    try {
      const store = new Store(snapshotPersist(), emptyState());
      mountTimer(store, () => {});
      assert.equal(intervalCalls, 0);
      assert.equal(timeoutCalls, 0);
    } finally {
      if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
      else (globalThis as { document?: unknown }).document = originalDocument;
      if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});
