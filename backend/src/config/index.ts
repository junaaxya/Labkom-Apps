import path from "path";

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
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/v1/calendar/callback",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  wolHostCommand: process.env.WOL_HOST_COMMAND || "",
  wolRelayUrl: process.env.WOL_RELAY_URL || "",
  wolRelayToken: process.env.WOL_RELAY_TOKEN || "",
  wolDefaultBroadcast: process.env.WOL_DEFAULT_BROADCAST || "",
};

export function validateConfig(): void {
  const warnings: string[] = [];

  if (!process.env.OPENAI_API_KEY) warnings.push("OPENAI_API_KEY not set — AI features disabled");
  if (!process.env.GOOGLE_CLIENT_ID) warnings.push("GOOGLE_CLIENT_ID not set — Calendar sync disabled");
  if (!process.env.REDIS_URL) warnings.push("REDIS_URL not set — using default localhost");

  if (config.nodeEnv === "production") {
    if (!process.env.CORS_ORIGIN) throw new Error("[FATAL] CORS_ORIGIN must be set in production");
    if (!process.env.APP_URL) throw new Error("[FATAL] APP_URL must be set in production");
  }

  for (const w of warnings) {
    console.warn(`[Config] ${w}`);
  }
}
