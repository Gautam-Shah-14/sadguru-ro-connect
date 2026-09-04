import { BrowserWindow } from "electron";

export const TITLEBAR = {
  light: { color: "#f3f6f7", symbolColor: "#243b44" },
  dark: { color: "#1b232b", symbolColor: "#e8f0ef" },
} as const;

export const TITLEBAR_HEIGHT = 40;

/** Recolour the native window-controls overlay to match the renderer theme. */
export function applyTitleBarTheme(theme: "light" | "dark"): void {
  const t = TITLEBAR[theme === "dark" ? "dark" : "light"];
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      w.setTitleBarOverlay({ ...t, height: TITLEBAR_HEIGHT });
    } catch {
      /* platform / window without an overlay */
    }
  }
}
