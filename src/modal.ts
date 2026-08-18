export type ModalFocusTarget = {
  focus(): void;
};

export type ModalKeyEvent = {
  key: string;
  preventDefault(): void;
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
): ModalController {
  let open = false;
  let returnFocus: ModalFocusTarget = trigger;

  return {
    open(previousFocus = trigger) {
      if (open) return;
      returnFocus = previousFocus ?? trigger;
      open = true;
      setOpen(true);
      initialFocus.focus();
    },
    close() {
      if (!open) return;
      open = false;
      setOpen(false);
      returnFocus.focus();
      returnFocus = trigger;
    },
    handleKeyDown(event) {
      if (!open || event.key !== "Escape") return false;
      event.preventDefault();
      this.close();
      return true;
    },
    isOpen() {
      return open;
    },
  };
}
