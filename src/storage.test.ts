import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAtomicStorage,
  STORAGE_FILES,
  type AtomicStorageBackend,
} from "./storage.ts";

class MemoryFileBackend implements AtomicStorageBackend {
  readonly files = new Map<string, string>();
  readonly calls: string[] = [];
  failOperation: string | null = null;

  constructor(initial: Record<string, string>) {
    for (const [path, contents] of Object.entries(initial)) {
      this.files.set(path, contents);
    }
  }

  private check(operation: string): void {
    this.calls.push(operation);
    if (operation === this.failOperation) {
      if (operation.startsWith("write:")) {
        const path = operation.slice("write:".length);
        this.files.set(path, "partial");
      }
      throw new Error(`failed ${operation}`);
    }
  }

  async ensureDirectory(): Promise<void> {
    this.check("mkdir");
  }

  async exists(path: string): Promise<boolean> {
    this.check(`exists:${path}`);
    return this.files.has(path);
  }

  async readTextFile(path: string): Promise<string> {
    this.check(`read:${path}`);
    const contents = this.files.get(path);
    if (contents === undefined) throw new Error(`missing ${path}`);
    return contents;
  }

  async writeTextFile(path: string, data: string): Promise<void> {
    this.check(`write:${path}`);
    this.files.set(path, data);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    this.check(`rename:${oldPath}->${newPath}`);
    const contents = this.files.get(oldPath);
    if (contents === undefined) throw new Error(`missing ${oldPath}`);
    this.files.delete(oldPath);
    this.files.set(newPath, contents);
  }
}

const OLD_PRIMARY = "primary-v1";
const OLD_BACKUP = "backup-v0";
const NEW_PRIMARY = "primary-v2";
const DATA_PATH = "C:/Desk/AppLocalData/board.json";

function createLoadedStorage(
  primary = OLD_PRIMARY,
  backup = OLD_BACKUP,
): { backend: MemoryFileBackend; storage: ReturnType<typeof createAtomicStorage> } {
  const backend = new MemoryFileBackend({
    [STORAGE_FILES.primary]: primary,
    [STORAGE_FILES.backup]: backup,
  });
  const storage = createAtomicStorage(
    backend,
    DATA_PATH,
    (raw) => raw.startsWith("primary-"),
  );
  return { backend, storage };
}

async function assertPrimaryAndBackup(
  backend: MemoryFileBackend,
  primary: string,
  backup: string,
): Promise<void> {
  assert.equal(backend.files.get(STORAGE_FILES.primary), primary);
  assert.equal(backend.files.get(STORAGE_FILES.backup), backup);
}

describe("createAtomicStorage", () => {
  it("writes the previous primary and new primary through temp files", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();

    await storage.save(NEW_PRIMARY);

    await assertPrimaryAndBackup(backend, NEW_PRIMARY, OLD_PRIMARY);
    assert.equal(backend.files.has(STORAGE_FILES.primaryTemp), false);
    assert.equal(backend.files.has(STORAGE_FILES.backupTemp), false);
    assert.deepEqual(backend.calls.slice(-5), [
      "mkdir",
      `write:${STORAGE_FILES.backupTemp}`,
      `rename:${STORAGE_FILES.backupTemp}->${STORAGE_FILES.backup}`,
      `write:${STORAGE_FILES.primaryTemp}`,
      `rename:${STORAGE_FILES.primaryTemp}->${STORAGE_FILES.primary}`,
    ]);
  });

  it("keeps final files unchanged when backup temp writing fails", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();
    backend.failOperation = `write:${STORAGE_FILES.backupTemp}`;

    await assert.rejects(storage.save(NEW_PRIMARY));

    await assertPrimaryAndBackup(backend, OLD_PRIMARY, OLD_BACKUP);
  });

  it("keeps final files unchanged when backup rename fails", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();
    backend.failOperation =
      `rename:${STORAGE_FILES.backupTemp}->${STORAGE_FILES.backup}`;

    await assert.rejects(storage.save(NEW_PRIMARY));

    await assertPrimaryAndBackup(backend, OLD_PRIMARY, OLD_BACKUP);
  });

  it("keeps the old primary when primary temp writing fails", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();
    backend.failOperation = `write:${STORAGE_FILES.primaryTemp}`;

    await assert.rejects(storage.save(NEW_PRIMARY));

    await assertPrimaryAndBackup(backend, OLD_PRIMARY, OLD_PRIMARY);
  });

  it("keeps the old primary when primary rename fails", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();
    backend.failOperation =
      `rename:${STORAGE_FILES.primaryTemp}->${STORAGE_FILES.primary}`;

    await assert.rejects(storage.save(NEW_PRIMARY));

    await assertPrimaryAndBackup(backend, OLD_PRIMARY, OLD_PRIMARY);
  });

  it("retains previousPrimary after a failed save for the retry", async () => {
    const { backend, storage } = createLoadedStorage();
    await storage.load();
    backend.failOperation = `write:${STORAGE_FILES.primaryTemp}`;

    await assert.rejects(storage.save(NEW_PRIMARY));
    backend.failOperation = null;
    await storage.save(NEW_PRIMARY);

    await assertPrimaryAndBackup(backend, NEW_PRIMARY, OLD_PRIMARY);
  });

  it("retains previousPrimary after every failed save stage", async () => {
    const failedStages = [
      `write:${STORAGE_FILES.backupTemp}`,
      `rename:${STORAGE_FILES.backupTemp}->${STORAGE_FILES.backup}`,
      `write:${STORAGE_FILES.primaryTemp}`,
      `rename:${STORAGE_FILES.primaryTemp}->${STORAGE_FILES.primary}`,
    ];

    for (const failedStage of failedStages) {
      const { backend, storage } = createLoadedStorage();
      await storage.load();
      backend.failOperation = failedStage;

      await assert.rejects(storage.save(NEW_PRIMARY));
      backend.failOperation = null;
      await storage.save(NEW_PRIMARY);

      await assertPrimaryAndBackup(backend, NEW_PRIMARY, OLD_PRIMARY);
    }
  });

  it("does not overwrite a valid backup during recovery", async () => {
    const recovered = "primary-recovered";
    const { backend, storage } = createLoadedStorage("{ malformed", OLD_PRIMARY);
    const snapshot = await storage.load();

    assert.equal(snapshot.primary, "{ malformed");
    assert.equal(snapshot.backup, OLD_PRIMARY);
    await storage.save(recovered);

    await assertPrimaryAndBackup(backend, recovered, OLD_PRIMARY);
    assert.equal(backend.calls.some((call) => call.includes(STORAGE_FILES.backupTemp)), false);
  });
});
