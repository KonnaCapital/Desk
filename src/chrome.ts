import { sizeClass, type View } from "./model.ts";
import {
  AutostartController,
  loadAutostartApi,
  type AutostartError,
} from "./autostart.ts";
import { t } from "./i18n.ts";
import type { PersistenceState, Store } from "./store.ts";

export function mountChrome(store: Store): void {
  const boardBtn = document.querySelector<HTMLButtonElement>("#view-board")!;
  const clockBtn = document.querySelector<HTMLButtonElement>("#view-clock")!;
  const pinBtn = document.querySelector<HTMLButtonElement>("#pin-btn")!;
  const settingsBtn = document.querySelector<HTMLButtonElement>("#settings-btn")!;
  const minBtn = document.querySelector<HTMLButtonElement>("#min-btn")!;
  const closeBtn = document.querySelector<HTMLButtonElement>("#close-btn")!;
  const persistenceStatus = document.querySelector<HTMLElement>("#persistence-status")!;
  const settingsOverlay = document.querySelector<HTMLElement>("#settings-overlay")!;
  const closeSettingsBtn = document.querySelector<HTMLButtonElement>("#close-settings")!;
  const autostartToggle = document.querySelector<HTMLInputElement>("#autostart-toggle")!;
  const autostartStatus = document.querySelector<HTMLElement>("#settings-autostart-status")!;
  const boardView = document.querySelector<HTMLElement>("#board-view")!;
  const clockView = document.querySelector<HTMLElement>("#clock-view")!;
  const chrome = document.querySelector<HTMLElement>(".chrome")!;

  let nativeWindow: Awaited<ReturnType<typeof getWindow>> = null;
  void getWindow().then((current) => {
    nativeWindow = current;
    if (current) void installCloseHandler(current, store);
  });

  const autostartControllerPromise = loadAutostartApi()
    .then((api) => new AutostartController(api))
    .catch(() => new AutostartController(null));
  let autostartController: AutostartController | null = null;

  const beginDrag = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, a, .card")) return;
    void nativeWindow?.startDragging();
  };

  chrome.addEventListener("mousedown", beginDrag);
  clockView.addEventListener("mousedown", beginDrag);

  boardBtn.addEventListener("click", () => store.setView("board"));
  clockBtn.addEventListener("click", () => store.setView("clock"));
  pinBtn.addEventListener("click", () => store.setPinned(!store.state.pinned));

  settingsBtn.addEventListener("click", () => {
    void openSettings();
  });
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) closeSettings();
  });
  autostartToggle.addEventListener("change", () => {
    void changeAutostart();
  });

  minBtn.addEventListener("click", async () => {
    const windowApi = await getWindow();
    await windowApi?.minimize();
  });
  closeBtn.addEventListener("click", async () => {
    const windowApi = await getWindow();
    await windowApi?.close();
  });

  function applyView(view: View) {
    const size = sizeClass(window.innerWidth, window.innerHeight);
    document.body.dataset.view = view;
    document.body.dataset.size = size;
    document.body.dataset.pinned = store.state.pinned ? "true" : "false";
    boardBtn.classList.toggle("active", view === "board");
    clockBtn.classList.toggle("active", view === "clock");
    boardView.classList.toggle("hidden", view !== "board");
    clockView.classList.toggle("hidden", view !== "clock");
    pinBtn.classList.toggle("active", store.state.pinned);
    pinBtn.setAttribute("aria-pressed", store.state.pinned ? "true" : "false");
  }

  function updateSize() {
    const next = sizeClass(window.innerWidth, window.innerHeight);
    if (document.body.dataset.size !== next) {
      document.body.dataset.size = next;
      applyView(store.state.view);
      window.dispatchEvent(new Event("desk:resize"));
    }
  }

  window.addEventListener("resize", updateSize);
  new ResizeObserver(updateSize).observe(document.documentElement);

  store.subscribe(() => {
    applyView(store.state.view);
    void applyPin(store.state.pinned);
    applyPersistenceStatus(store.persistenceStatus);
  });
  applyView(store.state.view);
  void applyPin(store.state.pinned);
  applyPersistenceStatus(store.persistenceStatus);

  async function openSettings() {
    settingsOverlay.classList.remove("hidden");
    settingsBtn.setAttribute("aria-expanded", "true");
    autostartToggle.disabled = true;
    autostartStatus.textContent = "";

    autostartController = await autostartControllerPromise;
    const result = await autostartController.open();
    autostartToggle.checked = result.enabled;
    autostartToggle.disabled = !result.available || result.error === "read";
    autostartStatus.textContent = result.error
      ? autostartErrorMessage(result.error)
      : result.available
        ? ""
        : t("settingsAutostartUnavailable");
  }

  function closeSettings() {
    settingsOverlay.classList.add("hidden");
    settingsBtn.setAttribute("aria-expanded", "false");
  }

  async function changeAutostart() {
    if (!autostartController) return;
    autostartToggle.disabled = true;
    const result = await autostartController.setEnabled(autostartToggle.checked);
    autostartToggle.checked = result.enabled;
    autostartToggle.disabled = !autostartController.available;
    autostartStatus.textContent = result.error ? autostartErrorMessage(result.error) : "";
  }

  function applyPersistenceStatus(state: PersistenceState) {
    const visible = state.status !== "saved";
    persistenceStatus.classList.toggle("hidden", !visible);
    persistenceStatus.dataset.status = state.status;
    if (!visible) {
      persistenceStatus.textContent = "";
      return;
    }
    persistenceStatus.textContent =
      state.status === "saving"
        ? t("persistenceSaving")
        : state.status === "recovered"
          ? t("persistenceRecovered")
          : `${t("persistenceError")} ${state.dataPath}`;
  }
}

function autostartErrorMessage(error: AutostartError): string {
  switch (error) {
    case "read":
      return t("settingsAutostartReadError");
    case "verification":
      return t("settingsAutostartVerificationError");
    case "change":
      return t("settingsAutostartChangeError");
    case "unavailable":
      return t("settingsAutostartUnavailable");
  }
}

async function installCloseHandler(
  current: NonNullable<Awaited<ReturnType<typeof getWindow>>>,
  store: Store,
): Promise<void> {
  let closing = false;
  try {
    await current.onCloseRequested(async (event) => {
      if (closing) {
        event.preventDefault();
        return;
      }
      closing = true;
      event.preventDefault();
      try {
        await store.flush();
      } catch {
        // Store.flush keeps persistence failures in its status; never block close.
      } finally {
        try {
          await current.destroy();
        } catch {
          closing = false;
        }
      }
    });
  } catch {
    // Browser preview and unavailable native event APIs need no close hook.
  }
}

async function getWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function applyPin(pinned: boolean) {
  const current = await getWindow();
  if (!current) return;
  try {
    await current.setAlwaysOnTop(pinned);
  } catch {
    // Browser preview has no window chrome.
  }
}
