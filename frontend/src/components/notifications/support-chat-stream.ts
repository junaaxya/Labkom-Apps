"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ParsedSupportChatEvent } from "./notification-sse";

const EVENT_NAME = "support-chat:event";
const STATUS_EVENT_NAME = "support-chat:status";

let globalIsConnected = false;

export function setSupportChatStreamConnected(connected: boolean): void {
  if (globalIsConnected === connected) return;
  globalIsConnected = connected;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<boolean>(STATUS_EVENT_NAME, { detail: connected }),
    );
  }
}

export function emitSupportChatEvent(event: ParsedSupportChatEvent): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ParsedSupportChatEvent>(EVENT_NAME, { detail: event }),
    );
  }
}

function subscribeStatus(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(STATUS_EVENT_NAME, handler);
  return () => window.removeEventListener(STATUS_EVENT_NAME, handler);
}

function getStatusSnapshot(): boolean {
  return globalIsConnected;
}

function getServerStatusSnapshot(): boolean {
  return false;
}

export function useSupportChatStream(
  onEvent?: (event: ParsedSupportChatEvent) => void,
): { isStreamConnected: boolean } {
  const isStreamConnected = useSyncExternalStore(
    subscribeStatus,
    getStatusSnapshot,
    getServerStatusSnapshot,
  );

  useEffect(() => {
    if (!onEvent || typeof window === "undefined") return;

    const handleEvent = (e: Event) => {
      const custom = e as CustomEvent<ParsedSupportChatEvent>;
      if (custom.detail) {
        onEvent(custom.detail);
      }
    };

    window.addEventListener(EVENT_NAME, handleEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, handleEvent);
    };
  }, [onEvent]);

  return { isStreamConnected };
}
