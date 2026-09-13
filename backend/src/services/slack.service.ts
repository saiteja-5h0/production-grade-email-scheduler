import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";

export async function notifyRateLimit(userId: string, senderEmail: string, retryAt: number) {
  const key = `rate-limit-notified:${senderEmail}:${new Date().toISOString().slice(0, 13)}`;
  if (!(await redis.set(key, "1", "EX", 7200, "NX"))) return;
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  // No Slack connected for this user yet (or disconnected) -> silently skip, no crash.
  if (!connection || !process.env.SLACK_DEFAULT_CHANNEL_ID) return;
  await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${connection.accessToken}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: process.env.SLACK_DEFAULT_CHANNEL_ID, text: `Rate limit reached for ${senderEmail}. Remaining emails resume at ${new Date(retryAt).toLocaleString()}.` }) });
}
