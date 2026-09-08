import {
  COLUMNS,
  type Column,
  type SizeClass,
  visibleCards,
} from "./model.ts";
import { t } from "./i18n.ts";
import { createModalController } from "./modal.ts";
import type { Store } from "./store.ts";

const DRAG_THRESHOLD_PX = 5;

export type DropHit = { column: Column; followNarrow: boolean };

function columnFrom(value: string | undefined): Column | null {
  return COLUMNS.some((col) => col.id === value) ? (value as Column) : null;
}

export function dropHitFromClosest(
  closest: (selector: string) => { dataset: { column?: string } } | null,
): DropHit | null {
  const col = columnFrom(closest(".col[data-column]")?.dataset.column);
  if (col) return { column: col, followNarrow: false };
  const sw = columnFrom(closest(".column-switch [data-column]")?.dataset.column);
  if (sw) return { column: sw, followNarrow: true };
  return null;
}

export function applyCardDrop(
  currentColumn: string | undefined,
  hit: DropHit | null,
): { moveTo: Column | null; followNarrow: boolean } {
  if (!hit) return { moveTo: null, followNarrow: false };
  return {
    moveTo: hit.column !== currentColumn ? hit.column : null,
    followNarrow: hit.followNarrow,
  };
}

export function shouldHoldBoardPaint(
  editingId: string | null,
  dragId: string | null,
  pendingId: string | null = null,
): boolean {
  return editingId != null || dragId != null || pendingId != null;
}

export function overlayEscapeTarget(confirmHidden: boolean, archiveHidden: boolean): "confirm" | "archive" | null {
  if (!confirmHidden) return "confirm";
  if (!archiveHidden) return "archive";
  return null;
}

export function escapeHtml(text: string): string {
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
  const archiveModal = createModalController(
    openArchiveBtn,
    closeArchiveBtn,
    (open) => overlay.classList.toggle("hidden", !open),
    overlay.querySelector<HTMLElement>(".overlay-card")!,
  );
  const confirmModal = createModalController(
    archiveDoneBtn,
    confirmOkBtn,
    (open) => confirmOverlay.classList.toggle("hidden", !open),
    confirmOverlay.querySelector<HTMLElement>(".overlay-card")!,
  );

  let pending:
    | {
        id: string;
        pointerId: number;
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
  let capturedCard: HTMLElement | null = null;
  let capturedPointerId: number | null = null;
  let deferredPaint = false;
  let lastRenderedCards = store.state.cards;
  let lastRenderedNarrowColumn = store.state.narrowColumn;
  let lastRenderedSize = document.body.dataset.size;

  if (store.writesBlocked) {
    input.disabled = true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (store.writesBlocked) return;
    store.addToInbox(input.value);
    input.value = "";
    input.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/") return;
    if (store.state.view !== "board") return;
    if (document.querySelector(".overlay:not(.hidden)")) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (target?.isContentEditable) return;
    event.preventDefault();
    input.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (editingId) return;
      if (confirmModal.handleKeyDown(event)) return;
      archiveModal.handleKeyDown(event);
      return;
    }
    if (event.key !== "Tab") return;
    if (confirmModal.handleKeyDown(event)) return;
    archiveModal.handleKeyDown(event);
  });

  archiveDoneBtn.addEventListener("click", () => {
    if (visibleCards(store.state, "done").length === 0) return;
    confirmModal.open();
  });
  confirmCancelBtn.addEventListener("click", () => confirmModal.close());
  confirmOkBtn.addEventListener("click", () => {
    store.archiveDone();
    confirmModal.close();
  });
  confirmOverlay.addEventListener("click", (event) => {
    if (event.target === confirmOverlay) confirmModal.close();
  });
  openArchiveBtn.addEventListener("click", () => {
    archiveModal.open();
    renderArchive();
  });
  closeArchiveBtn.addEventListener("click", () => archiveModal.close());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) archiveModal.close();
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

  boardEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== "F2") return;
    const cardEl = (event.target as HTMLElement).closest<HTMLElement>(".card");
    if (!cardEl || cardEl.isContentEditable) return;
    event.preventDefault();
    beginEdit(cardEl);
  });

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (pending || dragId) return;
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.isContentEditable) return;
    const cardEl = target.closest<HTMLElement>(".card");
    if (!cardEl || cardEl.isContentEditable) return;
    const id = cardEl.dataset.id;
    if (!id) return;
    const rect = cardEl.getBoundingClientRect();
    pending = {
      id,
      pointerId: event.pointerId,
      cardEl,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    capturedCard = cardEl;
    capturedPointerId = event.pointerId;
    cardEl.addEventListener("lostpointercapture", onLostPointerCapture);
    try {
      cardEl.setPointerCapture(event.pointerId);
    } catch {
      // The window-level listeners and blur cleanup remain as a fallback.
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  });

  window.addEventListener("blur", cancelActivePointer);

  function beginEdit(cardEl: HTMLElement) {
    if (!cardEl.isConnected) return;
    const id = cardEl.dataset.id;
    if (!id) return;
    const card = store.state.cards.find((item) => item.id === id);
    if (!card) return;
    if (editingId) return;
    editingId = id;
    cancelPending();
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
      event.stopPropagation();
      (event.currentTarget as HTMLElement).blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
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
    requestPaint();
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
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!dragId && distance(event.clientX, event.clientY) >= DRAG_THRESHOLD_PX) {
      startDrag();
    }
    if (!dragId || !ghost) return;
    ghost.style.transform = `translate(${event.clientX - dragOffsetX}px, ${event.clientY - dragOffsetY}px)`;
    paintDropTarget(hitAt(event.clientX, event.clientY));
  }

  function onPointerUp(event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (dragId) finishDrag(event.clientX, event.clientY);
    else cancelPending();
  }

  function onPointerCancel(event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (dragId) finishDrag(0, 0, true);
    else cancelPending();
  }

  function onLostPointerCapture(event: PointerEvent) {
    if (event.pointerId !== capturedPointerId || !pending) return;
    if (dragId) finishDrag(0, 0, true);
    else cancelPending();
  }

  function clearPointerCapture() {
    const cardEl = capturedCard;
    const pointerId = capturedPointerId;
    capturedCard = null;
    capturedPointerId = null;
    if (!cardEl) return;
    cardEl.removeEventListener("lostpointercapture", onLostPointerCapture);
    if (pointerId === null) return;
    try {
      if (cardEl.hasPointerCapture(pointerId)) cardEl.releasePointerCapture(pointerId);
    } catch {
      // The pointer may already have been cancelled or the card detached.
    }
  }

  function cancelActivePointer() {
    if (dragId) finishDrag(0, 0, true);
    else if (pending) cancelPending();
  }

  function cancelPending() {
    const hadPending = pending != null;
    pending = null;
    clearPointerCapture();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    if (hadPending) requestPaint();
  }

  function finishDrag(x: number, y: number, cancel = false) {
    if (!dragId) return;
    const id = dragId;
    const hit = cancel ? null : hitAt(x, y);
    const action = applyCardDrop(findCardColumn(id), hit);
    pending = null;
    clearPointerCapture();
    ghost?.remove();
    ghost = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    boardEl.querySelectorAll(".card-dragging").forEach((el) => el.classList.remove("card-dragging"));
    paintDropTarget(null);
    if (action.moveTo) store.moveCard(id, action.moveTo);
    if (action.followNarrow && hit) store.setNarrowColumn(hit.column);
    dragId = null;
    requestPaint(true);
  }

  function findCardColumn(id: string): string | undefined {
    return store.state.cards.find((card) => card.id === id)?.column;
  }

  function hitAt(x: number, y: number): DropHit | null {
    const node = document.elementFromPoint(x, y);
    if (!(node instanceof Element)) return null;
    return dropHitFromClosest((selector) => node.closest<HTMLElement>(selector));
  }

  function paintDropTarget(hit: DropHit | null) {
    for (const col of boardEl.querySelectorAll<HTMLElement>(".col")) {
      col.classList.toggle("drop-target", Boolean(hit && !hit.followNarrow && col.dataset.column === hit.column));
    }
    for (const btn of switchEl.querySelectorAll<HTMLElement>("[data-column]")) {
      btn.classList.toggle("drop-target", Boolean(hit && hit.followNarrow && btn.dataset.column === hit.column));
    }
  }

  function renderArchive(focusRestoreId: string | null = null) {
    const items = store.state.cards
      .filter((card) => card.archivedAt != null)
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
    archiveList.innerHTML =
      items.length === 0
        ? `<li class="muted">${t("archiveEmpty")}</li>`
        : items
            .map(
              (card) =>
                `<li class="archive-item"><span>${escapeHtml(card.text)}</span><button type="button" data-restore-id="${escapeHtml(card.id)}">${t("restore")}</button></li>`,
            )
            .join("");
    if (focusRestoreId) {
      const restoreButton = Array.from(
        archiveList.querySelectorAll<HTMLButtonElement>("[data-restore-id]"),
      ).find((button) => button.dataset.restoreId === focusRestoreId);
      (restoreButton ?? closeArchiveBtn).focus({ preventScroll: true });
    }
  }

  function render() {
    const activeElement = document.activeElement;
    const focusedCardId =
      activeElement instanceof HTMLElement && boardEl.contains(activeElement)
        ? activeElement.closest<HTMLElement>(".card")?.dataset.id ?? null
        : null;
    const focusedSwitchColumn =
      activeElement instanceof HTMLElement && switchEl.contains(activeElement)
        ? activeElement.closest<HTMLElement>("[data-column]")?.dataset.column ?? null
        : null;
    const focusedRestoreId =
      activeElement instanceof HTMLElement && archiveList.contains(activeElement)
        ? activeElement.closest<HTMLButtonElement>("[data-restore-id]")?.dataset.restoreId ?? null
        : null;
    const scrollPositions = new Map<string, { left: number; top: number }>();
    for (const col of boardEl.querySelectorAll<HTMLElement>(".col[data-column]")) {
      const column = col.dataset.column;
      const body = col.querySelector<HTMLElement>(".col-body");
      if (column && body) {
        scrollPositions.set(column, { left: body.scrollLeft, top: body.scrollTop });
      }
    }

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
                  `<article class="card" data-id="${escapeHtml(card.id)}" tabindex="0">${escapeHtml(card.text)}</article>`,
              )
              .join("");
      return `<section class="col${active ? " active" : ""}" data-column="${col.id}">
        <header class="col-head">${col.label}<span class="count">${cards.length}</span></header>
        <div class="col-body">${list}</div>
      </section>`;
    }).join("");

    for (const col of boardEl.querySelectorAll<HTMLElement>(".col[data-column]")) {
      const body = col.querySelector<HTMLElement>(".col-body");
      const position = col.dataset.column ? scrollPositions.get(col.dataset.column) : undefined;
      if (body && position) {
        body.scrollLeft = position.left;
        body.scrollTop = position.top;
      }
    }

    if (!overlay.classList.contains("hidden")) renderArchive(focusedRestoreId);
    if (focusedCardId) {
      const focusedCard = Array.from(boardEl.querySelectorAll<HTMLElement>(".card")).find(
        (card) => card.dataset.id === focusedCardId && card.getClientRects().length > 0,
      );
      focusedCard?.focus({ preventScroll: true });
    } else if (focusedSwitchColumn) {
      const focusedSwitch = Array.from(
        switchEl.querySelectorAll<HTMLElement>("[data-column]"),
      ).find((button) => button.dataset.column === focusedSwitchColumn);
      focusedSwitch?.focus({ preventScroll: true });
    }
    lastRenderedCards = store.state.cards;
    lastRenderedNarrowColumn = store.state.narrowColumn;
    lastRenderedSize = document.body.dataset.size;
    deferredPaint = false;
  }

  function requestPaint(force = false) {
    const changed =
      force ||
      deferredPaint ||
      store.state.cards !== lastRenderedCards ||
      store.state.narrowColumn !== lastRenderedNarrowColumn ||
      document.body.dataset.size !== lastRenderedSize;
    if (!changed) return;
    if (shouldHoldBoardPaint(editingId, dragId, pending?.id ?? null)) {
      deferredPaint = true;
      return;
    }
    render();
  }

  store.subscribe(requestPaint);
  window.addEventListener("desk:resize", () => requestPaint());
  requestPaint(true);
}
