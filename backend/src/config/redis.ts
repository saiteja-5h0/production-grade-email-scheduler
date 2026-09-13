import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = env.redisUrl
  ? new Redis(env.redisUrl, { maxRetriesPerRequest: null })
  : new Redis({
      host: env.redisHost,
      port: env.redisPort,
      maxRetriesPerRequest: null,
    });

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (error: Error) => {
  console.error(`Redis error: ${error.message}`);
});