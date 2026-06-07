import { access, readdir } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { join } from "node:path";

import {
  configureAllKiroProfiles as defaultConfigureAllKiroProfiles,
  configureKiroSettings as defaultConfigureKiroSettings,
  defaultBackupDir as defaultBackupDirFn,
  defaultProfilesDir as defaultProfilesDirFn,
  defaultSettingsPath as defaultSettingsPathFn,
  restoreLatestBackup as defaultRestoreLatestBackup
} from "../../../src/cli/kiro-settings.js";
import { diagnoseKiroRouting as defaultDiagnoseKiroRouting } from "../../../src/cli/diagnose.js";

const DEFAULT_INSTALL_CANDIDATES = [
  "E:\\Kiro\\Kiro.exe",
  "C:\\Program Files\\Kiro\\Kiro.exe",
  "C:\\Program Files (x86)\\Kiro\\Kiro.exe"
];
const DEFAULT_REGISTRY_KEYS = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Kiro.exe",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Kiro.exe",
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Kiro",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Kiro",
  "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Kiro"
];

function normalizeWindowsPath(target) {
  return target.replace(/\//g, "\\").toLowerCase();
}

function uniqueWindowsPaths(paths) {
  const seen = new Set();
  const output = [];
  for (const target of paths.filter(Boolean)) {
    const key = normalizeWindowsPath(target);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(target);
  }
  return output;
}

function buildInstallCandidates(processEnv = process.env) {
  const localAppData = processEnv.LOCALAPPDATA;
  const userProfile = processEnv.USERPROFILE;
  const programW6432 = processEnv.ProgramW6432;
  const programFiles = processEnv.ProgramFiles;
  const programFilesX86 = processEnv["ProgramFiles(x86)"];

  return uniqueWindowsPaths([
    localAppData ? join(localAppData, "Programs", "Kiro", "Kiro.exe") : null,
    userProfile ? join(userProfile, "AppData", "Local", "Programs", "Kiro", "Kiro.exe") : null,
    ...DEFAULT_INSTALL_CANDIDATES,
    programW6432 ? join(programW6432, "Kiro", "Kiro.exe") : null,
    programFiles ? join(programFiles, "Kiro", "Kiro.exe") : null,
    programFilesX86 ? join(programFilesX86, "Kiro", "Kiro.exe") : null
  ]);
}

function buildDetectionHint({ installPath, searchedInstallPaths }) {
  if (installPath) {
    return `已检测到 Kiro 安装：${installPath}`;
  }
  return `未检测到 Kiro 安装。已检查 ${searchedInstallPaths.length} 个常见路径，请确认 Kiro 已安装或不在非标准目录。`;
}

function sanitizeRegistryValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/,\d+$/, "");
}

function parseRegistryOutput(text) {
  const values = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*(.+?)\s+REG_\w+\s+(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = sanitizeRegistryValue(match[2]);
  }
  return values;
}

function buildRegistryCandidates(record) {
  const candidates = [];
  const defaultValue = record["(Default)"];
  const displayIcon = record.DisplayIcon;
  const installLocation = record.InstallLocation;
  const appPath = record.Path;

  if (defaultValue?.toLowerCase().endsWith(".exe")) {
    candidates.push(defaultValue);
  }
  if (displayIcon?.toLowerCase().endsWith(".exe")) {
    candidates.push(displayIcon);
  }
  if (installLocation) {
    candidates.push(join(installLocation, "Kiro.exe"));
  }
  if (appPath) {
    candidates.push(join(appPath, "Kiro.exe"));
  }

  return uniqueWindowsPaths(candidates);
}

async function defaultPathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function defaultQueryRegistry(key) {
  if (process.platform !== "win32") {
    return null;
  }
  return new Promise((resolve) => {
    execFile("reg.exe", ["query", key], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      resolve(stdout);
    });
  });
}

export class KiroIntegrationService {
  constructor({
    pathExists = defaultPathExists,
    installCandidates,
    registryKeys = DEFAULT_REGISTRY_KEYS,
    queryRegistry = defaultQueryRegistry,
    processEnv = process.env,
    defaultSettingsPath = defaultSettingsPathFn,
    defaultProfilesDir = defaultProfilesDirFn,
    defaultBackupDir = defaultBackupDirFn,
    configureKiroSettings = defaultConfigureKiroSettings,
    configureAllKiroProfiles = defaultConfigureAllKiroProfiles,
    diagnoseKiroRouting = defaultDiagnoseKiroRouting,
    restoreLatestBackup = defaultRestoreLatestBackup,
    launchProcess = async (target) => {
      const child = spawn(target, [], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
      return { launched: true, installPath: target };
    }
  } = {}) {
    this.pathExists = pathExists;
    this.installCandidates = installCandidates ?? buildInstallCandidates(processEnv);
    this.registryKeys = registryKeys;
    this.queryRegistry = queryRegistry;
    this.defaultSettingsPath = defaultSettingsPath;
    this.defaultProfilesDir = defaultProfilesDir;
    this.defaultBackupDir = defaultBackupDir;
    this.configureKiroSettings = configureKiroSettings;
    this.configureAllKiroProfiles = configureAllKiroProfiles;
    this.diagnoseKiroRouting = diagnoseKiroRouting;
    this.restoreLatestBackupImpl = restoreLatestBackup;
    this.launchProcess = launchProcess;
  }

  async findRegistryInstallCandidates() {
    const candidates = [];
    for (const key of this.registryKeys) {
      const output = await this.queryRegistry(key);
      if (!output) continue;
      const values = parseRegistryOutput(output);
      candidates.push(...buildRegistryCandidates(values));
    }
    return uniqueWindowsPaths(candidates);
  }

  async getLatestBackup() {
    const backupDir = this.defaultBackupDir();
    try {
      const files = (await readdir(backupDir))
        .filter((file) => /^settings\.\d+\.json$/.test(file))
        .sort();
      const latest = files.at(-1);
      if (!latest) return null;
      const timestamp = Number.parseInt(latest.replace(/\D/g, ""), 10);
      return {
        backupPath: join(backupDir, latest),
        at: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
      };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async detectKiro() {
    const searchedInstallPaths = [...this.installCandidates];
    let installPath = null;
    for (const candidate of searchedInstallPaths) {
      if (await this.pathExists(candidate)) {
        installPath = candidate;
        break;
      }
    }
    if (!installPath) {
      const registryCandidates = await this.findRegistryInstallCandidates();
      for (const candidate of registryCandidates) {
        if (!searchedInstallPaths.includes(candidate)) {
          searchedInstallPaths.push(candidate);
        }
        if (!installPath && await this.pathExists(candidate)) {
          installPath = candidate;
        }
      }
    }
    return {
      installed: Boolean(installPath),
      installPath,
      searchedInstallPaths,
      detectionHint: buildDetectionHint({ installPath, searchedInstallPaths }),
      settingsPath: this.defaultSettingsPath(),
      profilesDir: this.defaultProfilesDir(),
      backupDir: this.defaultBackupDir(),
      lastBackup: await this.getLatestBackup()
    };
  }

  async applyRouting({ endpoint, agentModelId }) {
    const settingsPath = this.defaultSettingsPath();
    const profilesDir = this.defaultProfilesDir();
    const backupDir = this.defaultBackupDir();
    const settingsResult = await this.configureKiroSettings({ settingsPath, backupDir, endpoint, agentModelId });
    const profilesResult = await this.configureAllKiroProfiles({ profilesDir, backupDir, endpoint, agentModelId });
    return {
      ...settingsResult,
      profilesUpdated: profilesResult.updated ?? []
    };
  }

  async diagnose() {
    return this.diagnoseKiroRouting(this.defaultSettingsPath(), {
      profilesDir: this.defaultProfilesDir()
    });
  }

  async restoreLatestBackup() {
    return this.restoreLatestBackupImpl({
      settingsPath: this.defaultSettingsPath(),
      backupDir: this.defaultBackupDir()
    });
  }

  async launchKiro(installPath) {
    if (!installPath) {
      throw new Error("Kiro is not installed or install path is unavailable");
    }
    return this.launchProcess(installPath);
  }
}
