import "../config/env.js";
import { env } from "../config/env.js";

import { DelayedError, Worker } from "bullmq";
import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";
import { checkHourlyLimit } from "../services/rate-limit.service.js";
import { checkSendDelay } from "../services/send-delay.service.js";
import { sendEmail } from "../services/email.service.js";
import { indexEmail } from "../services/email-search.service.js";

const concurrency = env.workerConcurrency;

const worker = new Worker(
  "email-queue",
  async (job) => {
    const { emailId } = job.data as { emailId?: string };

    if (!emailId) {
      throw new Error("emailId is required");
    }

    console.log(`Processing email ${emailId}`);

    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { campaign: true },
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    if (email.status === "SENT") {
      console.log(`Email ${emailId} already sent. Skipping.`);
      return;
    }

    const rateLimit = await checkHourlyLimit(
      email.campaign.senderEmail,
      email.campaign.hourlyLimit
    );

    if (!rateLimit.allowed && rateLimit.retryAt) {
      console.log(
        `Hourly rate limit reached for ${email.campaign.senderEmail}`
      );
      console.log(
        `Rescheduling email ${emailId} for ${new Date(
          rateLimit.retryAt
        ).toISOString()}`
      );

      await job.moveToDelayed(rateLimit.retryAt, job.token);
      throw new DelayedError();
    }

    const sendDelay = await checkSendDelay(
      email.campaign.senderEmail,
      email.campaign.delayMs
    );

    if (!sendDelay.allowed && sendDelay.retryAt) {
      console.log(
        `Minimum delay active for ${email.campaign.senderEmail}`
      );

      await job.moveToDelayed(sendDelay.retryAt, job.token);
      throw new DelayedError();
    }

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "PROCESSING", error: null },
    });

    try {
      const result = await sendEmail({
        from: email.campaign.senderEmail,
        to: email.recipient,
        subject: email.subject,
        body: email.body,
      });

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          messageId: result.messageId,
          previewUrl: result.previewUrl || null,
        },
      });

      await indexEmail({
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: "SENT",
        scheduledAt: email.scheduledAt,
        sentAt: new Date(),
        senderEmail: email.campaign.senderEmail,
      }).catch((indexError) =>
        console.error("Failed to index sent email:", indexError)
      );

      console.log(`Email sent to ${email.recipient}`);

      if (result.previewUrl) {
        console.log(`Preview: ${result.previewUrl}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown email error";

      await prisma.email.update({
        where: { id: emailId },
        data: { status: "FAILED", error: message },
      });

      await indexEmail({
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: "FAILED",
        scheduledAt: email.scheduledAt,
        sentAt: null,
        senderEmail: email.campaign.senderEmail,
      }).catch((indexError) => console.error("Failed to index email:", indexError));

      throw error;
    }
  },
  {
    connection: redis,
    concurrency,
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

console.log(`Email worker started with concurrency ${concurrency}`);
