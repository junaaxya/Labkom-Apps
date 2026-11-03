import { config } from "../config";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";

export class MagangApprovalEmailWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunningTick = false;
  private static isShuttingDown = false;

  static isEnabled(): boolean {
    return process.env.EMAIL_WORKER_ENABLED === "true";
  }

  static isRunning(): boolean {
    return this.timer !== null;
  }

  static isBusy(): boolean {
    return this.isRunningTick;
  }

  static start(intervalMs?: number, batchSize?: number): boolean {
    if (!this.isEnabled()) {
      console.log("[EmailWorker] Background worker disabled (EMAIL_WORKER_ENABLED!=true)");
      return false;
    }
    if (this.timer) {
      return true;
    }

    const interval = intervalMs ?? config.emailWorkerIntervalMs ?? 10_000;
    const batch = batchSize ?? config.emailWorkerBatchSize ?? 10;
    this.isShuttingDown = false;

    this.timer = setInterval(() => {
      this.tick(new Date(), batch).catch((err: any) => {
        console.error("[EmailWorker] Unhandled tick error:", err?.message || "Unknown error");
      });
    }, interval);

    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }

    console.log(`[EmailWorker] Background worker started (interval: ${interval}ms, batch: ${batch})`);
    return true;
  }

  static async tick(now = new Date(), batchSize = 10): Promise<number> {
    if (this.isShuttingDown || this.isRunningTick) {
      return 0;
    }
    this.isRunningTick = true;
    try {
      const processedCount = await MagangApprovalEmailDeliveryService.recoverDue(now, batchSize);
      return processedCount;
    } catch (error: any) {
      console.error("[EmailWorker] Error during worker tick:", error?.message || "Unknown error");
      return 0;
    } finally {
      this.isRunningTick = false;
    }
  }

  static async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const start = Date.now();
    while (this.isRunningTick && Date.now() - start < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    console.log("[EmailWorker] Background worker stopped");
  }

  static resetForTest(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunningTick = false;
    this.isShuttingDown = false;
  }
}
