import { sizeClass, type View } from "./model.ts";
import {
  AutostartController,
  loadAutostartApi,
  type AutostartError,
} from "./autostart.ts";
import { registerCloseHandler, type CloseFlushResult } from "./close.ts";
import { t } from "./i18n.ts";
import { createModalController } from "./modal.ts";
import type { PersistenceState, Store } from "./store.ts";

export async function mountChrome(store: Store): Promise<void> {
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

  let closeProtectionMessage: string | null = null;
  const nativeWindow = await getWindow();
  if (nativeWindow) {
    const registration = await registerCloseHandler(
      nativeWindow,
      () => store.flush(),
      (result: Exclude<CloseFlushResult, "flushed">) => {
        closeProtectionMessage =
          result === "timed-out"
            ? t("persistenceCloseTimeout")
            : store.persistenceStatus.error ?? t("persistenceCloseError");
        applyPersistenceStatus(store.persistenceStatus);
      },
    );
    if (!registration.registered) {
      closeProtectionMessage = t("persistenceCloseRegistrationError");
    }
  }

  const autostartControllerPromise = loadAutostartApi()
    .then((api) => new AutostartController(api))
    .catch(() => new AutostartController(null));
  let autostartController: AutostartController | null = null;
  const settingsModal = createModalController(
    settingsBtn,
    closeSettingsBtn,
    (open) => {
      settingsOverlay.classList.toggle("hidden", !open);
      settingsBtn.setAttribute("aria-expanded", String(open));
    },
  );

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
    settingsModal.open(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    void openSettings();
  });
  closeSettingsBtn.addEventListener("click", () => settingsModal.close());
  settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) settingsModal.close();
  });
  document.addEventListener("keydown", (event) => {
    settingsModal.handleKeyDown(event);
  });
  autostartToggle.addEventListener("change", () => {
    void changeAutostart();
  });

  minBtn.addEventListener("click", async () => {
    await nativeWindow?.minimize();
  });
  closeBtn.addEventListener("click", async () => {
    await nativeWindow?.close();
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

  async function changeAutostart() {
    if (!autostartController) return;
    autostartToggle.disabled = true;
    const result = await autostartController.setEnabled(autostartToggle.checked);
    autostartToggle.checked = result.enabled;
    autostartToggle.disabled = !autostartController.available;
    autostartStatus.textContent = result.error ? autostartErrorMessage(result.error) : "";
  }

  function applyPersistenceStatus(state: PersistenceState) {
    const message =
      closeProtectionMessage ??
      (state.status === "saving"
        ? t("persistenceSaving")
        : state.status === "recovered"
          ? t("persistenceRecovered")
          : state.status === "error"
            ? `${t("persistenceError")} ${state.dataPath}`
            : null);
    const visible = message !== null;
    persistenceStatus.classList.toggle("hidden", !visible);
    persistenceStatus.dataset.status = state.status;
    persistenceStatus.textContent = message ?? "";
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
