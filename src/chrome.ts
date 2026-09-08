import { clockDigitsLayout, sizeClass, type View } from "./model.ts";
import {
  AutostartController,
  loadAutostartApi,
  type AutostartError,
} from "./autostart.ts";
import { registerCloseHandler, type CloseDecision, type CloseFlushResult } from "./close.ts";
import { t } from "./i18n.ts";
import {
  applyCornerSnapIfNeeded,
  MOVE_SETTLE_MS,
  type CornerSnapHost,
  type MonitorWorkArea,
} from "./corner-snap.ts";
import { persistChromeCopy } from "./persist-status.ts";
import { createModalController } from "./modal.ts";
import {
  clockSoloTarget,
  nextClockSolo,
  shouldBlockTimerToggle,
} from "./clock-solo.ts";
import { WindowPinController } from "./pin.ts";
import type { PersistenceState, Store } from "./store.ts";

export async function mountChrome(store: Store): Promise<void> {
  const boardBtn = document.querySelector<HTMLButtonElement>("#view-board")!;
  const clockBtn = document.querySelector<HTMLButtonElement>("#view-clock")!;
  const pinBtn = document.querySelector<HTMLButtonElement>("#pin-btn")!;
  const settingsBtn = document.querySelector<HTMLButtonElement>("#settings-btn")!;
  const minBtn = document.querySelector<HTMLButtonElement>("#min-btn")!;
  const closeBtn = document.querySelector<HTMLButtonElement>("#close-btn")!;
  const closeDialog = document.querySelector<HTMLDialogElement>("#close-save-dialog")!;
  const closeMessage = document.querySelector<HTMLElement>("#close-save-message")!;
  closeDialog.addEventListener("keydown", (event) => event.stopPropagation());
  const persistenceStatus = document.querySelector<HTMLElement>("#persistence-status")!;
  const settingsOverlay = document.querySelector<HTMLElement>("#settings-overlay")!;
  const closeSettingsBtn = document.querySelector<HTMLButtonElement>("#close-settings")!;
  const autostartToggle = document.querySelector<HTMLInputElement>("#autostart-toggle")!;
  const autostartStatus = document.querySelector<HTMLElement>("#settings-autostart-status")!;
  const showDataFolderBtn = document.querySelector<HTMLButtonElement>("#show-data-folder")!;
  const dataFolderStatus = document.querySelector<HTMLElement>("#settings-data-folder-status")!;
  const boardView = document.querySelector<HTMLElement>("#board-view")!;
  const clockView = document.querySelector<HTMLElement>("#clock-view")!;
  const chrome = document.querySelector<HTMLElement>(".chrome")!;

  let closeProtectionMessage: string | null = null;
  let closeProblemShown = false;
  let requestClose: (() => Promise<void>) | null = null;
  let lastPersistStatus: PersistenceState["status"] | null = null;
  let persistHideTimer: number | null = null;
  let liveDrag = false;
  let applyingSnap = false;
  let movedQuietTimer: number | null = null;
  let clockSolo = false;
  const nativeWindow = await getWindow();
  const pinController = new WindowPinController(nativeWindow);
  let pinError: string | null = null;
  if (nativeWindow) {
    const registration = await registerCloseHandler(
      nativeWindow,
      // A blocked load has accepted no edits and must remain closable.
      () => store.writesBlocked ? Promise.resolve("saved" as const) : store.flush(),
      (result: Exclude<CloseFlushResult, "flushed">) => {
        closeProblemShown = true;
        closeProtectionMessage =
          result === "timed-out"
            ? t("persistenceCloseTimeout")
            : `${t("persistenceCloseError")} ${store.persistenceStatus.dataPath}`;
        applyPersistenceStatus(store.persistenceStatus);
        closeMessage.textContent = closeProtectionMessage;
        return new Promise<CloseDecision>((resolve) => {
          closeDialog.returnValue = "keep-open";
          closeDialog.addEventListener("close", () => {
            const choice = closeDialog.returnValue;
            resolve(choice === "retry" || choice === "discard" ? choice : "keep-open");
          }, { once: true });
          closeDialog.showModal();
        });
      },
    );
    requestClose = registration.requestClose;
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
    settingsOverlay,
  );

  const beginDrag = (event: MouseEvent) => {
    if (store.state.pinned) return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, a, .card")) return;
    liveDrag = true;
    void nativeWindow?.startDragging();
  };

  const finishDrag = async () => {
    if (!liveDrag || applyingSnap || store.state.pinned) return;
    liveDrag = false;
    if (movedQuietTimer !== null) {
      window.clearTimeout(movedQuietTimer);
      movedQuietTimer = null;
    }
    if (!nativeWindow) return;
    applyingSnap = true;
    try {
      await applyCornerSnapIfNeeded(createSnapHost(nativeWindow));
    } catch {
      // Browser preview has no window chrome.
    } finally {
      applyingSnap = false;
    }
  };

  chrome.addEventListener("mousedown", beginDrag);
  clockView.addEventListener("mousedown", beginDrag);
  document.addEventListener("pointerup", () => void finishDrag(), true);
  document.addEventListener("mouseup", () => void finishDrag(), true);
  if (nativeWindow) {
    void nativeWindow.onMoved(() => {
      if (applyingSnap || store.state.pinned || !liveDrag) return;
      if (movedQuietTimer !== null) window.clearTimeout(movedQuietTimer);
      movedQuietTimer = window.setTimeout(() => void finishDrag(), MOVE_SETTLE_MS);
    });
  }

  boardBtn.addEventListener("click", () => store.setView("board"));
  clockBtn.addEventListener("click", () => store.setView("clock"));
  pinBtn.addEventListener("click", async () => {
    if (store.writesBlocked) return;
    pinBtn.disabled = true;
    const next = !store.state.pinned;
    try {
      await pinController.apply(next);
      pinError = null;
      store.setPinned(next);
    } catch {
      pinError = t("pinChangeError");
      try {
        await pinController.apply(store.state.pinned);
      } catch {
        // Keep the error visible if restoring the previous native state also fails.
      }
    } finally {
      pinBtn.disabled = false;
      applyPersistenceStatus(store.persistenceStatus);
    }
  });

  clockView.addEventListener(
    "click",
    (event) => {
      const target = clockSoloTarget(event.target);
      const next = nextClockSolo(store.state.pinned, store.state.view, clockSolo, target);
      if (shouldBlockTimerToggle(store.state.pinned, store.state.view, clockSolo, target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      clockSolo = next;
      document.body.dataset.clockSolo = clockSolo ? "true" : "false";
    },
    true,
  );

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
    if (
      event.key === "Escape" &&
      clockSolo &&
      settingsOverlay.classList.contains("hidden")
    ) {
      clockSolo = false;
      document.body.dataset.clockSolo = "false";
    }
  });
  autostartToggle.addEventListener("change", () => {
    void changeAutostart();
  });
  showDataFolderBtn.addEventListener("click", () => {
    void openDataFolder();
  });

  minBtn.addEventListener("click", async () => {
    await nativeWindow?.minimize();
  });
  closeBtn.addEventListener("click", async () => {
    await requestClose?.();
  });

  function applyView(view: View) {
    const size = sizeClass(window.innerWidth, window.innerHeight);
    document.body.dataset.view = view;
    document.body.dataset.size = size;
    document.body.dataset.clockDigits = clockDigitsLayout(window.innerWidth, window.innerHeight);
    document.body.dataset.pinned = store.state.pinned ? "true" : "false";
    boardBtn.classList.toggle("active", view === "board");
    clockBtn.classList.toggle("active", view === "clock");
    boardView.classList.toggle("hidden", view !== "board");
    clockView.classList.toggle("hidden", view !== "clock");
    pinBtn.classList.toggle("active", store.state.pinned);
    pinBtn.setAttribute("aria-pressed", store.state.pinned ? "true" : "false");
    applyDragRegions(store.state.pinned);
    if (!store.state.pinned || view !== "clock") clockSolo = false;
    document.body.dataset.clockSolo = clockSolo ? "true" : "false";
  }

  function updateSize() {
    const next = sizeClass(window.innerWidth, window.innerHeight);
    const clock = clockDigitsLayout(window.innerWidth, window.innerHeight);
    const sizeChanged = document.body.dataset.size !== next;
    const clockChanged = document.body.dataset.clockDigits !== clock;
    if (!sizeChanged && !clockChanged) return;
    document.body.dataset.size = next;
    document.body.dataset.clockDigits = clock;
    if (sizeChanged) {
      applyView(store.state.view);
      window.dispatchEvent(new Event("desk:resize"));
    }
  }

  window.addEventListener("resize", updateSize);
  new ResizeObserver(updateSize).observe(document.documentElement);

  store.subscribe(() => {
    applyView(store.state.view);
    applyPersistenceStatus(store.persistenceStatus);
  });
  applyView(store.state.view);
  pinBtn.disabled = true;
  try {
    await pinController.apply(store.state.pinned);
  } catch {
    pinError = t("pinChangeError");
    try {
      await pinController.apply(false);
      if (store.state.pinned) store.setPinned(false);
    } catch {
      // Keep the error visible if the native default cannot be restored.
    }
  } finally {
    pinBtn.disabled = false;
  }
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

  async function openDataFolder() {
    dataFolderStatus.textContent = "";
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_data_folder");
    } catch {
      dataFolderStatus.textContent = t("showDataFolderError");
    }
  }

  function applyPersistenceStatus(state: PersistenceState) {
    if (closeProblemShown && (state.status === "saved" || state.status === "recovered")) {
      closeProtectionMessage = null;
      closeProblemShown = false;
      if (closeDialog.open) closeMessage.textContent = t("persistenceCloseSaved");
    }
    const allowSavedFlash = lastPersistStatus === "saving" && state.status === "saved";
    lastPersistStatus = state.status;
    const copy = persistChromeCopy(
      state.status,
      closeProtectionMessage ?? (state.status === "error" ? null : pinError),
      state.dataPath,
      allowSavedFlash,
      state.error,
    );
    if (persistHideTimer !== null) {
      window.clearTimeout(persistHideTimer);
      persistHideTimer = null;
    }
    persistenceStatus.classList.toggle("hidden", copy.text === null);
    persistenceStatus.dataset.status = pinError ? "error" : state.status;
    persistenceStatus.textContent = copy.text ?? "";
    persistenceStatus.title = copy.text ?? "";
    if (copy.hideAfterMs > 0) {
      persistHideTimer = window.setTimeout(() => {
        persistHideTimer = null;
        persistenceStatus.classList.add("hidden");
        persistenceStatus.textContent = "";
      }, copy.hideAfterMs);
    }
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

function createSnapHost(
  nativeWindow: NonNullable<Awaited<ReturnType<typeof getWindow>>>,
): CornerSnapHost {
  return {
    outerPosition: () => nativeWindow.outerPosition(),
    outerSize: () => nativeWindow.outerSize(),
    async availableMonitors() {
      const { availableMonitors } = await import("@tauri-apps/api/window");
      const monitors = await availableMonitors();
      return monitors.map(
        (monitor): MonitorWorkArea => ({
          scaleFactor: monitor.scaleFactor,
          x: monitor.workArea.position.x,
          y: monitor.workArea.position.y,
          width: monitor.workArea.size.width,
          height: monitor.workArea.size.height,
        }),
      );
    },
    async setPosition(x, y) {
      const { PhysicalPosition } = await import("@tauri-apps/api/window");
      await nativeWindow.setPosition(new PhysicalPosition(x, y));
    },
  };
}

function applyDragRegions(pinned: boolean) {
  const regions = document.querySelectorAll<HTMLElement>(".chrome-left, .app-name");
  for (const el of regions) {
    if (pinned) el.removeAttribute("data-tauri-drag-region");
    else el.setAttribute("data-tauri-drag-region", "");
  }
}
