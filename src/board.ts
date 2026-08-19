import {
  COLUMNS,
  type Column,
  type SizeClass,
  visibleCards,
} from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

const DRAG_THRESHOLD_PX = 5;

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
  const confirmOverlay = document.querySelector<HTMLElement>("#archive-confirm-overlay")!;
  const confirmCancelBtn = document.querySelector<HTMLButtonElement>("#archive-confirm-cancel")!;
  const confirmOkBtn = document.querySelector<HTMLButtonElement>("#archive-confirm-ok")!;

  let pending:
    | {
        id: string;
        cardEl: HTMLElement;
        startX: number;
        startY: number;
        offsetX: number;
        offsetY: number;
      }
    | null = null;
  let dragId: string | null = null;
  let ghost: HTMLElement | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let editingId: string | null = null;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    store.addToInbox(input.value);
    input.value = "";
    input.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (target?.isContentEditable) return;
    event.preventDefault();
    input.focus();
  });

  archiveDoneBtn.addEventListener("click", () => {
    if (visibleCards(store.state, "done").length === 0) return;
    confirmOverlay.classList.remove("hidden");
    confirmOkBtn.focus();
  });
  confirmCancelBtn.addEventListener("click", () => confirmOverlay.classList.add("hidden"));
  confirmOkBtn.addEventListener("click", () => {
    store.archiveDone();
    confirmOverlay.classList.add("hidden");
  });
  confirmOverlay.addEventListener("click", (event) => {
    if (event.target === confirmOverlay) confirmOverlay.classList.add("hidden");
  });
  openArchiveBtn.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    renderArchive();
  });
  closeArchiveBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.add("hidden");
  });
  archiveList.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-restore-id]");
    if (!btn?.dataset.restoreId) return;
    store.restoreCard(btn.dataset.restoreId);
  });

  switchEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-column]");
    if (!btn) return;
    store.setNarrowColumn(btn.dataset.column as Column);
  });

  boardEl.addEventListener("dblclick", (event) => {
    const cardEl = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!cardEl || cardEl.isContentEditable) return;
    beginEdit(cardEl);
  });

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.isContentEditable) return;
    const cardEl = target.closest<HTMLElement>(".card");
    if (!cardEl || cardEl.isContentEditable) return;
    const id = cardEl.dataset.id;
    if (!id) return;
    const rect = cardEl.getBoundingClientRect();
    pending = {
      id,
      cardEl,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  });

  function beginEdit(cardEl: HTMLElement) {
    const id = cardEl.dataset.id;
    if (!id) return;
    const card = store.state.cards.find((item) => item.id === id);
    if (!card) return;
    cancelPending();
    editingId = id;
    cardEl.contentEditable = "true";
    cardEl.dataset.originalText = card.text;
    cardEl.focus();
    const range = document.createRange();
    range.selectNodeContents(cardEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    cardEl.addEventListener("blur", onEditBlur);
    cardEl.addEventListener("keydown", onEditKeyDown);
  }

  function onEditBlur(event: FocusEvent) {
    finishEdit(event.currentTarget as HTMLElement, true);
  }

  function onEditKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLElement).blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finishEdit(event.currentTarget as HTMLElement, false);
    }
  }

  function finishEdit(cardEl: HTMLElement, save: boolean) {
    if (!editingId || cardEl.dataset.id !== editingId) return;
    cardEl.removeEventListener("blur", onEditBlur);
    cardEl.removeEventListener("keydown", onEditKeyDown);
    cardEl.contentEditable = "false";
    const id = editingId;
    const original = cardEl.dataset.originalText ?? "";
    delete cardEl.dataset.originalText;
    editingId = null;
    if (save) {
      const next = (cardEl.textContent ?? "").trim();
      if (next) store.editCard(id, next);
      else cardEl.textContent = original;
    } else {
      cardEl.textContent = original;
    }
  }

  function distance(x: number, y: number): number {
    if (!pending) return 0;
    return Math.hypot(x - pending.startX, y - pending.startY);
  }

  function startDrag() {
    if (!pending || dragId) return;
    dragId = pending.id;
    dragOffsetX = pending.offsetX;
    dragOffsetY = pending.offsetY;
    const rect = pending.cardEl.getBoundingClientRect();
    ghost = pending.cardEl.cloneNode(true) as HTMLElement;
    ghost.classList.add("card-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    document.body.appendChild(ghost);
    pending.cardEl.classList.add("card-dragging");
  }

  function onPointerMove(event: PointerEvent) {
    if (pending && !dragId && distance(event.clientX, event.clientY) >= DRAG_THRESHOLD_PX) {
      startDrag();
    }
    if (!dragId || !ghost) return;
    ghost.style.transform = `translate(${event.clientX - dragOffsetX}px, ${event.clientY - dragOffsetY}px)`;
    const over = columnAt(event.clientX, event.clientY);
    for (const col of boardEl.querySelectorAll(".col")) {
      col.classList.toggle("drop-target", col === over);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (dragId) finishDrag(event.clientX, event.clientY);
    else cancelPending();
  }

  function onPointerCancel() {
    if (dragId) finishDrag(0, 0, true);
    else cancelPending();
  }

  function cancelPending() {
    pending = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  }

  function finishDrag(x: number, y: number, cancel = false) {
    if (!dragId) return;
    const over = cancel ? null : columnAt(x, y);
    if (over?.dataset.column && over.dataset.column !== findCardColumn(dragId)) {
      store.moveCard(dragId, over.dataset.column as Column);
    }
    dragId = null;
    pending = null;
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
        : items
            .map(
              (card) =>
                `<li class="archive-item"><span>${escapeHtml(card.text)}</span><button type="button" data-restore-id="${card.id}">${t("restore")}</button></li>`,
            )
            .join("");
  }

  function render() {
    if (editingId) return;
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
