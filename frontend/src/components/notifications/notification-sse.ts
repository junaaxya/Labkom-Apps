export type SseEvent = {
  event: string;
  data: string;
};

type SseParser = {
  push: (chunk: string) => void;
};

export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length > 0) {
      onEvent({ event: eventName || "message", data: dataLines.join("\n") });
    }
    eventName = "";
    dataLines = [];
  };

  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line === "") {
          dispatch();
        } else if (line.startsWith(":")) {
          continue;
        } else if (line.startsWith("event:")) {
          eventName = line.slice(6).trimStart();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    },
  };
}

export function parseNotificationEvent(
  event: SseEvent,
): Record<string, unknown> | null {
  if (event.event !== "notification") return null;

  try {
    const value: unknown = JSON.parse(event.data);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export type SupportChatSseEventName =
  | "support-chat.created"
  | "support-chat.claimed"
  | "support-chat.message";

export interface ParsedSupportChatEvent {
  event: SupportChatSseEventName;
  chatId: string;
  assistantId?: string;
  messageId?: string;
  raw: Record<string, unknown>;
}

export function parseSupportChatEvent(event: SseEvent): ParsedSupportChatEvent | null {
  if (
    event.event !== "support-chat.created" &&
    event.event !== "support-chat.claimed" &&
    event.event !== "support-chat.message"
  ) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(event.data);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const chatId = typeof record.chatId === "string" ? record.chatId : null;
    if (!chatId) return null;

    return {
      event: event.event,
      chatId,
      assistantId: typeof record.assistantId === "string" ? record.assistantId : undefined,
      messageId: typeof record.messageId === "string" ? record.messageId : undefined,
      raw: record,
    };
  } catch {
    return null;
  }
}
