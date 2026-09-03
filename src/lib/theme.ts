export type Theme = "light" | "dark";

const KEY = "sadguru.theme";

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    void window.api?.window.titleBarTheme(theme);
  } catch {
    /* not in Electron */
  }
}

/** Runs before React mounts so there is no flash of the wrong theme. */
export function applyStoredTheme(): void {
  applyTheme(getStoredTheme());
}
