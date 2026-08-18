import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addToInbox,
  archiveDone,
  COLUMNS,
  emptyState,
  isFinished,
  moveCard,
  parseState,
  pauseTimer,
  remainingMs,
  resetTimer,
  startTimer,
  visibleCards,
} from "./model.ts";
import {
  Store,
  createMemoryPersist,
  createTauriPersist,
  type Persist,
} from "./store.ts";
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
      if (currentPrimary !== null) currentBackup = currentPrimary;
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

  it("preserves the valid backup when saving after primary recovery", async () => {
    const backupState = JSON.stringify({ ...emptyState(), pinned: false });
    const persist = createMemoryPersist("{ malformed", backupState);
    const store = await Store.load(persist);
    store.setPinned(true);
    await store.flush();

    assert.equal(persist.backup, backupState);
    assert.equal(JSON.parse(persist.primary!).pinned, true);
  });

  it("blocks automatic writes when primary and backup are both corrupt", async () => {
    const persist = snapshotPersist("{ malformed", "[ malformed");
    const store = await Store.load(persist);
    const before = persist as unknown as { primary: string; backup: string };

    assert.equal(persistenceOf(store).status, "error");
    store.addToInbox("must not overwrite corrupt files");
    await store.flush();

    assert.equal(before.primary, "{ malformed");
    assert.equal(before.backup, "[ malformed");
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
    assert.equal(store.state.cards.length, 1);
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
    await assert.doesNotReject(() => store.flush());

    const status = persistenceOf(store);
    assert.equal(status.status, "error");
    assert.equal(status.dataPath, "test-data/board.json");
    assert.ok(status.error);
    assert.equal(status.error.includes("secret backend details"), false);
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
      "#clock-progress-fill",
      "#clock-presets",
      "#custom-duration",
      "#hours-input",
      "#mins-input",
      "#timer-toggle",
      "#timer-reset",
    ]) {
      elements.set(selector, {
        innerHTML: "",
        textContent: "",
        dataset: {},
        style: {},
        classList: { toggle() {} },
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
