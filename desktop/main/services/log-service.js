import { readFile } from "node:fs/promises";

import { canonicalOperation } from "../../../src/protocol/request-meta.js";
import { sanitizeHeaders } from "../../../src/proxy/server.js";

function normalizeEntry(entry) {
  return {
    ...entry,
    operation: canonicalOperation(entry.operation),
    headers: entry.headers ? sanitizeHeaders(entry.headers) : undefined
  };
}

export class LogService {
  constructor({ logPath = ".kiro-plus-plus/requests.jsonl" } = {}) {
    this.logPath = logPath;
  }

  async readEntries() {
    try {
      const text = await readFile(this.logPath, "utf8");
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => normalizeEntry(JSON.parse(line)));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async listRequests(filters = {}) {
    const entries = await this.readEntries();
    return entries.filter((entry) => {
      if (filters.operation && entry.operation !== filters.operation) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (filters.errorOnly && !(entry.status >= 400)) return false;
      return true;
    });
  }

  async tailRequests(limit = 20) {
    const entries = await this.readEntries();
    return entries.slice(-limit);
  }
}
