import {
  type BoardState,
  type Column,
  type View,
  addToInbox as addToInboxModel,
  archiveDone as archiveDoneModel,
  completeTimer as completeTimerModel,
  editCard as editCardModel,
  emptyState,
  moveCard as moveCardModel,
  parseState,
  pauseTimer as pauseTimerModel,
  resetTimer as resetTimerModel,
  setDuration as setDurationModel,
  setNarrowColumn as setNarrowColumnModel,
  setPinned as setPinnedModel,
  setView as setViewModel,
  startTimer as startTimerModel,
} from "./model.ts";

export type Persist = {
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
};

export function createMemoryPersist(initial?: string): Persist {
  let data = initial ?? null;
  return {
    async load() {
      return data;
    },
    async save(json: string) {
      data = json;
    },
  };
}

export class Store {
  state: BoardState;
  private persist: Persist;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  constructor(persist: Persist, state: BoardState) {
    this.persist = persist;
    this.state = state;
  }

  static async load(persist: Persist): Promise<Store> {
    let raw: string | null = null;
    try {
      raw = await persist.load();
    } catch {
      raw = null;
    }
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return new Store(persist, parsed ? parseState(parsed) : emptyState());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private commit(next: BoardState) {
    this.state = next;
    this.emit();
    this.scheduleSave();
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flush();
    }, 200);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.persist.save(JSON.stringify(this.state, null, 2));
  }

  addToInbox(text: string) {
    this.commit(addToInboxModel(this.state, text));
  }

  moveCard(id: string, column: Column) {
    this.commit(moveCardModel(this.state, id, column));
  }

  editCard(id: string, text: string) {
    this.commit(editCardModel(this.state, id, text));
  }

  archiveDone() {
    this.commit(archiveDoneModel(this.state));
  }

  setView(view: View) {
    this.commit(setViewModel(this.state, view));
  }

  setPinned(pinned: boolean) {
    this.commit(setPinnedModel(this.state, pinned));
  }

  setNarrowColumn(column: Column) {
    this.commit(setNarrowColumnModel(this.state, column));
  }

  setDuration(durationMs: number) {
    this.commit(setDurationModel(this.state, durationMs));
  }

  startTimer() {
    this.commit(startTimerModel(this.state));
  }

  pauseTimer() {
    this.commit(pauseTimerModel(this.state));
  }

  resetTimer() {
    this.commit(resetTimerModel(this.state));
  }

  completeTimer() {
    this.commit(completeTimerModel(this.state));
  }
}

export async function createTauriPersist(): Promise<Persist> {
  const { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } =
    await import("@tauri-apps/plugin-fs");
  const file = "board.json";
  const opts = { baseDir: BaseDirectory.AppLocalData };

  return {
    async load() {
      try {
        if (!(await exists(file, opts))) return null;
        return await readTextFile(file, opts);
      } catch {
        return null;
      }
    },
    async save(json: string) {
      try {
        await mkdir(".", { ...opts, recursive: true });
      } catch {
        // AppLocalData already exists after first launch.
      }
      await writeTextFile(file, json, opts);
    },
  };
}
