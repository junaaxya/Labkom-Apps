import { Response } from "express";

type SSEClient = {
  userId: string;
  res: Response;
  lastPingAt: number;
};

const HEARTBEAT_INTERVAL_MS = 25_000;
const STALE_AFTER_MS = 90_000;
const MAX_CLIENTS_PER_USER = 4;

class SSEManager {
  private clients: SSEClient[] = [];
  private heartbeat: NodeJS.Timeout | null = null;

  private ensureHeartbeat() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => this.sweep(), HEARTBEAT_INTERVAL_MS);
    if (typeof this.heartbeat.unref === "function") this.heartbeat.unref();
  }

  private sweep() {
    if (this.clients.length === 0) {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }
      return;
    }

    const now = Date.now();
    const ping = `: ping ${now}\n\n`;
    const survivors: SSEClient[] = [];

    for (const client of this.clients) {
      if (now - client.lastPingAt > STALE_AFTER_MS) {
        try { client.res.end(); } catch {}
        continue;
      }
      try {
        client.res.write(ping);
        client.lastPingAt = now;
        survivors.push(client);
      } catch {
        try { client.res.end(); } catch {}
      }
    }

    this.clients = survivors;
  }

  addClient(userId: string, res: Response) {
    const userClients = this.clients.filter((c) => c.userId === userId);
    if (userClients.length >= MAX_CLIENTS_PER_USER) {
      const oldest = userClients[0];
      this.clients = this.clients.filter((c) => c !== oldest);
      try { oldest.res.end(); } catch {}
    }

    const client: SSEClient = { userId, res, lastPingAt: Date.now() };
    this.clients.push(client);
    this.ensureHeartbeat();

    res.on("close", () => {
      this.clients = this.clients.filter((c) => c.res !== res);
    });
  }

  sendToUser(userId: string, event: string, data: unknown) {
    const userClients = this.clients.filter((c) => c.userId === userId);
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of userClients) {
      try {
        client.res.write(payload);
        client.lastPingAt = Date.now();
      } catch {
        try { client.res.end(); } catch {}
      }
    }
  }

  sendToAll(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(payload);
        client.lastPingAt = Date.now();
      } catch {
        try { client.res.end(); } catch {}
      }
    }
  }

  getConnectedCount(): number {
    return this.clients.length;
  }
}

export const sseManager = new SSEManager();
