import { sizeClass, type View } from "./model.ts";
import type { Store } from "./store.ts";

export function mountChrome(store: Store): void {
  const boardBtn = document.querySelector<HTMLButtonElement>("#view-board")!;
  const clockBtn = document.querySelector<HTMLButtonElement>("#view-clock")!;
  const pinBtn = document.querySelector<HTMLButtonElement>("#pin-btn")!;
  const minBtn = document.querySelector<HTMLButtonElement>("#min-btn")!;
  const closeBtn = document.querySelector<HTMLButtonElement>("#close-btn")!;
  const boardView = document.querySelector<HTMLElement>("#board-view")!;
  const clockView = document.querySelector<HTMLElement>("#clock-view")!;
  const chrome = document.querySelector<HTMLElement>(".chrome")!;

  let nativeWindow: Awaited<ReturnType<typeof getWindow>> = null;
  void getWindow().then((current) => {
    nativeWindow = current;
  });

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
  });
  applyView(store.state.view);
  void applyPin(store.state.pinned);
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
