import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

import { parseSettingsJson } from "./jsonc.js";

export function defaultSettingsPath() {
  return join(homedir(), "AppData", "Roaming", "Kiro", "User", "settings.json");
}

export function defaultProfilesDir() {
  return join(homedir(), "AppData", "Roaming", "Kiro", "User", "profiles");
}

export function defaultBackupDir() {
  return join(homedir(), ".kiro", "kiro-plus-plus", "backups");
}

/** Regions Kiro knows about; override all so profile/default routing hits the proxy. */
export const KIRO_CODEWHISPERER_REGIONS = [
  "us-east-1",
  "eu-central-1",
  "us-gov-east-1",
  "us-gov-west-1",
  "us-iso-east-1",
  "us-isob-east-1",
  "us-isof-south-1",
  "us-isof-east-1"
];

async function readJsonFile(path, fallback) {
  try {
    return parseSettingsJson(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function backupSettings(settingsPath, backupDir, now = () => Date.now()) {
  await mkdir(backupDir, { recursive: true });
  await mkdir(dirname(settingsPath), { recursive: true });
  const backupPath = join(backupDir, `settings.${now()}.json`);
  try {
    await copyFile(settingsPath, backupPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(backupPath, "{}\n");
  }
  return backupPath;
}

export async function configureKiroSettings({
  settingsPath = defaultSettingsPath(),
  backupDir = defaultBackupDir(),
  endpoint,
  regions = KIRO_CODEWHISPERER_REGIONS,
  agentModelId,
  now
}) {
  if (!endpoint) throw new Error("Missing endpoint");
  const backupPath = await backupSettings(settingsPath, backupDir, now);
  const settings = await readJsonFile(settingsPath, {});
  applyAgentAndEndpoints(settings, { endpoint, regions, agentModelId });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return { settingsPath, backupPath, agentModelId: agentModelId ?? null };
}

function applyAgentAndEndpoints(settings, { endpoint, regions, agentModelId }) {
  const uniqueRegions = [...new Set(regions)];
  const codewhisperer = settings["codewhisperer.config"] ?? {};
  settings["codewhisperer.config"] = {
    ...codewhisperer,
    endpoints: uniqueRegions.map((region) => ({ region, endpoint }))
  };
  if (agentModelId) {
    settings["kiroAgent.modelSelection"] = agentModelId;
    settings["kiroAgent.agentModelSelection"] = agentModelId;
  }
  return settings;
}

/** Profile-level settings can override User settings and keep model on Auto. */
export async function configureAllKiroProfiles({
  profilesDir = defaultProfilesDir(),
  backupDir = defaultBackupDir(),
  endpoint,
  regions = KIRO_CODEWHISPERER_REGIONS,
  agentModelId,
  now
}) {
  if (!endpoint) throw new Error("Missing endpoint");
  let profileDirs;
  try {
    profileDirs = await readdir(profilesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return { updated: [] };
    throw error;
  }

  const updated = [];
  for (const entry of profileDirs) {
    if (!entry.isDirectory()) continue;
    const settingsPath = join(profilesDir, entry.name, "settings.json");
    let settings;
    try {
      settings = await readJsonFile(settingsPath, {});
    } catch (error) {
      if (error instanceof SyntaxError && agentModelId) {
        const patched = await patchProfileModelSelectionText(settingsPath, agentModelId);
        if (patched) {
          updated.push({ profileId: entry.name, settingsPath, textPatch: true });
          continue;
        }
        updated.push({ profileId: entry.name, settingsPath, skipped: "invalid-json" });
        continue;
      }
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const backupPath = await backupSettings(settingsPath, join(backupDir, "profiles", entry.name), now);
    applyAgentAndEndpoints(settings, {
      endpoint,
      regions,
      agentModelId
    });
    await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    updated.push({ profileId: entry.name, settingsPath, backupPath });
  }
  return { updated };
}

async function patchProfileModelSelectionText(settingsPath, agentModelId) {
  const text = await readFile(settingsPath, "utf8");
  const key = '"kiroAgent.modelSelection"';
  let next;
  if (text.includes(key)) {
    next = text.replace(
      /"kiroAgent\.modelSelection"\s*:\s*"[^"]*"/,
      `"kiroAgent.modelSelection": "${agentModelId}"`
    );
  } else {
    next = text.replace(/\s*\}\s*$/, `,\n  "kiroAgent.modelSelection": "${agentModelId}"\n}`);
  }
  if (next === text) return false;
  await writeFile(settingsPath, next);
  return true;
}

export async function restoreLatestBackup({
  settingsPath = defaultSettingsPath(),
  backupDir = defaultBackupDir()
} = {}) {
  const files = (await readdir(backupDir))
    .filter((file) => /^settings\.\d+\.json$/.test(file))
    .sort();
  if (files.length === 0) throw new Error(`No backups found in ${backupDir}`);
  const latest = join(backupDir, files.at(-1));
  await mkdir(dirname(settingsPath), { recursive: true });
  await copyFile(latest, settingsPath);
  return { settingsPath, backupPath: latest };
}
