export type AutostartApi = {
  isEnabled(): Promise<boolean>;
  enable(): Promise<void>;
  disable(): Promise<void>;
};

export type AutostartError = "read" | "change" | "verification" | "unavailable";

export type AutostartOpenResult = {
  available: boolean;
  enabled: boolean;
  error: AutostartError | null;
};

export type AutostartChangeResult = {
  enabled: boolean;
  error: AutostartError | null;
};

export class AutostartController {
  private readonly api: AutostartApi | null;
  private currentEnabled = false;

  constructor(api: AutostartApi | null) {
    this.api = api;
  }

  get available(): boolean {
    return this.api !== null;
  }

  get enabled(): boolean {
    return this.currentEnabled;
  }

  async open(): Promise<AutostartOpenResult> {
    if (!this.api) {
      return { available: false, enabled: false, error: null };
    }

    try {
      this.currentEnabled = await this.api.isEnabled();
      return { available: true, enabled: this.currentEnabled, error: null };
    } catch {
      return { available: true, enabled: this.currentEnabled, error: "read" };
    }
  }

  async setEnabled(next: boolean): Promise<AutostartChangeResult> {
    const previous = this.currentEnabled;
    if (!this.api) {
      return { enabled: previous, error: "unavailable" };
    }

    try {
      if (next) await this.api.enable();
      else await this.api.disable();

      const actual = await this.api.isEnabled();
      if (actual !== next) {
        this.currentEnabled = previous;
        return { enabled: previous, error: "verification" };
      }

      this.currentEnabled = actual;
      return { enabled: actual, error: null };
    } catch {
      this.currentEnabled = previous;
      return { enabled: previous, error: "change" };
    }
  }
}

export async function loadAutostartApi(): Promise<AutostartApi | null> {
  if (typeof window === "undefined") return null;
  if (!("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) return null;
  return import("@tauri-apps/plugin-autostart");
}
