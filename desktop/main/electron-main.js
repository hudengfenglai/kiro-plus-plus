import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerIpcHandlers } from "./ipc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#111827",
    title: "Kiro++",
    webPreferences: {
      preload: join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload bridge uses Node/Electron APIs directly.
      // Electron's default sandboxed preload environment can leave the bridge unavailable.
      sandbox: false
    }
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    window.loadURL(devUrl);
  } else {
    window.loadFile(join(__dirname, "../renderer/dist/index.html"));
  }
}

async function maybeLaunchKiro(runtime) {
  if (!process.argv.includes("--launch-kiro")) return;
  try {
    await runtime.launchKiroWithProxy();
  } catch (error) {
    console.error("[kiro++] launch-kiro failed:", error instanceof Error ? error.message : String(error));
  }
}

app.whenReady().then(() => {
  const runtime = registerIpcHandlers();
  runtime.bootstrap().catch((error) => {
    console.error("[kiro++] bootstrap failed:", error instanceof Error ? error.message : String(error));
  });
  createWindow();
  maybeLaunchKiro(runtime);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
