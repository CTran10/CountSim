export const DEFAULT_THEME = "dark";
export const THEME_STORAGE_KEY = "trueedge.theme";

export type Theme = "dark" | "light";

const THEME_CHANGE_EVENT = "trueedge-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

export function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.dataset.theme === "light"
    ? "light"
    : DEFAULT_THEME;
}

export function subscribeToTheme(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    document.documentElement.dataset.theme = isTheme(event.newValue)
      ? event.newValue
      : DEFAULT_THEME;
    onStoreChange();
  }

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) {
      document.documentElement.dataset.theme = savedTheme;
    }
  } catch {}

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function updateTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
