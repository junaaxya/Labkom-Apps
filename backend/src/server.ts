import "dotenv/config";
import app from "./app";
import { config, validateConfig, validateMagangEmailDelivery } from "./config";
import prisma from "./config/database";
import redis from "./config/redis";
import { startCronJobs } from "./services/cron.service";
import { ShiftScheduleService } from "./services/attendance.service";
import { MagangApprovalEmailWorker } from "./services/magang-approval-email-worker.service";
import { AcademicCalendarSyncService } from "./services/academic-calendar-sync.service";
import { connectDatabaseWithRetry } from "./config/database-startup";

const startServer = async () => {
  try {
    validateConfig();
    validateMagangEmailDelivery();
    await connectDatabaseWithRetry(() => prisma.$connect(), {
      onRetry: ({ attempt, maxAttempts, delayMs }) => {
        console.warn(
          `[Database] PostgreSQL belum siap (percobaan ${attempt}/${maxAttempts}); mencoba lagi dalam ${delayMs} ms`,
        );
      },
    });
    console.log("[Database] PostgreSQL connected successfully");

    console.log("[Redis] Auto-connecting on first use");

    startCronJobs();
    MagangApprovalEmailWorker.start();
    ShiftScheduleService.maintainRecurringPicketHorizon().catch((error) => {
      console.error("[Recurring Picket] Horizon maintenance failed:", error);
    });
    AcademicCalendarSyncService.sync().catch((error) => {
      console.error("[Academic Calendar Sync] Startup sync failed; keeping last known term:", error);
    });

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
  await MagangApprovalEmailWorker.stop();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
