import { Response } from "express";

type SSEClient = {
  userId: string;
  res: Response;
};

class SSEManager {
  private clients: SSEClient[] = [];

  addClient(userId: string, res: Response) {
    this.clients.push({ userId, res });

    res.on("close", () => {
      this.clients = this.clients.filter(
        (c) => c.res !== res
      );
    });
  }

  sendToUser(userId: string, event: string, data: unknown) {
    const userClients = this.clients.filter((c) => c.userId === userId);
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of userClients) {
      client.res.write(payload);
    }
  }

  sendToAll(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.res.write(payload);
    }
  }

  getConnectedCount(): number {
    return this.clients.length;
  }
}

export const sseManager = new SSEManager();
