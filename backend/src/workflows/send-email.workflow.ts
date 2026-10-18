import { createHook, FatalError, getStepMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { prisma } from "../config/database.js";
import {
  claimEmailForSend,
  deferEmailClaim,
  recordEmailFailure,
  recordSimulatedEmailSent,
  reserveDeliveryCapacity,
  reserveRateLimitNotification,
} from "../services/email-job.service.js";
import { emailWorkflowHookToken, simulatedDeliveryShouldFail } from "../services/email-job-policy.js";

type SendResult = "sent" | "failed" | "already-finished" | "suppressed";
type DeliveryResult = { status: SendResult } | { status: "deferred"; retryAt: string };

export async function sendScheduledEmail(emailId: string): Promise<SendResult | "deferred"> {
  "use workflow";

  const hook = createHook({ token: emailWorkflowHookToken(emailId) });
  const conflict = await hook.getConflict();
  if (conflict) return "already-finished";

  const schedule = await getEmailSchedule(emailId);
  if (!schedule) return "already-finished";
  await sleep(new Date(schedule.scheduledAt));

  let result: Awaited<ReturnType<typeof deliverEmail>>;
  try {
    result = await deliverEmail(emailId);
  } catch (error) {
    await markEmailFailed(emailId, error instanceof Error ? error.message : "Email delivery failed");
    throw error;
  }

  if (result.status === "deferred") {
    await sleep(new Date(result.retryAt));
    hook.dispose();
    try {
      const nextRun = await start(sendScheduledEmail, [emailId]);
      await markOutboxRun(emailId, nextRun.runId);
      return "deferred";
    } catch (error) {
      await releaseOutboxForRecovery(emailId, error instanceof Error ? error.message : "Workflow continuation failed");
      throw error;
    }
  }
  return result.status;
}

async function getEmailSchedule(emailId: string) {
  "use step";
  const email = await prisma.email.findUnique({ where: { id: emailId }, select: { scheduledAt: true, status: true } });
  if (!email || email.status !== "SCHEDULED") return null;
  return { scheduledAt: email.scheduledAt.toISOString() };
}

async function deliverEmail(emailId: string): Promise<DeliveryResult> {
  "use step";
  const { stepId } = getStepMetadata();
  const token = stepId;
  const email = await claimEmailForSend(emailId, token);
  if (!email) return { status: "already-finished" };

  if (email.consentStatus !== "CONFIRMED") {
    await recordEmailFailure(emailId, token, "Recipient consent was not confirmed");
    throw new FatalError("Recipient consent was not confirmed");
  }

  const suppressed = await prisma.suppressedRecipient.findUnique({ where: { email: email.recipient.toLowerCase() } });
  if (suppressed) {
    await recordEmailFailure(emailId, token, `Recipient suppressed: ${suppressed.reason}`);
    return { status: "suppressed" };
  }

  const capacity = await reserveDeliveryCapacity(
    email.campaign.senderEmail,
    email.campaign.hourlyLimit,
    email.campaign.delayMs
  );
  if (!capacity.allowed) {
    await deferEmailClaim(emailId, token);
    if (capacity.reason === "hourly") {
      const hourStart = new Date(capacity.retryAt);
      hourStart.setUTCMinutes(0, 0, 0);
      if (await reserveRateLimitNotification(email.campaign.senderEmail, hourStart)) {
        const user = await prisma.slackConnection.findUnique({ where: { userId: email.campaign.userId } });
        if (user && process.env.SLACK_DEFAULT_CHANNEL_ID) {
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { Authorization: `Bearer ${user.accessToken}`, "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
              channel: process.env.SLACK_DEFAULT_CHANNEL_ID,
              text: `Rate limit reached for ${email.campaign.senderEmail}. Remaining emails resume at ${capacity.retryAt.toISOString()}.`,
            }),
          }).catch(() => undefined);
        }
      }
    }
    return { status: "deferred", retryAt: capacity.retryAt.toISOString() };
  }

  if (simulatedDeliveryShouldFail()) {
    await recordEmailFailure(emailId, token, "Simulated delivery failure (random demo outcome)");
    return { status: "failed" };
  }

  const saved = await recordSimulatedEmailSent(emailId, token);
  if (saved.count !== 1) throw new Error("Email processing claim was lost before the simulated result was saved");
  return { status: "sent" };
}

deliverEmail.maxRetries = 2;

async function markEmailFailed(emailId: string, message: string) {
  "use step";
  await prisma.email.updateMany({
    where: { id: emailId, status: { in: ["SCHEDULED", "PROCESSING"] } },
    data: { status: "FAILED", error: message.slice(0, 2000), processingToken: null, processingLeaseUntil: null },
  });
}

async function markOutboxRun(emailId: string, runId: string) {
  "use step";
  await prisma.emailDispatch.updateMany({
    where: { emailId, state: { in: ["DISPATCHED", "CLAIMED"] } },
    data: { state: "DISPATCHED", runId, claimToken: null, claimedAt: null, lastError: null },
  });
}

async function releaseOutboxForRecovery(emailId: string, message: string) {
  "use step";
  await prisma.emailDispatch.updateMany({
    where: { emailId, state: "DISPATCHED" },
    data: { state: "PENDING", runId: null, claimToken: null, claimedAt: null, lastError: message.slice(0, 1000) },
  });
}