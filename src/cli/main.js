#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createServer } from "../proxy/server.js";
import { diagnoseKiroRouting } from "./diagnose.js";
import {
  configureAllKiroProfiles,
  configureKiroSettings,
  defaultSettingsPath,
  restoreLatestBackup
} from "./kiro-settings.js";

function helpText() {
  return `kiro++ BYOK helper

Commands:
  start                 Start the local proxy
  configure             Backup Kiro settings and route all regions to this proxy
  restore               Restore the latest settings backup
  health-config         Print endpoint and settings path
  diagnose              Check whether Kiro settings can reach the local proxy

Environment:
  KIRO_PLUS_OPENAI_API_KEY   API key for OpenAI-compatible providers
  KIRO_PLUS_OPENAI_BASE_URL  Defaults to https://api.openai.com/v1
  KIRO_PLUS_MODEL            Defaults to gpt-4.1-mini
  KIRO_PLUS_PORT             Defaults to 43119
`;
}

export async function runCli(args = process.argv.slice(2), deps = {}) {
  const command = args[0] ?? "help";
  const load = deps.loadConfig ?? loadConfig;
  const makeServer = deps.createServer ?? createServer;
  const configureSettings = deps.configureKiroSettings ?? configureKiroSettings;
  const configureProfiles = deps.configureAllKiroProfiles ?? configureAllKiroProfiles;
  const diagnose = deps.diagnoseKiroRouting ?? diagnoseKiroRouting;
  const restoreBackup = deps.restoreLatestBackup ?? restoreLatestBackup;
  const log = deps.log ?? console.log;

  if (command === "start") {
    const config = await load();
    const server = await makeServer(config);
    server.listen(config.server.port, config.server.host, () => {
      log(`kiro++ proxy listening on http://${config.server.host}:${config.server.port}`);
    });
    return 0;
  }

  if (command === "configure") {
    const config = await load();
    const endpoint = `http://${config.server.host}:${config.server.port}`;
    const modelId = config.models?.[0]?.id ?? "deepseek-v4-pro";
    const result = await configureSettings({ endpoint, agentModelId: modelId });
    const profiles = await configureProfiles({ endpoint, agentModelId: modelId });
    log(`Configured Kiro endpoint: ${endpoint}`);
    log(`Agent model selection: ${modelId} (do NOT use Auto for BYOK)`);
    log(`Settings: ${result.settingsPath}`);
    log(`Backup: ${result.backupPath}`);
    if (profiles.updated.length > 0) {
      const ok = profiles.updated.filter((p) => !p.skipped).length;
      const skipped = profiles.updated.filter((p) => p.skipped);
      log(`Updated ${ok} profile(s).`);
      for (const s of skipped) {
        log(`Skipped profile ${s.profileId}: ${s.skipped} — fix ${s.settingsPath} manually.`);
      }
    }
    log("Restart Kiro completely after configure.");
    return 0;
  }

  if (command === "diagnose") {
    const report = await diagnose();
    log(JSON.stringify(report, null, 2));
    return 0;
  }

  if (command === "restore") {
    const result = await restoreBackup();
    log(`Restored settings from: ${result.backupPath}`);
    log(`Settings: ${result.settingsPath}`);
    return 0;
  }

  if (command === "health-config") {
    const config = await load();
    log(JSON.stringify({
      endpoint: `http://${config.server.host}:${config.server.port}`,
      settingsPath: defaultSettingsPath(),
      models: config.models
    }, null, 2));
    return 0;
  }

  log(helpText());
  return 0;
}

export function isMainModule(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return fileURLToPath(moduleUrl).toLowerCase() === argvPath.toLowerCase();
}

if (isMainModule(import.meta.url, process.argv[1])) {
  await runCli();
}
