const EN = {
  settingsAutostartUnavailable: "Available in the Desk app only.",
  settingsAutostartReadError: "Could not read the login setting.",
  settingsAutostartChangeError: "Could not change the login setting.",
  settingsAutostartVerificationError: "The login setting could not be verified.",
  persistenceCloseRegistrationError: "Close protection could not be installed.",
  persistenceCloseTimeout: "Save timed out; closing now.",
  persistenceCloseError: "Save failed; closing now.",
  columnEmpty: "Empty",
  archiveEmpty: "Empty",
  restore: "Restore",
  start: "Start",
  pause: "Pause",
  durationTooShort: "Minimum is 1 minute.",
  timerDone: "Timer at zero",
  showDataFolderError: "Could not open the data folder.",
} as const;

export type MessageKey = keyof typeof EN;

export function t(key: MessageKey): string {
  return EN[key];
}

export function initI18n(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = "en";
}
