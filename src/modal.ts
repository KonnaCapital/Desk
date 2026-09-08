export type ModalFocusTarget = {
  focus(): void;
};

export type ModalKeyEvent = {
  key: string;
  preventDefault(): void;
  shiftKey?: boolean;
};

export type ModalFocusRoot = {
  querySelectorAll(selector: string): Iterable<ModalFocusTarget>;
};

export type ModalController = {
  open(previousFocus?: ModalFocusTarget | null): void;
  close(): void;
  handleKeyDown(event: ModalKeyEvent): boolean;
  isOpen(): boolean;
};

export function createModalController(
  trigger: ModalFocusTarget,
  initialFocus: ModalFocusTarget,
  setOpen: (open: boolean) => void,
  root?: ModalFocusRoot,
): ModalController {
  let open = false;
  let returnFocus: ModalFocusTarget = trigger;
  let lastFocused: ModalFocusTarget | null = null;

  function focus(target: ModalFocusTarget) {
    target.focus();
    lastFocused = target;
  }

  function focusableElements(): ModalFocusTarget[] {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((target) => !(target as ModalFocusTarget & { disabled?: boolean }).disabled);
  }

  const controller: ModalController = {
    open(previousFocus = trigger) {
      if (open) return;
      returnFocus = previousFocus ?? trigger;
      open = true;
      setOpen(true);
      focus(initialFocus);
    },
    close() {
      if (!open) return;
      open = false;
      setOpen(false);
      focus(returnFocus);
      returnFocus = trigger;
      lastFocused = null;
    },
    handleKeyDown(event) {
      if (!open) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        controller.close();
        return true;
      }
      if (event.key !== "Tab" || !root) return false;

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        focus(initialFocus);
        return true;
      }

      const active = typeof document === "undefined" ? null : document.activeElement;
      const currentTarget =
        (active as ModalFocusTarget | null) ?? lastFocused ?? initialFocus;
      const current = elements.indexOf(currentTarget);
      const next = event.shiftKey
        ? current <= 0
          ? elements.length - 1
          : current - 1
        : current < 0 || current === elements.length - 1
          ? 0
          : current + 1;
      event.preventDefault();
      focus(elements[next]);
      return true;
    },
    isOpen() {
      return open;
    },
  };

  return controller;
}
