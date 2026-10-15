import { Router } from "express";
import { prisma } from "../config/database.js";
import { searchEmails } from "../services/email-search.service.js";
import { requireAuthenticated } from "../middleware/auth.js";
import { dispatchEmail, recoverPendingEmailDispatches } from "../services/email-dispatch.service.js";
import { verifyUnsubscribeToken } from "../services/unsubscribe.service.js";
import { Resend } from "resend";
import { env } from "../config/env.js";
import { effectiveCampaignStart } from "../services/email-job-policy.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const router = Router();
router.use(requireAuthenticated);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS_PER_CAMPAIGN = 100;

function positiveInteger(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

router.post("/schedule", async (req, res) => {
  try {
    const {
      subject,
      body,
      recipients,
      startTime,
      delayMs,
      hourlyLimit,
      senderEmail,
      consentConfirmed,
    } = req.body;

    if (
      !subject ||
      !body ||
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !startTime ||
      !senderEmail ||
      consentConfirmed !== true ||
      typeof subject !== "string" ||
      typeof body !== "string" ||
      typeof senderEmail !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subject, body, recipients, startTime and senderEmail are required",
      });
    }

    const scheduledStart = new Date(startTime);

    if (Number.isNaN(scheduledStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startTime",
      });
    }

    const effectiveStart = effectiveCampaignStart(scheduledStart, new Date());

    const cleanRecipients = [
      ...new Set(
        recipients
          .map((email: unknown) =>
            typeof email === "string" ? email.trim().toLowerCase() : ""
          )
          .filter((email: string) => EMAIL_PATTERN.test(email))
      ),
    ];

    if (cleanRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients found",
      });
    }
    if (cleanRecipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return res.status(400).json({
        success: false,
        message: `A campaign can contain at most ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients`,
      });
    }

    if (!EMAIL_PATTERN.test(senderEmail.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid senderEmail",
      });
    }

    const campaignDelayMs = positiveInteger(delayMs, env.minDelayMs);
    const campaignHourlyLimit = positiveInteger(
      hourlyLimit,
      env.maxEmailsPerHour
    );

    if (!campaignDelayMs || !campaignHourlyLimit) {
      return res.status(400).json({
        success: false,
        message: "delayMs and hourlyLimit must be positive integers",
      });
    }

    const userId = req.user!.id;

    const { campaign, emails } = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          subject,
          body,
          startTime: effectiveStart,
          delayMs: campaignDelayMs,
          hourlyLimit: campaignHourlyLimit,
          senderEmail: senderEmail.trim().toLowerCase(),
          userId,
        },
      });

      const emails = await Promise.all(
        cleanRecipients.map((recipient, index) =>
          tx.email.create({
            data: {
              campaignId: campaign.id,
              recipient,
              subject,
              body,
              scheduledAt: new Date(
                effectiveStart.getTime() + index * campaignDelayMs
              ),
              consentStatus: "CONFIRMED",
              consentedAt: new Date(),
              consentSource: "campaign_confirmation",
            },
          })
        )
      );

      await tx.emailDispatch.createMany({
        data: emails.map((email) => ({ emailId: email.id })),
      });

      return { campaign, emails };
    });

    const dispatchResults = await Promise.allSettled(emails.map((email) => dispatchEmail(email.id)));
    const pendingDispatches = dispatchResults.filter((result) => result.status === "rejected").length;

    return res.status(201).json({
      success: true,
      message: pendingDispatches ? "Campaign saved; pending emails will be dispatched by recovery" : "Campaign scheduled successfully",
      campaignId: campaign.id,
      recipientCount: emails.length,
      pendingDispatches,
      emails,
    });
  } catch (error) {
    console.error("Schedule campaign error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to schedule email",
    });
  }
});

router.get("/scheduled", async (req, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: {
        status: "SCHEDULED",
        campaign: { userId: req.user!.id },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      include: {
        campaign: true,
      },
    });

    return res.json({
      success: true,
      emails,
    });
  } catch (error) {
    console.error("Get scheduled emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch scheduled emails",
    });
  }
});

router.get("/sent", async (req, res) => {
  try {
    // "Sent Emails" view includes both SENT and FAILED so status is visible in one table
    const emails = await prisma.email.findMany({
      where: {
        status: { in: ["SENT", "FAILED"] },
        campaign: { userId: req.user!.id },
      },
      orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }],
      include: {
        campaign: true,
      },
    });

    return res.json({
      success: true,
      emails,
    });
  } catch (error) {
    console.error("Get sent emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent emails",
    });
  }
});

router.get("/failed", async (req, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: { status: "FAILED", campaign: { userId: req.user!.id } },
      orderBy: { updatedAt: "desc" },
      include: { campaign: true },
    });

    return res.json({ success: true, emails });
  } catch (error) {
    console.error("Get failed emails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch failed emails",
    });
  }
});

router.get("/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    return res.json({
      success: true,
      emails: await searchEmails(query, req.user!.id),
    });
  } catch (error) {
    console.error("Search emails error:", error);
    return res.status(503).json({
      success: false,
      message: "Email search is temporarily unavailable",
    });
  }
});

export default router;

export const publicEmailRoutes = Router();

publicEmailRoutes.post("/unsubscribe/:token", async (req, res) => {
  const emailId = verifyUnsubscribeToken(req.params.token);
  if (!emailId) return res.status(400).json({ success: false, message: "Invalid unsubscribe link" });

  const email = await prisma.email.findUnique({ where: { id: emailId }, select: { recipient: true } });
  if (!email) return res.status(404).json({ success: false, message: "Email not found" });

  await prisma.suppressedRecipient.upsert({
    where: { email: email.recipient.toLowerCase() },
    update: { reason: "Recipient unsubscribed", source: "unsubscribe" },
    create: { email: email.recipient.toLowerCase(), reason: "Recipient unsubscribed", source: "unsubscribe" },
  });
  return res.json({ success: true, message: "Unsubscribed" });
});

publicEmailRoutes.post("/webhooks/resend", async (req, res) => {
  if (!env.resendWebhookSecret || !Buffer.isBuffer(req.rawBody)) {
    return res.status(503).json({ success: false, message: "Webhook verification is not configured" });
  }
  const eventId = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signature = req.get("svix-signature");
  if (!eventId || !timestamp || !signature) return res.status(400).json({ success: false, message: "Invalid webhook headers" });

  let event;
  try {
    const verifier = new Resend();
    event = verifier.webhooks.verify({
      payload: req.rawBody.toString("utf8"),
      headers: { id: eventId, timestamp, signature },
      webhookSecret: env.resendWebhookSecret,
    });
  } catch {
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }

  const emailId = "email_id" in event.data ? event.data.email_id : null;
  const providerEmailId = "email_id" in event.data ? event.data.email_id : "unknown";
  await prisma.$transaction(async (tx) => {
    const localEmail = emailId
      ? await tx.email.findFirst({ where: { messageId: emailId }, select: { id: true } })
      : null;
    await tx.emailProviderEvent.create({
      data: { eventId, emailId: localEmail?.id ?? null, providerEmailId, eventType: event.type },
    }).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return;
      throw error;
    });

    if (event.type === "email.bounced" || event.type === "email.complained" || event.type === "suppression.added") {
      const addresses = "to" in event.data
        ? event.data.to
        : "email" in event.data && typeof event.data.email === "string"
          ? [event.data.email]
          : [];
      for (const address of addresses) {
        await tx.suppressedRecipient.upsert({
          where: { email: address.toLowerCase() },
          update: { reason: event.type, source: "resend_webhook" },
          create: { email: address.toLowerCase(), reason: event.type, source: "resend_webhook" },
        });
      }
    }

    if (event.type === "email.bounced" || event.type === "email.failed") {
      await tx.email.updateMany({
        where: { messageId: event.data.email_id, status: { not: "FAILED" } },
        data: { status: "FAILED", error: `Resend event: ${event.type}` },
      });
    }
  });
  return res.json({ success: true });
});

export const cronEmailRoutes = Router();
cronEmailRoutes.get("/recover-email-dispatches", async (req, res) => {
  const authorization = req.get("authorization") || "";
  if (!env.cronSecret || authorization !== `Bearer ${env.cronSecret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  return res.json({ success: true, ...(await recoverPendingEmailDispatches(100)) });
});
