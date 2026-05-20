#!/usr/bin/env node

const dgram = require("dgram");

function usage(message) {
  if (message) console.error(`ERROR: ${message}`);
  console.error("Usage: node scripts/wol-send.js --mac <AA:BB:CC:DD:EE:FF> [--broadcast 192.168.100.255] [--ports 9,7]");
  process.exit(1);
}

const args = process.argv.slice(2);
let mac = "";
let broadcast = "192.168.100.255";
let ports = [9];

if (args.length > 0 && !args[0].startsWith("--")) {
  mac = args[0] || "";
  broadcast = args[1] || broadcast;
  if (args[2]) {
    ports = args[2]
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);
  }
} else {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--mac") {
      mac = next || "";
      i += 1;
    } else if (arg === "--broadcast") {
      broadcast = next || "";
      i += 1;
    } else if (arg === "--ports") {
      ports = (next || "")
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);
      i += 1;
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }
}

const macBytes = mac.replace(/[:-]/g, "").match(/.{2}/g);
if (!macBytes || macBytes.length !== 6) usage(`Invalid MAC address: ${mac}`);
if (!broadcast) usage("Broadcast address is required");
if (ports.length === 0) usage("At least one UDP port is required");

const macBuffer = Buffer.from(macBytes.map((part) => Number.parseInt(part, 16)));
const magicPacket = Buffer.alloc(6 + 16 * 6, 0xff);
for (let i = 0; i < 16; i += 1) {
  macBuffer.copy(magicPacket, 6 + i * 6);
}

async function send(port) {
  await new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.once("error", (error) => {
      socket.close();
      reject(error);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(magicPacket, 0, magicPacket.length, port, broadcast, (error) => {
        socket.close();
        if (error) reject(error);
        else resolve();
      });
    });
  });
  console.log(`sent ${mac.toLowerCase()} to ${broadcast}:${port}`);
}

(async () => {
  for (const port of ports) {
    await send(port);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
