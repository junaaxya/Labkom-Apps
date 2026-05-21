const http = require("http");
const { execFile } = require("child_process");

const PORT = process.env.WOL_RELAY_PORT || 9876;
const HOST = process.env.WOL_RELAY_HOST || "127.0.0.1";
const TOKEN = process.env.WOL_RELAY_TOKEN || "";
const DEFAULT_BROADCAST = process.env.WOL_DEFAULT_BROADCAST || "192.168.100.255";
const WOL_SCRIPT = "/srv/apps/labkom-apps/scripts/wol-send.js";
const BURST_COUNT = Math.max(1, parseInt(process.env.WOL_RELAY_BURST_COUNT || "4", 10));
const BURST_DELAY_MS = Math.max(0, parseInt(process.env.WOL_RELAY_BURST_DELAY_MS || "350", 10));

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runWol(macAddress, broadcastAddress) {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [WOL_SCRIPT, macAddress, broadcastAddress, "9,7"],
      { timeout: 10000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message).trim()));
          return;
        }

        const sentTargets = String(stdout || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const m = line.match(/^sent\s+.+?\s+to\s+([^:]+):(\d+)$/i);
            return m ? `${m[1]}:${m[2]}` : line;
          });

        resolve(sentTargets);
      }
    );
  });
}

async function runWolBurst(macAddress, broadcastAddress) {
  const sentTargets = [];

  for (let i = 0; i < BURST_COUNT; i += 1) {
    const targets = await runWol(macAddress, broadcastAddress);
    sentTargets.push(...targets.map((target) => `${target} burst-${i + 1}`));

    if (i < BURST_COUNT - 1 && BURST_DELAY_MS > 0) {
      await delay(BURST_DELAY_MS);
    }
  }

  return sentTargets;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "POST" || req.url !== "/wake") {
      return sendJson(res, 404, { success: false, message: "Not found" });
    }

    if (TOKEN) {
      const auth = req.headers.authorization || "";
      if (auth !== `Bearer ${TOKEN}`) {
        return sendJson(res, 401, { success: false, message: "Unauthorized" });
      }
    }

    const body = await parseJson(req);
    const macAddress = body.macAddress;
    const broadcastAddresses = Array.isArray(body.broadcastAddresses) && body.broadcastAddresses.length
      ? body.broadcastAddresses
      : [body.broadcastAddress || DEFAULT_BROADCAST];

    if (!macAddress || typeof macAddress !== "string") {
      return sendJson(res, 400, { success: false, message: "macAddress wajib diisi" });
    }

    const sentTargets = [];
    for (const broadcastAddress of broadcastAddresses) {
      const targets = await runWolBurst(macAddress, broadcastAddress);
      sentTargets.push(...targets);
    }

    return sendJson(res, 200, {
      success: true,
      sentTargets,
      result: `Magic packet sent to ${macAddress} via ${sentTargets.join(", ")}`,
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`WOL relay listening on http://${HOST}:${PORT}`);
});
