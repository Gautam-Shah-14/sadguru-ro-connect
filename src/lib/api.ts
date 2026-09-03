import type { DesktopApi } from "../../shared/api";

declare global {
  interface Window {
    api?: DesktopApi;
  }
}

/** Access the Electron-exposed backend. Throws if the app is opened outside Electron. */
export function getApi(): DesktopApi {
  if (typeof window === "undefined" || !window.api) {
    throw new Error(
      "Desktop backend is not available. Run the app with `npm run dev` (Electron), not a plain browser.",
    );
  }
  return window.api;
}

export const api: DesktopApi = new Proxy({} as DesktopApi, {
  get(_t, prop: string) {
    return getApi()[prop as keyof DesktopApi];
  },
});
