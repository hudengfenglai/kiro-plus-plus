import http from "node:http";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../config.js";
import { createProvider } from "../providers/index.js";
import { handleKiroRequest } from "./handler.js";
import { getHeader, parseRequestMeta } from "../protocol/request-meta.js";

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const REDACTED_HEADER_PATTERN = /authorization|cookie|set-cookie|token|api-key|x-api-key|x-amz-security-token|x-amz-credential/i;

export function sanitizeHeaders(headers) {
  const copy = { ...headers };
  for (const key of Object.keys(copy)) {
    if (REDACTED_HEADER_PATTERN.test(key)) {
      copy[key] = "[redacted]";
    }
  }
  return copy;
}

async function appendJsonLog(path, entry) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`);
}

export async function createServer(config) {
  config = config ?? await loadConfig();
  const providerConfig = config.providers[config.defaultProvider];
  const provider = createProvider(providerConfig);
  const logPath = join(".kiro-plus-plus", "requests.jsonl");

  return http.createServer(async (request, response) => {
    const started = Date.now();
    try {
      const body = await readBody(request);
      const meta = parseRequestMeta({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body
      });
      const logEntry = {
        at: new Date().toISOString(),
        method: request.method,
        url: request.url,
        target: getHeader(request.headers, "x-amz-target") ?? getHeader(request.headers, "x-amzn-target"),
        operation: meta.operation,
        contentType: getHeader(request.headers, "content-type"),
        bodyBytes: body.length,
        redactionApplied: Boolean(config.logging.logHeaders)
      };

      if (config.logging.logHeaders) {
        logEntry.headers = sanitizeHeaders(request.headers);
      }
      if (config.logging.requestBodies) {
        logEntry.body = body;
      }

      const result = await handleKiroRequest({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body
      }, {
        provider,
        config
      });

      logEntry.status = result.status;
      logEntry.durationMs = Date.now() - started;
      logEntry.requestId = result.headers?.["x-amzn-requestid"] ?? result.headers?.["x-amz-request-id"] ?? null;
      await appendJsonLog(logPath, logEntry);

      response.writeHead(result.status, result.headers);
      if (result.stream) {
        response.end(result.body);
      } else {
        response.end(result.body);
      }
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

export function isMainModule(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return fileURLToPath(moduleUrl).toLowerCase() === argvPath.toLowerCase();
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const config = await loadConfig();
  const server = await createServer(config);
  server.listen(config.server.port, config.server.host, () => {
    console.log(`kiro++ proxy listening on http://${config.server.host}:${config.server.port}`);
  });
}
