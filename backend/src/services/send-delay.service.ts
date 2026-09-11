import { redis } from "../config/redis.js";

type DelayResult = {
  allowed: boolean;
  retryAt?: number;
};

export async function checkSendDelay(
  senderEmail: string,
  delayMs: number
): Promise<DelayResult> {
  const key = `email-next-send:${senderEmail}`;

  const script = `
    local now = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])
    local nextAllowed = redis.call("GET", KEYS[1])

    if nextAllowed and now < tonumber(nextAllowed) then
      return tonumber(nextAllowed)
    end

    redis.call("SET", KEYS[1], now + delay, "PX", delay + 1000)
    return 0
  `;

  const result = await redis.eval(
    script,
    1,
    key,
    Date.now(),
    delayMs
  );
  const retryAt = Number(result);

  if (retryAt > 0) {
    return { allowed: false, retryAt };
  }

  return { allowed: true };
}