import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { canClaimEmail, getCapacityBlock, isDispatchReclaimable } from "./email-job-policy.js";

const DISPATCH_LEASE_MS = 60_000;
const SEND_LEASE_MS = 5 * 60_000;
const PROVIDER_LIMIT_PER_SECOND = 8;

export type DispatchClaim = {
  emailId: string;
  claimToken: string;
};

export async function claimDispatch(emailId: string): Promise<DispatchClaim | null> {
  const now = new Date();
  const current = await prisma.emailDispatch.findUnique({
    where: { emailId },
    select: { state: true, claimedAt: true },
  });
  if (!current || !isDispatchReclaimable(current.state, current.claimedAt, now, DISPATCH_LEASE_MS)) return null;
  const claimToken = randomUUID();
  const claim = await prisma.emailDispatch.updateMany({
    where: {
      emailId,
      state: { in: ["PENDING", "CLAIMED"] },
      OR: [
        { state: "PENDING" },
        { state: "CLAIMED", claimedAt: null },
        { state: "CLAIMED", claimedAt: { lt: new Date(now.getTime() - DISPATCH_LEASE_MS) } },
      ],
      email: { status: "SCHEDULED" },
    },
    data: { state: "CLAIMED", claimToken, claimedAt: now, attempts: { increment: 1 } },
  });
  return claim.count === 1 ? { emailId, claimToken } : null;
}

export async function recordWorkflowStarted(claim: DispatchClaim, runId: string) {
  return prisma.emailDispatch.updateMany({
    where: { emailId: claim.emailId, state: "CLAIMED", claimToken: claim.claimToken },
    data: { state: "DISPATCHED", runId, claimToken: null, claimedAt: null, lastError: null },
  });
}

export async function releaseDispatchClaim(claim: DispatchClaim, error: unknown) {
  return prisma.emailDispatch.updateMany({
    where: { emailId: claim.emailId, state: "CLAIMED", claimToken: claim.claimToken },
    data: {
      state: "PENDING",
      claimToken: null,
      claimedAt: null,
      lastError: error instanceof Error ? error.message.slice(0, 1000) : "Workflow dispatch failed",
    },
  });
}

export async function listRecoverableDispatches(limit = 100) {
  const now = new Date();
  return prisma.emailDispatch.findMany({
    where: {
      OR: [
        { state: "PENDING" },
        { state: "CLAIMED", claimedAt: null },
        { state: "CLAIMED", claimedAt: { lt: new Date(now.getTime() - DISPATCH_LEASE_MS) } },
      ],
      email: { status: "SCHEDULED" },
    },
    select: { emailId: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });
}

export async function reserveRateLimitNotification(senderEmail: string, hourWindowStart: Date) {
  try {
    await prisma.rateLimitNotification.create({ data: { senderEmail, hourWindowStart } });
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return false;
    throw error;
  }
}

export async function claimEmailForSend(emailId: string, token: string) {
  const now = new Date();
  const current = await prisma.email.findUnique({ where: { id: emailId }, select: { status: true, processingToken: true, processingLeaseUntil: true } });
  if (!current || !canClaimEmail(current.status, current.processingToken, current.processingLeaseUntil, token, now)) return null;
  const claimed = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: { in: ["SCHEDULED", "PROCESSING"] },
      OR: [
        { processingToken: token },
        { processingLeaseUntil: null },
        { processingLeaseUntil: { lt: now } },
      ],
    },
    data: { status: "PROCESSING", error: null, processingToken: token, processingLeaseUntil: new Date(now.getTime() + SEND_LEASE_MS) },
  });
  if (claimed.count !== 1) return null;
  return prisma.email.findUnique({ where: { id: emailId }, include: { campaign: true } });
}

export async function reserveDeliveryCapacity(senderEmail: string, hourlyLimit: number, delayMs: number) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const hourWindowStart = new Date(now);
    hourWindowStart.setUTCMinutes(0, 0, 0);

    await tx.$executeRaw`
      INSERT INTO "SenderThrottle" ("senderEmail", "hourWindowStart", "hourlyCount", "nextAllowedAt", "updatedAt")
      VALUES (${senderEmail}, ${hourWindowStart}, 0, NULL, ${now})
      ON CONFLICT ("senderEmail") DO NOTHING
    `;
    await tx.$executeRaw`
      INSERT INTO "ProviderRateThrottle" ("id", "windowStart", "requestCount", "updatedAt")
      VALUES ('resend', ${new Date(Math.floor(now.getTime() / 1000) * 1000)}, 0, ${now})
      ON CONFLICT ("id") DO NOTHING
    `;
    const dailyWindow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await tx.$executeRaw`
      INSERT INTO "ProviderRateThrottle" ("id", "windowStart", "requestCount", "updatedAt")
      VALUES ('resend:daily', ${dailyWindow}, 0, ${now})
      ON CONFLICT ("id") DO NOTHING
    `;

    const providerRows = await tx.$queryRaw<Array<{ windowStart: Date; requestCount: number }>>`
      SELECT "windowStart", "requestCount" FROM "ProviderRateThrottle" WHERE "id" = 'resend' FOR UPDATE
    `;
    const provider = providerRows[0];
    const providerWindow = new Date(Math.floor(now.getTime() / 1000) * 1000);
    const providerCount = provider?.windowStart.getTime() === providerWindow.getTime() ? provider.requestCount : 0;
    const dailyRows = await tx.$queryRaw<Array<{ windowStart: Date; requestCount: number }>>`
      SELECT "windowStart", "requestCount" FROM "ProviderRateThrottle" WHERE "id" = 'resend:daily' FOR UPDATE
    `;
    const daily = dailyRows[0];
    const dailyCount = daily?.windowStart.getTime() === dailyWindow.getTime() ? daily.requestCount : 0;
    const senderRows = await tx.$queryRaw<Array<{ hourWindowStart: Date; hourlyCount: number; nextAllowedAt: Date | null }>>`
      SELECT "hourWindowStart", "hourlyCount", "nextAllowedAt"
      FROM "SenderThrottle" WHERE "senderEmail" = ${senderEmail} FOR UPDATE
    `;
    const sender = senderRows[0];
    if (!sender) throw new Error("Sender throttle reservation failed");
    const hourlyCount = sender.hourWindowStart.getTime() === hourWindowStart.getTime() ? sender.hourlyCount : 0;
    const block = getCapacityBlock({
      now,
      hourWindowStart,
      hourlyCount,
      hourlyLimit,
      nextAllowedAt: sender.nextAllowedAt,
      providerCount,
      providerLimit: PROVIDER_LIMIT_PER_SECOND,
      dailyWindowStart: dailyWindow,
      dailyCount,
      dailyLimit: env.resendDailyLimit,
      enforceDailyLimit: env.emailProvider === "resend",
    });
    if (block) return { allowed: false as const, ...block };

    await tx.senderThrottle.update({
      where: { senderEmail },
      data: { hourWindowStart, hourlyCount: hourlyCount + 1, nextAllowedAt: new Date(now.getTime() + Math.max(0, delayMs)), updatedAt: now },
    });
    await tx.providerRateThrottle.update({
      where: { id: "resend" },
      data: { windowStart: providerWindow, requestCount: providerCount + 1, updatedAt: now },
    });
    if (env.emailProvider === "resend") {
      await tx.providerRateThrottle.update({
        where: { id: "resend:daily" },
        data: { windowStart: dailyWindow, requestCount: dailyCount + 1, updatedAt: now },
      });
    }
    return { allowed: true as const };
  }, { isolationLevel: "Serializable" });
}

export async function deferEmailClaim(emailId: string, token: string) {
  return prisma.email.updateMany({
    where: { id: emailId, status: "PROCESSING", processingToken: token },
    data: { status: "SCHEDULED", processingToken: null, processingLeaseUntil: null },
  });
}

export async function markEmailSent(emailId: string, token: string, messageId: string, previewUrl: string | null) {
  return prisma.email.updateMany({
    where: { id: emailId, status: "PROCESSING", processingToken: token },
    data: { status: "SENT", sentAt: new Date(), messageId, previewUrl, processingToken: null, processingLeaseUntil: null, error: null },
  });
}

export async function recordEmailFailure(emailId: string, token: string, message: string) {
  return prisma.email.updateMany({
    where: { id: emailId, status: "PROCESSING", processingToken: token },
    data: {
      status: "FAILED",
      error: message.slice(0, 2000),
      processingToken: null,
      processingLeaseUntil: null,
    },
  });
}