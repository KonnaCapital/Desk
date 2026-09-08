export type StorageSnapshot = {
  primary: string | null;
  backup: string | null;
  dataPath: string;
};

export type AtomicStorageBackend = {
  ensureDirectory(): Promise<void>;
  exists(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, data: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
};

export const STORAGE_FILES = {
  primary: "board.json",
  backup: "board.backup.json",
  primaryTemp: "board.json.tmp",
  backupTemp: "board.backup.json.tmp",
} as const;

export type AtomicStorage = {
  readonly dataPath: string;
  load(): Promise<StorageSnapshot>;
  save(json: string): Promise<void>;
};

export function createAtomicStorage(
  backend: AtomicStorageBackend,
  dataPath: string,
  isValidPrimary: (raw: string) => boolean,
): AtomicStorage {
  let previousPrimary: string | null = null;

  async function readOptional(path: string): Promise<string | null> {
    if (!(await backend.exists(path))) return null;
    return backend.readTextFile(path);
  }

  async function writeAndReplace(
    temporaryPath: string,
    targetPath: string,
    data: string,
  ): Promise<void> {
    await backend.writeTextFile(temporaryPath, data);
    await backend.rename(temporaryPath, targetPath);
  }

  return {
    dataPath,
    async load() {
      const primary = await readOptional(STORAGE_FILES.primary);
      const backup = await readOptional(STORAGE_FILES.backup);
      previousPrimary =
        primary !== null && isValidPrimary(primary) ? primary : null;
      return { primary, backup, dataPath };
    },
    async save(json: string) {
      await backend.ensureDirectory();
      if (previousPrimary !== null) {
        await writeAndReplace(
          STORAGE_FILES.backupTemp,
          STORAGE_FILES.backup,
          previousPrimary,
        );
      }
      await writeAndReplace(
        STORAGE_FILES.primaryTemp,
        STORAGE_FILES.primary,
        json,
      );
      previousPrimary = json;
    },
  };
}
