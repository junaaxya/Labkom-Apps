import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { TRUSTED_PROXY_RANGES } from "./trusted-proxy";

async function observedClientIp(xForwardedFor: string): Promise<string> {
  const app = express();
  app.set("trust proxy", [...TRUSTED_PROXY_RANGES]);
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ip`, {
      headers: { "x-forwarded-for": xForwardedFor },
    });
    return ((await response.json()) as { ip: string }).ip;
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("Cloudflare tunnel private hops resolve to the first public client IP", async () => {
  assert.equal(await observedClientIp("198.51.100.7, 172.24.0.1"), "198.51.100.7");
});

test("a direct public proxy hop prevents a caller-supplied leftmost IP from being trusted", async () => {
  assert.equal(await observedClientIp("203.0.113.99, 198.51.100.8"), "198.51.100.8");
});

test("private IPv6 tunnel hops preserve the public IPv6 client address", async () => {
  assert.equal(await observedClientIp("2001:db8::1234, fd00::1"), "2001:db8::1234");
});
