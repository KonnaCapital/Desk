import {
  COLUMNS,
  type Column,
  type SizeClass,
  visibleCards,
} from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mountBoard(store: Store): void {
  const form = document.querySelector<HTMLFormElement>("#capture-form")!;
  const input = document.querySelector<HTMLInputElement>("#capture-input")!;
  const boardEl = document.querySelector<HTMLElement>("#board")!;
  const switchEl = document.querySelector<HTMLElement>("#column-switch")!;
  const archiveDoneBtn = document.querySelector<HTMLButtonElement>("#archive-done")!;
  const openArchiveBtn = document.querySelector<HTMLButtonElement>("#open-archive")!;
  const overlay = document.querySelector<HTMLElement>("#archive-overlay")!;
  const archiveList = document.querySelector<HTMLElement>("#archive-list")!;
  const closeArchiveBtn = document.querySelector<HTMLButtonElement>("#close-archive")!;

  let dragId: string | null = null;
  let ghost: HTMLElement | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addToInbox(input.value);
    input.value = "";
    input.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" || event.key === "n") {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      input.focus();
    }
  });

  archiveDoneBtn.addEventListener("click", () => store.archiveDone());
  openArchiveBtn.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    renderArchive();
  });
  closeArchiveBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.add("hidden");
  });

  switchEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-column]");
    if (!btn) return;
    store.setNarrowColumn(btn.dataset.column as Column);
  });

  boardEl.addEventListener("dblclick", (event) => {
    const cardEl = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    if (!id) return;
    const card = store.state.cards.find((item) => item.id === id);
    if (!card) return;
    const next = window.prompt(t("editCard"), card.text);
    if (next != null) store.editCard(id, next);
  });

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const cardEl = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!cardEl || (event.target as HTMLElement).closest("button")) return;
    const id = cardEl.dataset.id;
    if (!id) return;
    dragId = id;
    const rect = cardEl.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    ghost = cardEl.cloneNode(true) as HTMLElement;
    ghost.classList.add("card-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    document.body.appendChild(ghost);
    cardEl.classList.add("card-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  });

  function onPointerMove(event: PointerEvent) {
    if (!dragId || !ghost) return;
    ghost.style.transform = `translate(${event.clientX - dragOffsetX}px, ${event.clientY - dragOffsetY}px)`;
    const over = columnAt(event.clientX, event.clientY);
    for (const col of boardEl.querySelectorAll(".col")) {
      col.classList.toggle("drop-target", col === over);
    }
  }

  function onPointerUp(event: PointerEvent) {
    finishDrag(event.clientX, event.clientY);
  }

  function onPointerCancel() {
    finishDrag(0, 0, true);
  }

  function finishDrag(x: number, y: number, cancel = false) {
    if (!dragId) return;
    const over = cancel ? null : columnAt(x, y);
    if (over?.dataset.column && over.dataset.column !== findCardColumn(dragId)) {
      store.moveCard(dragId, over.dataset.column as Column);
    }
    dragId = null;
    ghost?.remove();
    ghost = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    boardEl.querySelectorAll(".card-dragging").forEach((el) => el.classList.remove("card-dragging"));
    boardEl.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  }

  function findCardColumn(id: string): string | undefined {
    return store.state.cards.find((card) => card.id === id)?.column;
  }

  function columnAt(x: number, y: number): HTMLElement | null {
    const node = document.elementFromPoint(x, y);
    return node?.closest<HTMLElement>(".col") ?? null;
  }

  function renderArchive() {
    const items = store.state.cards
      .filter((card) => card.archivedAt != null)
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
    archiveList.innerHTML =
      items.length === 0
        ? `<li class="muted">${t("archiveEmpty")}</li>`
        : items.map((card) => `<li>${escapeHtml(card.text)}</li>`).join("");
  }

  function render() {
    const size = document.body.dataset.size as SizeClass | undefined;
    const narrow = size === "sm" || size === "xs";
    switchEl.innerHTML = COLUMNS.map(
      (col) =>
        `<button type="button" data-column="${col.id}" class="${store.state.narrowColumn === col.id ? "active" : ""}">${col.label}</button>`,
    ).join("");

    boardEl.innerHTML = COLUMNS.map((col) => {
      const cards = visibleCards(store.state, col.id);
      const active = !narrow || store.state.narrowColumn === col.id;
      const list =
        cards.length === 0
          ? `<p class="empty">${t("columnEmpty")}</p>`
          : cards
              .map(
                (card) =>
                  `<article class="card" data-id="${card.id}" tabindex="0">${escapeHtml(card.text)}</article>`,
              )
              .join("");
      return `<section class="col${active ? " active" : ""}" data-column="${col.id}">
        <header class="col-head">${col.label}<span class="count">${cards.length}</span></header>
        <div class="col-body">${list}</div>
      </section>`;
    }).join("");

    if (!overlay.classList.contains("hidden")) renderArchive();
  }

  store.subscribe(render);
  window.addEventListener("desk:resize", render);
  render();
}
