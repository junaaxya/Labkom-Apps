import "dotenv/config";
import app from "./app";
import { config, validateConfig } from "./config";
import prisma from "./config/database";
import redis from "./config/redis";
import { startCronJobs } from "./services/cron.service";

const startServer = async () => {
  try {
    validateConfig();
    await prisma.$connect();
    console.log("[Database] PostgreSQL connected successfully");

    console.log("[Redis] Auto-connecting on first use");

    startCronJobs();

    if (process.env.ENABLE_WHATSAPP === "true") {
      import("./services/whatsapp.service").then(({ whatsappService }) => {
        whatsappService.connect().catch((err: any) => {
          console.log("[WhatsApp] Auto-connect skipped:", err.message || "No auth session");
        });
      });
    }

    app.listen(config.port, () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║   Lab Management API Server              ║
  ║   Port: ${config.port}                            ║
  ║   Env:  ${config.nodeEnv.padEnd(30)}║
  ║   API:  http://localhost:${config.port}/api/v1     ║
  ╚══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log("\n[Server] Shutting down gracefully...");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
