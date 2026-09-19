import { EventEmitter } from "events";
import { Message } from "@/types/strapi";

// Global singleton event emitter for in-process Server-Sent Events
declare global {
  var __thynkwise_emitter__: EventEmitter | undefined;
}

export const inboxEventEmitter: EventEmitter =
  globalThis.__thynkwise_emitter__ || new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalThis.__thynkwise_emitter__ = inboxEventEmitter;
}

export const INBOX_EVENTS = {
  MESSAGE_RECEIVED: "message:received",
  MESSAGE_STATUS_UPDATED: "message:status_updated",
  CONVERSATION_UPDATED: "conversation:updated",
} as const;

export function emitNewInboundMessage(conversationId: string | number, message: Message) {
  inboxEventEmitter.emit(INBOX_EVENTS.MESSAGE_RECEIVED, {
    conversationId: String(conversationId),
    message,
  });
}

export function emitMessageStatusUpdate(wamId: string, status: Message["status"]) {
  inboxEventEmitter.emit(INBOX_EVENTS.MESSAGE_STATUS_UPDATED, {
    wamId,
    status,
  });
}
