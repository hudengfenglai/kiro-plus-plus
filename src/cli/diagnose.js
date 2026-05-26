import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { KIRO_CODEWHISPERER_REGIONS } from "./kiro-settings.js";
import { defaultProfilesDir, defaultSettingsPath } from "./kiro-settings.js";
import { parseSettingsJson } from "./jsonc.js";
import { canonicalOperation } from "../protocol/request-meta.js";
import { sanitizeHeaders } from "../proxy/server.js";

const OFFICIAL_DEFAULT = "https://q.us-east-1.amazonaws.com";

function sanitizeLogEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const sanitized = {
    ...entry,
    operation: canonicalOperation(entry.operation)
  };
  if (entry.headers && typeof entry.headers === "object") {
    sanitized.headers = sanitizeHeaders(entry.headers);
  }
  return sanitized;
}

function unresolvedUnsupportedOperations(entries) {
  const latestByOperation = new Map();
  for (const entry of entries) {
    if (!entry.operation) continue;
    latestByOperation.set(canonicalOperation(entry.operation), entry);
  }
  return [...latestByOperation.entries()]
    .filter(([, entry]) => entry.status === 501 || entry.error === "Unsupported Kiro operation")
    .map(([operation]) => operation);
}

async function readJsonFile(path, fallback = {}) {
  try {
    return parseSettingsJson(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function inspectProfiles(profilesDir) {
  let entries;
  try {
    entries = await readdir(profilesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return { checked: 0, autoModeBlocksByok: false, profiles: [] };
    }
    throw error;
  }

  const profiles = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const settingsPath = join(profilesDir, entry.name, "settings.json");
    try {
      const settings = await readJsonFile(settingsPath, {});
      const autoModeBlocksByok =
        settings["kiroAgent.modelSelection"] === "auto" ||
        settings["kiroAgent.agentModelSelection"] === "auto";
      profiles.push({
        profileId: entry.name,
        settingsPath,
        autoModeBlocksByok,
        kiroAgentModelSelection: settings["kiroAgent.modelSelection"] ?? null,
        kiroAgentAgentModelSelection: settings["kiroAgent.agentModelSelection"] ?? null
      });
    } catch (error) {
      profiles.push({
        profileId: entry.name,
        settingsPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    checked: profiles.length,
    autoModeBlocksByok: profiles.some((profile) => profile.autoModeBlocksByok),
    profiles
  };
}

async function readRecentProxyRequests(logPath, maxEntries = 20) {
  try {
    const text = await readFile(logPath, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-maxEntries)
      .map((line) => {
        try {
          return sanitizeLogEntry(JSON.parse(line));
        } catch {
          return { parseError: true, line };
        }
      });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function diagnoseKiroRouting(settingsPath = defaultSettingsPath(), options = {}) {
  const profilesDir = options.profilesDir ?? defaultProfilesDir();
  const logPath = options.logPath ?? ".kiro-plus-plus/requests.jsonl";
  const settings = await readJsonFile(settingsPath, {});
  const profileReport = await inspectProfiles(profilesDir);
  const recentProxyRequests = await readRecentProxyRequests(logPath);
  const unsupportedOperationsSeen = unresolvedUnsupportedOperations(recentProxyRequests);

  const endpoints = settings["codewhisperer.config"]?.endpoints ?? [];
  const byRegion = Object.fromEntries(endpoints.map((item) => [item.region, item.endpoint]));
  const localRegions = endpoints.filter((item) => String(item.endpoint).includes("127.0.0.1"));
  const missingRegions = KIRO_CODEWHISPERER_REGIONS.filter((region) => !byRegion[region]);
  const autoModeBlocksByok =
    settings["kiroAgent.modelSelection"] === "auto" ||
    settings["kiroAgent.agentModelSelection"] === "auto";

  return {
    settingsPath,
    endpointCount: endpoints.length,
    localRegions: localRegions.map((item) => item.region),
    missingRegions,
    onlyUsEast1: endpoints.length === 1 && endpoints[0]?.region === "us-east-1",
    officialDefaultStillUsed: missingRegions.length > 0,
    kiroAgentModelSelection: settings["kiroAgent.modelSelection"] ?? null,
    kiroAgentAgentModelSelection: settings["kiroAgent.agentModelSelection"] ?? null,
    autoModeBlocksByok,
    profileSettingsChecked: profileReport.checked,
    profileAutoModeBlocksByok: profileReport.autoModeBlocksByok,
    profiles: profileReport.profiles,
    recentProxyRequests,
    unsupportedOperationsSeen,
    redactionEnabled: true,
    hint: endpoints.length === 0
      ? "Run: node src/cli/main.js configure"
      : localRegions.length === 0
        ? `No localhost endpoint in settings. Kiro may still use ${OFFICIAL_DEFAULT}`
        : missingRegions.length > 0
          ? `Only ${localRegions.length} region(s) point to proxy. Kiro fallback default may still use ${OFFICIAL_DEFAULT}. Re-run configure.`
          : autoModeBlocksByok
            ? "Model is Auto; Kiro uses official cloud routing and will NOT hit the local proxy. Pick your BYOK model, then run configure again."
            : profileReport.autoModeBlocksByok
              ? "A Kiro profile still uses Auto model selection. Re-run configure or fix that profile before testing BYOK."
              : "Settings look correct. Start proxy BEFORE Kiro, restart Kiro fully, then chat and check requests.jsonl for POST + GenerateAssistantResponse."
  };
}
