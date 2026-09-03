import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { getDb, closeDb } from "./db";
import { registerIpc } from "./ipc";
import { startScheduler, stopScheduler } from "./services/scheduler";
import { runSelfTest, runUiSmoke } from "./self-test";
import { makeIcon } from "./make-icon";
import { makeGuide } from "./make-guide";
import { makeSample } from "./make-sample";

const isDev = !!process.env["ELECTRON_RENDERER_URL"];
const selfTest = process.argv.includes("--self-test");
const uiSmoke = process.argv.includes("--smoke-ui");
const makeIconMode = process.argv.includes("--make-icon");
const makeGuideMode = process.argv.includes("--make-guide");
const makeSampleMode = process.argv.includes("--make-sample");

import { TITLEBAR, TITLEBAR_HEIGHT } from "./titlebar";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f3f6f7",
    title: "Sadguru RO Connect",
    titleBarStyle: "hidden",
    titleBarOverlay: { ...TITLEBAR.light, height: TITLEBAR_HEIGHT },
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] as string);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.sadguru.roconnect");

  if (makeIconMode) {
    await makeIcon(process.cwd());
    app.exit(0);
    return;
  }

  if (makeGuideMode) {
    await makeGuide(process.cwd());
    app.exit(0);
    return;
  }

  if (makeSampleMode) {
    makeSample(process.cwd());
    app.exit(0);
    return;
  }

  // Open the database (runs migrations + seeds) before any IPC call can arrive.
  getDb();
  registerIpc();

  if (selfTest) {
    const ok = await runSelfTest();
    app.exit(ok ? 0 : 1);
    return;
  }

  if (uiSmoke) {
    const ok = await runUiSmoke(join(__dirname, "../renderer/index.html"));
    app.exit(ok ? 0 : 1);
    return;
  }

  createWindow();
  startScheduler();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopScheduler();
  closeDb();
});
