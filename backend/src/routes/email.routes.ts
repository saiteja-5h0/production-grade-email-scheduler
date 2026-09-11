import { Router } from "express";
import { prisma } from "../config/database.js";
import { emailQueue } from "../queues/email.queue.js";

const router = Router();

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
      !senderEmail
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
          .filter((email: string) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          )
      ),
    ];

    if (cleanRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients found",
      });
    }

    const campaignDelayMs =
      Number(delayMs) || Number(process.env.MIN_DELAY_MS) || 2000;

    const campaignHourlyLimit =
      Number(hourlyLimit) || Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

    const campaign = await prisma.campaign.create({
      data: {
        userId: "demo-user",
        subject,
        body,
        startTime: scheduledStart,
        delayMs: campaignDelayMs,
        hourlyLimit: campaignHourlyLimit,
        senderEmail,
      },
    });

    const emails = [];

    for (let index = 0; index < cleanRecipients.length; index += 1) {
      const scheduledAt = new Date(
        scheduledStart.getTime() + index * campaignDelayMs
      );

      const email = await prisma.email.create({
        data: {
          campaignId: campaign.id,
          recipient: cleanRecipients[index],
          subject,
          body,
          scheduledAt,
        },
      });

      emails.push(email);
    }

    for (const email of emails) {
      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());

      await emailQueue.add(
        "send-email",
        { emailId: email.id },
        { jobId: email.id, delay, attempts: 3 }
      );
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

export default router;