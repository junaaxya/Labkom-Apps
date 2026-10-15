import path from "path";

export type MagangEmailDeliveryMode = "disabled" | "qa-file-sink" | "smtp";

const OFFICIAL_SMTP = {
  host: "smtp.gmail.com",
  port: 465,
  user: "labkom@unmuhbabel.ac.id",
  from: "LabKom <labkom@unmuhbabel.ac.id>",
} as const;

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined && process.env.NODE_ENV !== "production") return fallback;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[FATAL] Missing required environment variable: ${key}`);
  }
  return fallback || "";
}

const defaultUploadDir = process.env.NODE_ENV === "production"
  ? "/app/uploads"
  : path.resolve(process.cwd(), "uploads");

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: requireEnv("JWT_SECRET", "dev-only-secret-change-in-production"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  uploadDir: process.env.UPLOAD_DIR || defaultUploadDir,
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/lab_management?schema=public"),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  aiSharedEnabled: process.env.AI_SHARED_ENABLED === "true",
  aiSharedUrl: process.env.AI_SHARED_URL || "",
  aiSharedModel: process.env.AI_SHARED_MODEL || "qwen2.5:7b",
  aiSharedTimeoutMs: parseInt(process.env.AI_SHARED_TIMEOUT_MS || "60000", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/v1/calendar/callback",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  wolHostCommand: process.env.WOL_HOST_COMMAND || "",
  wolRelayUrl: process.env.WOL_RELAY_URL || "",
  wolRelayToken: process.env.WOL_RELAY_TOKEN || "",
  wolDefaultBroadcast: process.env.WOL_DEFAULT_BROADCAST || "",
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY || "",
  midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  hostingBrandName: process.env.HOSTING_BRAND_NAME || "LabKom Hosting",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || process.env.APP_URL || "mailto:admin@labkom.ac.id",
  magangEmailDelivery: (process.env.MAGANG_EMAIL_DELIVERY || "disabled") as MagangEmailDeliveryMode,
  emailWorkerEnabled: process.env.EMAIL_WORKER_ENABLED === "true",
  emailWorkerIntervalMs: parseInt(process.env.EMAIL_WORKER_INTERVAL_MS || "10000", 10),
  emailWorkerBatchSize: parseInt(process.env.EMAIL_WORKER_BATCH_SIZE || "10", 10),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: process.env.SMTP_PORT || "",
  smtpSecure: process.env.SMTP_SECURE || "",
  smtpUser: process.env.SMTP_USER || "",
  smtpFrom: process.env.SMTP_FROM || "",
  smtpPass: process.env.SMTP_PASS || "",
};

export function validateMagangEmailDelivery(): void {
  const mode = (process.env.MAGANG_EMAIL_DELIVERY || "disabled") as MagangEmailDeliveryMode;
  const nodeEnv = process.env.NODE_ENV || "development";
  if (mode !== "disabled" && mode !== "qa-file-sink" && mode !== "smtp") {
    throw new Error("[FATAL] MAGANG_EMAIL_DELIVERY tidak valid");
  }
  if (mode === "qa-file-sink" && nodeEnv === "production") {
    throw new Error("[FATAL] QA email sink dilarang pada production");
  }
  if (mode === "smtp") {
    if (nodeEnv === "qa") throw new Error("[FATAL] SMTP dilarang pada QA");
    if (
      process.env.SMTP_HOST !== OFFICIAL_SMTP.host ||
      process.env.SMTP_PORT !== String(OFFICIAL_SMTP.port) ||
      process.env.SMTP_SECURE !== "true" ||
      process.env.SMTP_USER !== OFFICIAL_SMTP.user ||
      process.env.SMTP_FROM !== OFFICIAL_SMTP.from ||
      !process.env.SMTP_PASS
    ) {
      throw new Error("[FATAL] Konfigurasi SMTP LabKom tidak lengkap atau tidak valid");
    }
  }
}

export function validateConfig(): void {
  const warnings: string[] = [];

  if (!process.env.AI_SHARED_ENABLED && !process.env.OPENAI_API_KEY) {
    warnings.push("AI provider not configured — AI Assistant uses rule-based fallback");
  }
  if (process.env.AI_SHARED_ENABLED === "true" && !process.env.AI_SHARED_URL) {
    warnings.push("AI_SHARED_ENABLED is true but AI_SHARED_URL is not set");
  }
  if (!process.env.GOOGLE_CLIENT_ID) warnings.push("GOOGLE_CLIENT_ID not set — Calendar sync disabled");
  if (!process.env.REDIS_URL) warnings.push("REDIS_URL not set — using default localhost");
  if (!process.env.MIDTRANS_SERVER_KEY) warnings.push("MIDTRANS_SERVER_KEY not set — hosting checkout disabled");
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    warnings.push("VAPID keys not set — Web Push disabled");
  }

  if (config.nodeEnv === "production") {
    if (!process.env.CORS_ORIGIN) throw new Error("[FATAL] CORS_ORIGIN must be set in production");
    if (!process.env.APP_URL) throw new Error("[FATAL] APP_URL must be set in production");
  }

  for (const w of warnings) {
    console.warn(`[Config] ${w}`);
  }
}
