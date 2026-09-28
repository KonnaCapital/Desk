import { COLUMNS, currentCard, type BoardState, type Column } from "./model.ts";
import { t } from "./i18n.ts";
import type { Store } from "./store.ts";

/** Columns the clock can take a card from, in the order people reach for them. */
const PICK_ORDER: Column[] = ["today", "todo", "inbox"];
const LABEL_MAX = 60;

export type CurrentChoiceGroup = {
  label: string;
  cards: { id: string; text: string }[];
};

/** Open cards the clock can be for, grouped by column; empty columns are left out. */
export function currentChoices(state: BoardState): CurrentChoiceGroup[] {
  return PICK_ORDER.map((column) => ({
    label: COLUMNS.find((col) => col.id === column)!.label,
    cards: state.cards
      .filter((card) => card.column === column && card.archivedAt == null)
      .map((card) => ({ id: card.id, text: card.text })),
  })).filter((group) => group.cards.length > 0);
}

/** One line for the picker; the full text stays in the tooltip. */
export function choiceLabel(text: string, max = LABEL_MAX): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** The picker under the clock that says which card this time is for, and Mark done. */
export function mountFocus(store: Store): void {
  const row = document.querySelector<HTMLElement>(".clock-focus")!;
  const select = document.querySelector<HTMLSelectElement>("#focus-select")!;
  const doneBtn = document.querySelector<HTMLButtonElement>("#focus-done")!;

  let renderedCards: BoardState["cards"] | null = null;
  let renderedCurrentId: string | null | undefined;
  let pickedWithPointer = false;

  select.addEventListener("pointerdown", () => {
    pickedWithPointer = true;
  });
  select.addEventListener("change", () => {
    store.setCurrentCard(select.value || null);
    // Writes can be blocked, so show what the board really holds.
    select.value = store.state.currentCardId ?? "";
    // After a mouse pick, focus would stay here, where Space reopens the list
    // and letters jump to another card instead of reaching the clock.
    if (pickedWithPointer) select.blur();
    pickedWithPointer = false;
  });
  select.addEventListener("blur", () => {
    pickedWithPointer = false;
    render();
  });
  doneBtn.addEventListener("click", () => store.completeCurrentCard());

  function render() {
    const { cards, currentCardId } = store.state;
    const current = currentCard(store.state);
    document.body.dataset.currentCard = current ? "true" : "false";
    doneBtn.classList.toggle("hidden", !current || store.writesBlocked);
    if (cards === renderedCards && currentCardId === renderedCurrentId) return;
    // Rebuilding under an open list would close it; catch up when focus leaves.
    if (document.activeElement === select) return;
    renderedCards = cards;
    renderedCurrentId = currentCardId;

    const groups = currentChoices(store.state);
    row.classList.toggle("hidden", groups.length === 0);
    select.replaceChildren(new Option(current ? t("focusNone") : t("focusPrompt"), ""));
    for (const group of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      for (const card of group.cards) {
        const option = new Option(choiceLabel(card.text), card.id);
        option.title = card.text;
        optgroup.append(option);
      }
      select.append(optgroup);
    }
    select.value = current?.id ?? "";
    select.title = current?.text ?? "";
    select.disabled = store.writesBlocked;
  }

  store.subscribe(render);
  render();
}
