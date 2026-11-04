import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("support chat frontend contract", () => {
  test("uses the exact PC scan payload and handles duplicate chats", () => {
    const scan = source("../scan/pc/[code]/page.tsx");
    const supportSubmitter = scan.slice(scan.indexOf("const submitSupportChat"), scan.indexOf("const updatePcStatus"));
    assert.match(supportSubmitter, /api\.post<\{ data: \{ id: string \} \}>\("\/support-chats", \{ pcId: pcData\.id, body \}\)/);
    assert.match(supportSubmitter, /status === 409/);
    assert.doesNotMatch(supportSubmitter, /assistantId|labId/);
  });

  test("protects support routes and exposes only students and assistants in navigation", () => {
    const guard = source("../../../components/auth/role-guard.tsx");
    const sidebar = source("../../../components/layout/neo-sidebar.tsx");
    assert.match(guard, /"\/support-chats": \["MAHASISWA", "ASISTEN_LAB"\]/);
    const coordinatorMenu = sidebar.slice(sidebar.indexOf("KOORDINATOR_LAB:"), sidebar.indexOf("ASISTEN_LAB:"));
    const assistantMenu = sidebar.slice(sidebar.indexOf("ASISTEN_LAB:"), sidebar.indexOf("MAHASISWA:"));
    const studentMenu = sidebar.slice(sidebar.indexOf("MAHASISWA:"), sidebar.indexOf("MAGANG:"));
    assert.match(assistantMenu, /href: "\/support-chats"/);
    assert.match(studentMenu, /href: "\/support-chats"/);
    assert.doesNotMatch(coordinatorMenu, /href: "\/support-chats"/);
  });

  test("uses the existing authenticated notification stream as the only support-chat event source", () => {
    const streamProvider = source("../../../components/notifications/notification-panel.tsx");
    const inbox = source("./page.tsx");
    const detail = source("./[id]/page.tsx");
    assert.match(streamProvider, /\/notifications\/stream/);
    assert.match(streamProvider, /Authorization: `Bearer \$\{token\}`/);
    assert.match(streamProvider, /support-chat\.(created|claimed|message)/);
    assert.doesNotMatch([streamProvider, inbox, detail].join("\n"), /new EventSource|new WebSocket|\/support-chats\/stream|\?token=/);
  });

  test("refreshes from SSE immediately and uses 15-second polling only as a disconnected fallback", () => {
    const inbox = source("./page.tsx");
    const detail = source("./[id]/page.tsx");
    for (const page of [inbox, detail]) {
      assert.match(page, /useSupportChatStream/);
      assert.match(page, /support-chat\.(created|claimed|message)/);
      assert.match(page, new RegExp("if \\(!isStreamConnected\\)[\\s\\S]*window\\.setInterval[\\s\\S]*15_000"));
      assert.match(page, /window\.clearInterval\(interval\)/);
      assert.doesNotMatch(page, new RegExp("setInterval[\\s\\S]*15_000[\\s\\S]*useSupportChatStream"));
    }
  });

  test("makes assistant claim explicit, sends only after ownership, and acknowledges received assistant replies", () => {
    const detail = source("./[id]/page.tsx");
    const types = source("../../../types/index.ts");
    assert.match(detail, /api\.post<ApiResponse<SupportChat>>\(`\/support-chats\/\$\{id\}\/claim`, \{\}\)/);
    assert.match(detail, /chat\.assignedAssistantId === user\.id/);
    assert.match(detail, /api\.patch\(`\/support-chats\/\$\{id\}\/messages\/\$\{message\.id\}\/receipt`, \{ status: "DELIVERED" \}\)/);
    assert.match(detail, /api\.patch\(`\/support-chats\/\$\{id\}\/messages\/\$\{unreadMessage\.id\}\/receipt`, \{ status: "READ" \}\)/);
    assert.match(types, /deliveredAt\?: string \| null/);
    assert.match(types, /readAt\?: string \| null/);
  });
});
