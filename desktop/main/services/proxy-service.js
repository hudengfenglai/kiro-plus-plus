import { createServer as defaultCreateServer } from "../../../src/proxy/server.js";
import { buildRuntimeConfigFromAppSettings } from "../../../src/config.js";

export class ProxyService {
  constructor({
    createServer = defaultCreateServer,
    fetch = globalThis.fetch
  } = {}) {
    this.createServer = createServer;
    this.fetch = fetch;
    this.server = null;
    this.runtimeConfig = null;
    this.status = {
      state: "stopped",
      endpoint: null,
      error: null
    };
  }

  getStatus() {
    return { ...this.status };
  }

  async start({ settings, apiKey }) {
    this.status = { ...this.status, state: "starting", error: null };
    try {
      this.runtimeConfig = await buildRuntimeConfigFromAppSettings({ settings, apiKey });
      this.server = await this.createServer(this.runtimeConfig);
      await new Promise((resolve, reject) => {
        this.server.listen(this.runtimeConfig.server.port, this.runtimeConfig.server.host, resolve);
        if (typeof this.server.once === "function") {
          this.server.once("error", reject);
        }
      });
      this.status = {
        state: "running",
        endpoint: `http://${this.runtimeConfig.server.host}:${this.runtimeConfig.server.port}`,
        error: null
      };
      return this.getStatus();
    } catch (error) {
      this.status = {
        state: "error",
        endpoint: null,
        error: error instanceof Error ? error.message : String(error)
      };
      throw error;
    }
  }

  async stop() {
    if (!this.server) {
      this.status = { state: "stopped", endpoint: null, error: null };
      return this.getStatus();
    }
    const server = this.server;
    this.server = null;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    this.status = { state: "stopped", endpoint: null, error: null };
    return this.getStatus();
  }

  async restart({ settings, apiKey }) {
    await this.stop();
    return this.start({ settings, apiKey });
  }

  async getHealth() {
    if (!this.status.endpoint) {
      throw new Error("Proxy is not running");
    }
    const response = await this.fetch(`${this.status.endpoint}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with HTTP ${response.status}`);
    }
    return response.json();
  }
}
