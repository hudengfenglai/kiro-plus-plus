import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { normalizeAppSettings } from "../../../src/config.js";

export class SettingsStore {
  constructor({ configPath } = {}) {
    this.configPath = configPath;
  }

  async load() {
    try {
      const text = await readFile(this.configPath, "utf8");
      return normalizeAppSettings(JSON.parse(text));
    } catch (error) {
      if (error.code === "ENOENT") {
        return normalizeAppSettings();
      }
      throw error;
    }
  }

  async save(settings) {
    const normalized = normalizeAppSettings(settings);
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }
}
