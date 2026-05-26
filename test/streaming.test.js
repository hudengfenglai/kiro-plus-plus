import test from "node:test";
import assert from "node:assert/strict";

import { EventStreamCodec } from "@smithy/eventstream-codec";

import { handleKiroRequest } from "../src/proxy/handler.js";
import {
  encodeAssistantResponseChunks,
  encodeInternalServerException,
  encodeMessageMetadataEvent
} from "../src/protocol/event-stream.js";

const fromUtf8 = (input) => new TextEncoder().encode(input);
const toUtf8 = (input) => new TextDecoder().decode(input);
const codec = new EventStreamCodec(toUtf8, fromUtf8);

function decodeFirstMessage(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const totalLength = view.getUint32(0, false);
  return codec.decode(buffer.subarray(0, totalLength));
}

function decodeMessages(buffer) {
  const messages = [];
  let offset = 0;
  while (offset < buffer.length) {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset, buffer.byteLength - offset);
    const totalLength = view.getUint32(0, false);
    const message = codec.decode(buffer.subarray(offset, offset + totalLength));
    messages.push({
      eventType: message.headers[":event-type"]?.value,
      payload: JSON.parse(new TextDecoder().decode(message.body))
    });
    offset += totalLength;
  }
  return messages;
}

test("GenerateAssistantResponse returns AWS event stream body", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererStreaming.GenerateAssistantResponse" },
    body: JSON.stringify({
      conversationState: {
        conversationId: "conv-test-1",
        currentMessage: {
          userInputMessage: { content: "hello" }
        }
      }
    })
  }, {
    provider: {
      chat: async () => ({ text: "Hi from DeepSeek V4 Pro" })
    },
    config: { models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }] }
  });

  assert.equal(response.status, 200);
  assert.equal(response.stream, true);
  assert.equal(response.headers["content-type"], "application/vnd.amazon.eventstream");
  assert.ok(response.body.length > 0);

  const message = decodeFirstMessage(response.body);
  assert.equal(message.headers[":message-type"].value, "event");
});

test("encodeAssistantResponseChunks starts with message metadata and assistant chunks", () => {
  const body = encodeAssistantResponseChunks("abc", "deepseek-v4-pro", "conv-1");
  const messages = decodeMessages(body);
  assert.equal(messages[0].eventType, "messageMetadataEvent");
  assert.equal(messages[0].payload.conversationId, "conv-1");
  assert.equal(messages[1].eventType, "assistantResponseEvent");
  assert.equal(messages.at(-1).payload.content, "abc");
});

test("streaming helpers encode metadata and internal error frames", () => {
  const metadata = decodeMessages(Buffer.from(encodeMessageMetadataEvent("conv-2")))[0];
  const error = decodeMessages(Buffer.from(encodeInternalServerException("Bad request", "provider_error")))[0];

  assert.equal(metadata.eventType, "messageMetadataEvent");
  assert.equal(metadata.payload.conversationId, "conv-2");
  assert.equal(error.eventType, "InternalServerException");
  assert.equal(error.payload.message, "Bad request");
  assert.equal(error.payload.reason, "provider_error");
});
