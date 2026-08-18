export type Locale = "fi" | "en";

const STRINGS = {
  en: {
    board: "Board",
    clock: "Clock",
    settings: "Settings",
    settingsClose: "Close",
    launchAtLogin: "Launch Desk at login",
    settingsAutostartUnavailable: "Available in the Desk app only.",
    settingsAutostartReadError: "Could not read the login setting.",
    settingsAutostartChangeError: "Could not change the login setting.",
    settingsAutostartVerificationError: "The login setting could not be verified.",
    persistenceSaving: "Saving…",
    persistenceRecovered: "Recovered from backup.",
    persistenceError: "Desk data could not be saved. Data path:",
    pin: "Pin",
    minimize: "Minimize",
    close: "Close",
    capture: "Capture",
    archiveDone: "Archive Done",
    archive: "Archive",
    archiveClose: "Close",
    archiveEmpty: "Empty",
    columnEmpty: "Empty",
    editCard: "Edit",
    toggleClock: "Start or pause the clock",
    hours: "Hours",
    minutes: "Minutes",
    setDuration: "Set",
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    timerDone: "Timer at zero",
  },
  fi: {
    board: "Taulu",
    clock: "Kello",
    settings: "Asetukset",
    settingsClose: "Sulje",
    launchAtLogin: "Käynnistä Desk kirjautumisen yhteydessä",
    settingsAutostartUnavailable: "Saatavilla vain Desk-sovelluksessa.",
    settingsAutostartReadError: "Kirjautumisasetusta ei voitu lukea.",
    settingsAutostartChangeError: "Kirjautumisasetusta ei voitu muuttaa.",
    settingsAutostartVerificationError: "Kirjautumisasetusta ei voitu varmistaa.",
    persistenceSaving: "Tallennetaan…",
    persistenceRecovered: "Palautettu varmuuskopiosta.",
    persistenceError: "Desk-tietoja ei voitu tallentaa. Tietopolku:",
    pin: "Nuppineula",
    minimize: "Pienennä",
    close: "Sulje",
    capture: "Capture",
    archiveDone: "Arkistoi Done",
    archive: "Arkisto",
    archiveClose: "Sulje",
    archiveEmpty: "Tyhjä",
    columnEmpty: "Empty",
    editCard: "Muokkaa",
    toggleClock: "Käynnistä tai tauota kello",
    hours: "Tunnit",
    minutes: "Minuutit",
    setDuration: "Aseta",
    start: "Aloita",
    pause: "Tauko",
    reset: "Nollaa",
    timerDone: "Kello nollassa",
  },
} as const;

export type MessageKey = keyof typeof STRINGS.en;

let locale: Locale = "en";

export function detectLocale(lang = ""): Locale {
  return lang.toLowerCase().startsWith("fi") ? "fi" : "en";
}

export function currentLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
}

export function t(key: MessageKey): string {
  return STRINGS[locale][key];
}

export function initI18n(lang = typeof navigator === "undefined" ? "" : navigator.language): Locale {
  locale = detectLocale(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    applyStaticI18n();
  }
  return locale;
}

export function applyStaticI18n(): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (key) el.textContent = t(key);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]")) {
    const key = el.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key && "placeholder" in el) {
      (el as HTMLInputElement).placeholder = t(key);
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    const key = el.dataset.i18nAria as MessageKey | undefined;
    if (key) el.setAttribute("aria-label", t(key));
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
    const key = el.dataset.i18nTitle as MessageKey | undefined;
    if (key) {
      const value = t(key);
      el.setAttribute("title", value);
      if (!el.getAttribute("aria-label") && !el.dataset.i18nAria) {
        el.setAttribute("aria-label", value);
      }
    }
  }
}
