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

  test("protects support routes and exposes only two roles in sidebar", () => {
    const guard = source("../../../components/auth/role-guard.tsx");
    const sidebar = source("../../../components/layout/neo-sidebar.tsx");
    assert.match(guard, /"\/support-chats": \["MAHASISWA", "ASISTEN_LAB"\]/);
    const coordinatorMenu = sidebar.slice(sidebar.indexOf("KOORDINATOR_LAB:"), sidebar.indexOf("ASISTEN_LAB:"));
    const assistantMenu = sidebar.slice(sidebar.indexOf("ASISTEN_LAB:"), sidebar.indexOf("MAHASISWA:"));
    const studentMenu = sidebar.slice(sidebar.indexOf("MAHASISWA:"), sidebar.indexOf("MAGANG:"));
    const magangMenu = sidebar.slice(sidebar.indexOf("MAGANG:"), sidebar.indexOf("const ketuaKelasExtraMenu"));
    assert.match(assistantMenu, /href: "\/support-chats"/);
    assert.match(studentMenu, /href: "\/support-chats"/);
    assert.doesNotMatch(coordinatorMenu, /href: "\/support-chats"/);
    assert.doesNotMatch(magangMenu, /href: "\/support-chats"/);
  });

  test("renders waiting and handled state and preserves API message status", () => {
    const inbox = source("./page.tsx");
    const detail = source("./[id]/page.tsx");
    assert.match(inbox, /WAITING: "Tersedia untuk dibalas"/);
    assert.match(inbox, /HANDLED: "Sedang ditangani"/);
    assert.match(inbox, /Menunggu asisten yang sedang bertugas/);
    assert.match(detail, /status === "WAITING"/);
    assert.match(detail, /asisten pertama yang membalas/);
    assert.match(detail, /status: response\.data\.chatStatus/);
    assert.match(detail, /\/support-chats\/\$\{id\}\/messages[\s\S]*\{ body: trimmed \}/);
  });

  test("a losing first-responder claim refreshes the chat instead of appending a rejected message", () => {
    const detail = source("./[id]/page.tsx");
    const sendMessage = detail.slice(detail.indexOf("const sendMessage"), detail.indexOf("if (loading)"));
    assert.match(sendMessage, /status === 409/);
    assert.match(sendMessage, /await loadChat\(false\)/);
    assert.match(sendMessage, /sudah diambil asisten lain/);
    assert.match(sendMessage, /setSendError/);
    assert.match(detail, /Chat ini sudah tidak dapat kamu akses/);
    const claimLossBranch = sendMessage.slice(sendMessage.indexOf("if (status === 409)"));
    assert.doesNotMatch(claimLossBranch, /response\.data/);
  });

  test("refreshes visible chats on an interval and focus, then cleans up", () => {
    const inbox = source("./page.tsx");
    const detail = source("./[id]/page.tsx");
    for (const page of [inbox, detail]) {
      assert.match(page, /window\.setInterval/);
      assert.match(page, /}, 15_000\)/);
      assert.match(page, /document\.visibilityState === "visible"/);
      assert.match(page, /window\.addEventListener\("focus"/);
      assert.match(page, /window\.clearInterval\(interval\)/);
      assert.match(page, /window\.removeEventListener\("focus"/);
      assert.match(page, /document\.removeEventListener\("visibilitychange"/);
    }
  });

  test("uses visible polling only, without EventSource, WebSocket, or a new stream", () => {
    const files = [source("./page.tsx"), source("./[id]/page.tsx"), source("../scan/pc/[code]/page.tsx")].join("\n");
    assert.doesNotMatch(files, /EventSource|new WebSocket|ReadableStream|\?token=/);
  });
});
