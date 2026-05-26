import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const electronCommand = isWindows ? ".\\node_modules\\.bin\\electron.cmd" : "./node_modules/.bin/electron";

async function waitForRenderer(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await delay(1000);
  }
  throw new Error(`Renderer did not become ready at ${url}`);
}

const rendererUrl = "http://127.0.0.1:5173";

const renderer = spawn(npmCommand, ["run", "desktop:renderer"], {
  stdio: "inherit",
  shell: false
});

let closing = false;

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  if (!renderer.killed) {
    renderer.kill();
  }
  process.exit(code);
}

renderer.on("exit", (code) => {
  if (!closing && code !== 0) {
    process.exit(code ?? 1);
  }
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  await waitForRenderer(rendererUrl);
  const electron = spawn(electronCommand, ["."], {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl
    },
    shell: false
  });
  electron.on("exit", (code) => shutdown(code ?? 0));
} catch (error) {
  console.error("[kiro++] desktop:dev failed:", error instanceof Error ? error.message : String(error));
  shutdown(1);
}
