import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export default redis;
