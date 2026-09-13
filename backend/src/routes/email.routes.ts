import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { emailQueue } from "../queues/email.queue.js";
import { searchEmails } from "../services/email-search.service.js";

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_USER_EMAIL = "demo@reachinbox.local";

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
    } = req.body;

    if (
      !subject ||
      !body ||
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !startTime ||
      !senderEmail ||
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

    if (scheduledStart.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "startTime must be in the future",
      });
    }

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

    const { campaign, emails } = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          subject,
          body,
          startTime: scheduledStart,
          delayMs: campaignDelayMs,
          hourlyLimit: campaignHourlyLimit,
          senderEmail: senderEmail.trim().toLowerCase(),
          user: {
            connectOrCreate: {
              where: { email: DEMO_USER_EMAIL },
              create: {
                id: "demo-user",
                name: "Demo User",
                email: DEMO_USER_EMAIL,
              },
            },
          },
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
                scheduledStart.getTime() + index * campaignDelayMs
              ),
            },
          })
        )
      );

      return { campaign, emails };
    });

    try {
      await emailQueue.addBulk(
        emails.map((email) => ({
          name: "send-email",
          data: { emailId: email.id },
          opts: {
            jobId: email.id,
            delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
            attempts: 3,
            backoff: { type: "exponential" as const, delay: 1000 },
          },
        }))
      );
    } catch (queueError) {
      await Promise.allSettled(
        emails.map((email) => emailQueue.remove(email.id))
      );
      await prisma.campaign.delete({ where: { id: campaign.id } });
      throw queueError;
    }

    return res.status(201).json({
      success: true,
      message: "Campaign scheduled successfully",
      campaignId: campaign.id,
      recipientCount: emails.length,
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

router.get("/scheduled", async (_req, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: {
        status: "SCHEDULED",
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

router.get("/sent", async (_req, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: {
        status: "SENT",
      },
      orderBy: {
        sentAt: "desc",
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
    console.error("Get sent emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent emails",
    });
  }
});

router.get("/failed", async (_req, res) => {
  try {
    const emails = await prisma.email.findMany({
      where: { status: "FAILED" },
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
    return res.json({ success: true, emails: await searchEmails(query) });
  } catch (error) {
    console.error("Search emails error:", error);
    return res.status(503).json({
      success: false,
      message: "Email search is temporarily unavailable",
    });
  }
});

export default router;
