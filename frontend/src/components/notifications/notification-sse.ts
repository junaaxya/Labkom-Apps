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
