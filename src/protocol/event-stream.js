import { randomUUID } from "node:crypto";
import { EventStreamCodec } from "@smithy/eventstream-codec";

// Smithy names these from the binary codec perspective:
// fromUtf8 = string -> bytes, toUtf8 = bytes -> string
const fromUtf8 = (input) => new TextEncoder().encode(input);
const toUtf8 = (input) => new TextDecoder().decode(input);
const codec = new EventStreamCodec(toUtf8, fromUtf8);

function encodeFrame(headers, body) {
  const payload = body instanceof Uint8Array ? body : new TextEncoder().encode(body);
  return codec.encode({ headers, body: payload });
}

export function encodeInitialResponse(fields) {
  return encodeFrame(
    {
      ":message-type": { type: "string", value: "event" },
      ":event-type": { type: "string", value: "initial-response" },
      ":content-type": { type: "string", value: "application/x-amz-json-1.0" }
    },
    JSON.stringify(fields)
  );
}

export function encodeUnionEvent(eventType, payload, contentType = "application/json") {
  return encodeFrame(
    {
      ":message-type": { type: "string", value: "event" },
      ":event-type": { type: "string", value: eventType },
      ":content-type": { type: "string", value: contentType }
    },
    JSON.stringify(payload)
  );
}

export function encodeMessageMetadataEvent(conversationId, userInputToken) {
  const payload = { conversationId };
  if (userInputToken !== undefined) {
    payload.userInputToken = userInputToken;
  }
  return encodeUnionEvent("messageMetadataEvent", payload);
}

export function encodeInternalServerException(message, reason = "provider_error") {
  return encodeUnionEvent("InternalServerException", {
    message,
    reason
  });
}

export function encodeAssistantResponseChunks(text, modelId, conversationId = randomUUID()) {
  const chunks = [];
  chunks.push(encodeMessageMetadataEvent(conversationId));

  const parts = splitForStreaming(text);
  for (const content of parts) {
    chunks.push(encodeUnionEvent("assistantResponseEvent", { content, modelId }));
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function splitForStreaming(text) {
  if (!text) return [""];
  const size = 24;
  const parts = [];
  for (let index = 0; index < text.length; index += size) {
    parts.push(text.slice(index, index + size));
  }
  return parts;
}
