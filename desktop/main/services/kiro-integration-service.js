import { access, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
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

async function defaultPathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export class KiroIntegrationService {
  constructor({
    pathExists = defaultPathExists,
    installCandidates = DEFAULT_INSTALL_CANDIDATES,
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
    this.installCandidates = installCandidates;
    this.defaultSettingsPath = defaultSettingsPath;
    this.defaultProfilesDir = defaultProfilesDir;
    this.defaultBackupDir = defaultBackupDir;
    this.configureKiroSettings = configureKiroSettings;
    this.configureAllKiroProfiles = configureAllKiroProfiles;
    this.diagnoseKiroRouting = diagnoseKiroRouting;
    this.restoreLatestBackupImpl = restoreLatestBackup;
    this.launchProcess = launchProcess;
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
    let installPath = null;
    for (const candidate of this.installCandidates) {
      if (await this.pathExists(candidate)) {
        installPath = candidate;
        break;
      }
    }
    return {
      installed: Boolean(installPath),
      installPath,
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
