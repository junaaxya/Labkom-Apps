import Redis from "ioredis";
import { config } from "./index";

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on("error", () => console.warn("[Redis] Koneksi belum tersedia"));
redis.on("ready", () => console.info("[Redis] Siap"));

export default redis;
