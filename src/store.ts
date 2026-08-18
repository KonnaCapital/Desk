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

export type PersistSnapshot = {
  primary: string | null;
  backup: string | null;
  dataPath?: string;
};

/**
 * The string/null load shape is retained for small browser integrations. The
 * app persistence implementations use PersistSnapshot so both files are
 * available to the recovery boundary.
 */
export type PersistLoad = PersistSnapshot | string | null;

export type Persist = {
  load(): Promise<PersistLoad>;
  save(json: string): Promise<void>;
  readonly dataPath?: string;
};

export type PersistenceStatus = "saved" | "saving" | "error" | "recovered";

export type PersistenceState = {
  status: PersistenceStatus;
  error: string | null;
  dataPath: string;
};

export type MemoryPersist = Persist & {
  readonly primary: string | null;
  readonly backup: string | null;
};

export function createMemoryPersist(
  initial?: string,
  initialBackup?: string,
): MemoryPersist {
  let primary = initial ?? null;
  let backup = initialBackup ?? null;
  const dataPath = "memory://board.json";
  return {
    dataPath,
    get primary() {
      return primary;
    },
    get backup() {
      return backup;
    },
    async load() {
      return { primary, backup, dataPath };
    },
    async save(json: string) {
      if (primary !== null && isJson(primary)) backup = primary;
      primary = json;
    },
  };
}

type StoreOptions = {
  persistence?: PersistenceState;
  writesBlocked?: boolean;
};

type DecodedState =
  | { kind: "missing" }
  | { kind: "malformed" }
  | { kind: "valid"; state: BoardState };

function decode(raw: string | null): DecodedState {
  if (raw === null) return { kind: "missing" };
  try {
    return { kind: "valid", state: parseState(JSON.parse(raw)) };
  } catch {
    return { kind: "malformed" };
  }
}

function snapshotOf(loaded: PersistLoad, fallbackPath: string): PersistSnapshot {
  if (typeof loaded === "string" || loaded === null) {
    return { primary: loaded, backup: null, dataPath: fallbackPath };
  }
  if (!loaded || typeof loaded !== "object") {
    throw new Error("Invalid persistence envelope");
  }
  const candidate = loaded as unknown as Record<string, unknown>;
  if (!("primary" in candidate) || !("backup" in candidate)) {
    throw new Error("Invalid persistence envelope");
  }
  if (
    (candidate.primary !== null && typeof candidate.primary !== "string") ||
    (candidate.backup !== null && typeof candidate.backup !== "string") ||
    ("dataPath" in candidate &&
      candidate.dataPath !== undefined &&
      typeof candidate.dataPath !== "string")
  ) {
    throw new Error("Invalid persistence envelope");
  }
  return {
    primary: candidate.primary as string | null,
    backup: candidate.backup as string | null,
    dataPath: (candidate.dataPath as string | undefined) ?? fallbackPath,
  };
}

function loadError(dataPath: string): string {
  return `Desk data could not be loaded safely. Data path: ${dataPath}`;
}

function saveError(dataPath: string): string {
  return `Desk data could not be saved. Data path: ${dataPath}`;
}

function isJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

export class Store {
  state: BoardState;
  persistence: PersistenceState;
  private persist: Persist;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private writesBlocked: boolean;
  private revision = 0;
  private lastQueuedRevision = 0;
  private lastSavedRevision = 0;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(
    persist: Persist,
    state: BoardState,
    options: StoreOptions = {},
  ) {
    this.persist = persist;
    this.state = state;
    this.writesBlocked = options.writesBlocked ?? false;
    this.persistence = options.persistence ?? {
      status: "saved",
      error: null,
      dataPath: persist.dataPath ?? "board.json",
    };
  }

  static async load(persist: Persist): Promise<Store> {
    const fallbackPath = persist.dataPath ?? "board.json";
    let loaded: PersistLoad;
    try {
      loaded = await persist.load();
    } catch {
      return new Store(persist, emptyState(), {
        writesBlocked: true,
        persistence: {
          status: "error",
          error: loadError(fallbackPath),
          dataPath: fallbackPath,
        },
      });
    }

    let snapshot: PersistSnapshot;
    try {
      snapshot = snapshotOf(loaded, fallbackPath);
    } catch {
      return new Store(persist, emptyState(), {
        writesBlocked: true,
        persistence: {
          status: "error",
          error: loadError(fallbackPath),
          dataPath: fallbackPath,
        },
      });
    }
    const primary = decode(snapshot.primary);
    if (primary.kind === "valid") {
      return new Store(persist, primary.state, {
        persistence: {
          status: "saved",
          error: null,
          dataPath: snapshot.dataPath ?? fallbackPath,
        },
      });
    }

    const backup = decode(snapshot.backup);
    if (backup.kind === "valid") {
      return new Store(persist, backup.state, {
        persistence: {
          status: "recovered",
          error: null,
          dataPath: snapshot.dataPath ?? fallbackPath,
        },
      });
    }

    if (primary.kind === "malformed" || backup.kind === "malformed") {
      return new Store(persist, emptyState(), {
        writesBlocked: true,
        persistence: {
          status: "error",
          error: loadError(snapshot.dataPath ?? fallbackPath),
          dataPath: snapshot.dataPath ?? fallbackPath,
        },
      });
    }

    return new Store(persist, emptyState(), {
      persistence: {
        status: "saved",
        error: null,
        dataPath: snapshot.dataPath ?? fallbackPath,
      },
    });
  }

  /** The status object consumed by the chrome/settings surfaces. */
  get persistenceStatus(): PersistenceState {
    return this.persistence;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private setPersistence(
    status: PersistenceStatus,
    error: string | null = null,
  ) {
    this.persistence = {
      status,
      error,
      dataPath: this.persistence.dataPath,
    };
    this.emit();
  }

  private commit(next: BoardState) {
    this.state = next;
    this.revision += 1;
    this.emit();
    this.scheduleSave();
  }

  private scheduleSave() {
    if (this.writesBlocked) return;
    this.setPersistence("saving");
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 200);
  }

  private enqueueSave(): Promise<void> {
    if (this.writesBlocked || this.revision <= this.lastQueuedRevision) {
      return this.saveChain;
    }

    const revision = this.revision;
    const json = JSON.stringify(this.state, null, 2);
    this.lastQueuedRevision = revision;

    const job = this.saveChain.then(async () => {
      if (this.writesBlocked) return;
      try {
        await this.persist.save(json);
        this.lastSavedRevision = Math.max(this.lastSavedRevision, revision);
        if (this.lastSavedRevision >= this.revision) {
          this.setPersistence("saved");
        } else {
          this.setPersistence("saving");
        }
      } catch {
        if (this.lastQueuedRevision === revision) {
          this.lastQueuedRevision = this.lastSavedRevision;
        }
        this.setPersistence("error", saveError(this.persistence.dataPath));
      }
    });
    this.saveChain = job.catch(() => undefined);
    return this.saveChain;
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.writesBlocked) return;

    while (true) {
      const targetRevision = this.revision;
      await this.enqueueSave();
      if (this.revision <= targetRevision) return;
    }
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

export type TauriDataPathResolver = () => Promise<string>;

export async function resolveTauriDataPath(): Promise<string> {
  const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appLocalDataDir(), "board.json");
}

export async function createTauriPersist(
  resolveDataPath: TauriDataPathResolver = resolveTauriDataPath,
): Promise<Persist> {
  const { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } =
    await import("@tauri-apps/plugin-fs");
  const file = "board.json";
  const backupFile = "board.backup.json";
  const opts = { baseDir: BaseDirectory.AppLocalData };
  const dataPath = await resolveDataPath();
  let previousPrimary: string | null = null;

  async function readOptional(path: string): Promise<string | null> {
    if (!(await exists(path, opts))) return null;
    return readTextFile(path, opts);
  }

  return {
    dataPath,
    async load() {
      const primary = await readOptional(file);
      const backup = await readOptional(backupFile);
      previousPrimary = primary !== null && isJson(primary) ? primary : null;
      return { primary, backup, dataPath };
    },
    async save(json: string) {
      await mkdir(".", { ...opts, recursive: true });
      if (previousPrimary !== null) {
        await writeTextFile(backupFile, previousPrimary, opts);
      }
      await writeTextFile(file, json, opts);
      previousPrimary = json;
    },
  };
}
