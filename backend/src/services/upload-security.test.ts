import assert from "node:assert/strict";
import test from "node:test";
import redis from "../config/redis";
import { hasImageSignature } from "../config/upload";
import { assertTemporaryUploadOwnership } from "./protected-file-access.service";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("image signature validation rejects a spoofed client MIME type", () => {
  assert.equal(hasImageSignature(Buffer.from("not an image"), "image/png"), false);
  assert.equal(
    hasImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"),
    true,
  );
});

test("ticket attachment ownership accepts only the matching temporary owner and category", async () => {
  const restore = replace(redis, "get", async (key: string) => key.includes("tickets:ticket-photo.png") ? "student-1" : null);
  try {
    await assert.doesNotReject(assertTemporaryUploadOwnership(
      "student-1",
      ["/uploads/tickets/ticket-photo.png"],
      "tickets",
    ));
    await assert.rejects(
      assertTemporaryUploadOwnership("student-2", ["/uploads/tickets/ticket-photo.png"], "tickets"),
      /tidak dimiliki/,
    );
    await assert.rejects(
      assertTemporaryUploadOwnership("student-1", ["/uploads/evidence/ticket-photo.png"], "tickets"),
      /Path file upload tidak valid/,
    );
  } finally {
    restore();
  }
});
