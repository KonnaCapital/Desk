export type Locale = "en" | "de" | "es" | "fr" | "ru" | "zh" | "fi";

const EN = {
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
  persistenceCloseRegistrationError: "Close protection could not be installed.",
  persistenceCloseTimeout: "Save timed out; closing now.",
  persistenceCloseError: "Save failed; closing now.",
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
} as const;

export type MessageKey = keyof typeof EN;

const STRINGS: Record<Locale, Record<MessageKey, string>> = {
  en: EN,
  de: {
    board: "Board",
    clock: "Uhr",
    settings: "Einstellungen",
    settingsClose: "Schließen",
    launchAtLogin: "Desk bei der Anmeldung starten",
    settingsAutostartUnavailable: "Nur in der Desk-App verfügbar.",
    settingsAutostartReadError: "Die Anmelde-Einstellung konnte nicht gelesen werden.",
    settingsAutostartChangeError: "Die Anmelde-Einstellung konnte nicht geändert werden.",
    settingsAutostartVerificationError: "Die Anmelde-Einstellung konnte nicht bestätigt werden.",
    persistenceSaving: "Speichern…",
    persistenceRecovered: "Aus der Sicherung wiederhergestellt.",
    persistenceError: "Desk-Daten konnten nicht gespeichert werden. Pfad:",
    persistenceCloseRegistrationError: "Der Schutz beim Schließen konnte nicht eingerichtet werden.",
    persistenceCloseTimeout: "Speichern abgelaufen; wird jetzt geschlossen.",
    persistenceCloseError: "Speichern fehlgeschlagen; wird jetzt geschlossen.",
    pin: "Anheften",
    minimize: "Minimieren",
    close: "Schließen",
    capture: "Erfassen",
    archiveDone: "Erledigte archivieren",
    archive: "Archiv",
    archiveClose: "Schließen",
    archiveEmpty: "Leer",
    columnEmpty: "Leer",
    editCard: "Bearbeiten",
    toggleClock: "Uhr starten oder pausieren",
    hours: "Stunden",
    minutes: "Minuten",
    setDuration: "Setzen",
    start: "Start",
    pause: "Pause",
    reset: "Zurücksetzen",
    timerDone: "Timer bei null",
  },
  es: {
    board: "Tablero",
    clock: "Reloj",
    settings: "Ajustes",
    settingsClose: "Cerrar",
    launchAtLogin: "Abrir Desk al iniciar sesión",
    settingsAutostartUnavailable: "Solo en la app Desk.",
    settingsAutostartReadError: "No se pudo leer el ajuste de inicio.",
    settingsAutostartChangeError: "No se pudo cambiar el ajuste de inicio.",
    settingsAutostartVerificationError: "No se pudo comprobar el ajuste de inicio.",
    persistenceSaving: "Guardando…",
    persistenceRecovered: "Recuperado de la copia de seguridad.",
    persistenceError: "No se pudieron guardar los datos de Desk. Ruta:",
    persistenceCloseRegistrationError: "No se pudo activar la protección al cerrar.",
    persistenceCloseTimeout: "El guardado expiró; cerrando ahora.",
    persistenceCloseError: "El guardado falló; cerrando ahora.",
    pin: "Fijar",
    minimize: "Minimizar",
    close: "Cerrar",
    capture: "Capturar",
    archiveDone: "Archivar Done",
    archive: "Archivo",
    archiveClose: "Cerrar",
    archiveEmpty: "Vacío",
    columnEmpty: "Vacío",
    editCard: "Editar",
    toggleClock: "Iniciar o pausar el reloj",
    hours: "Horas",
    minutes: "Minutos",
    setDuration: "Aplicar",
    start: "Iniciar",
    pause: "Pausa",
    reset: "Reiniciar",
    timerDone: "Temporizador en cero",
  },
  fr: {
    board: "Tableau",
    clock: "Horloge",
    settings: "Réglages",
    settingsClose: "Fermer",
    launchAtLogin: "Lancer Desk à la connexion",
    settingsAutostartUnavailable: "Disponible uniquement dans l’app Desk.",
    settingsAutostartReadError: "Impossible de lire le réglage de connexion.",
    settingsAutostartChangeError: "Impossible de modifier le réglage de connexion.",
    settingsAutostartVerificationError: "Impossible de vérifier le réglage de connexion.",
    persistenceSaving: "Enregistrement…",
    persistenceRecovered: "Récupéré depuis la sauvegarde.",
    persistenceError: "Impossible d’enregistrer les données Desk. Chemin :",
    persistenceCloseRegistrationError: "La protection à la fermeture n’a pas pu être installée.",
    persistenceCloseTimeout: "Enregistrement expiré ; fermeture.",
    persistenceCloseError: "Échec de l’enregistrement ; fermeture.",
    pin: "Épingler",
    minimize: "Réduire",
    close: "Fermer",
    capture: "Capturer",
    archiveDone: "Archiver Done",
    archive: "Archive",
    archiveClose: "Fermer",
    archiveEmpty: "Vide",
    columnEmpty: "Vide",
    editCard: "Modifier",
    toggleClock: "Démarrer ou mettre l’horloge en pause",
    hours: "Heures",
    minutes: "Minutes",
    setDuration: "OK",
    start: "Démarrer",
    pause: "Pause",
    reset: "Réinitialiser",
    timerDone: "Minuteur à zéro",
  },
  ru: {
    board: "Доска",
    clock: "Таймер",
    settings: "Настройки",
    settingsClose: "Закрыть",
    launchAtLogin: "Запускать Desk при входе",
    settingsAutostartUnavailable: "Только в приложении Desk.",
    settingsAutostartReadError: "Не удалось прочитать настройку входа.",
    settingsAutostartChangeError: "Не удалось изменить настройку входа.",
    settingsAutostartVerificationError: "Не удалось проверить настройку входа.",
    persistenceSaving: "Сохранение…",
    persistenceRecovered: "Восстановлено из резервной копии.",
    persistenceError: "Не удалось сохранить данные Desk. Путь:",
    persistenceCloseRegistrationError: "Не удалось включить защиту при закрытии.",
    persistenceCloseTimeout: "Сохранение превысило время; закрытие.",
    persistenceCloseError: "Сохранение не удалось; закрытие.",
    pin: "Закрепить",
    minimize: "Свернуть",
    close: "Закрыть",
    capture: "Записать",
    archiveDone: "Архивировать Done",
    archive: "Архив",
    archiveClose: "Закрыть",
    archiveEmpty: "Пусто",
    columnEmpty: "Пусто",
    editCard: "Изменить",
    toggleClock: "Запустить или приостановить таймер",
    hours: "Часы",
    minutes: "Минуты",
    setDuration: "ОК",
    start: "Старт",
    pause: "Пауза",
    reset: "Сброс",
    timerDone: "Таймер на нуле",
  },
  zh: {
    board: "看板",
    clock: "计时",
    settings: "设置",
    settingsClose: "关闭",
    launchAtLogin: "登录时启动 Desk",
    settingsAutostartUnavailable: "仅在 Desk 应用中可用。",
    settingsAutostartReadError: "无法读取登录设置。",
    settingsAutostartChangeError: "无法更改登录设置。",
    settingsAutostartVerificationError: "无法确认登录设置。",
    persistenceSaving: "正在保存…",
    persistenceRecovered: "已从备份恢复。",
    persistenceError: "无法保存 Desk 数据。路径：",
    persistenceCloseRegistrationError: "无法启用关闭保护。",
    persistenceCloseTimeout: "保存超时，即将关闭。",
    persistenceCloseError: "保存失败，即将关闭。",
    pin: "置顶",
    minimize: "最小化",
    close: "关闭",
    capture: "记下",
    archiveDone: "归档 Done",
    archive: "归档",
    archiveClose: "关闭",
    archiveEmpty: "空",
    columnEmpty: "空",
    editCard: "编辑",
    toggleClock: "开始或暂停计时",
    hours: "小时",
    minutes: "分钟",
    setDuration: "确定",
    start: "开始",
    pause: "暂停",
    reset: "复位",
    timerDone: "计时结束",
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
    persistenceCloseRegistrationError: "Sulkujen suojausta ei voitu asentaa.",
    persistenceCloseTimeout: "Tallennus aikakatkaistiin; suljetaan nyt.",
    persistenceCloseError: "Tallennus epäonnistui; suljetaan nyt.",
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
};

const LOCALES: Locale[] = ["en", "de", "es", "fr", "ru", "zh", "fi"];

let locale: Locale = "en";

export function detectLocale(lang = ""): Locale {
  const tag = lang.trim().toLowerCase().replaceAll("_", "-");
  if (!tag) return "en";
  const primary = tag.split("-")[0] ?? "";
  if (primary === "zh") return "zh";
  return LOCALES.includes(primary as Locale) ? (primary as Locale) : "en";
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

export function initI18n(
  lang = typeof navigator === "undefined" ? "" : navigator.language,
): Locale {
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
