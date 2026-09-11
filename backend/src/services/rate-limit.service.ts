import { redis } from "../config/redis.js";

export type RateLimitResult = {
  allowed: boolean;
  retryAt?: number;
  count?: number;
};

export async function checkHourlyLimit(
  senderEmail: string,
  hourlyLimit: number
): Promise<RateLimitResult> {
  const now = new Date();

  const hourKey = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
  ].join("-");

  const key = `email-rate:${senderEmail}:${hourKey}`;
  const script = `
    local count = redis.call("INCR", KEYS[1])

    if count == 1 then
      redis.call("EXPIRE", KEYS[1], 7200)
    end

    if count <= tonumber(ARGV[1]) then
      return count
    end

    redis.call("DECR", KEYS[1])
    return 0
  `;

  const result = await redis.eval(script, 1, key, hourlyLimit);
  const count = Number(result);

  if (count > 0) {
    return { allowed: true, count };
  }

  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  return {
    allowed: false,
    retryAt: nextHour.getTime(),
    count: hourlyLimit,
  };
}