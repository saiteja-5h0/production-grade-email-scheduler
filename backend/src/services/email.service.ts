import nodemailer from "nodemailer";
import { Resend } from "resend";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { deliveryBlockReason } from "./email-job-policy.js";

export type EmailDeliveryInput = {
  emailId: string;
  consentConfirmed: boolean;
  from: string;
  to: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
};

export type EmailDeliveryResult = {
  messageId: string;
  previewUrl: string | null;
};

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

export function isRetryableResendError(statusCode: number | null, name: string) {
  return (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    (statusCode !== null && statusCode >= 500) ||
    name === "concurrent_idempotent_requests" ||
    name === "rate_limit_exceeded"
  );
}

function getRetryAfterMs(value: string | undefined) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

async function sendWithResend(message: EmailDeliveryInput): Promise<EmailDeliveryResult> {
  if (!env.resendApiKey) {
    throw new EmailProviderError("Resend API key is not configured", false, "missing_api_key");
  }
  if (!env.emailFrom) {
    throw new EmailProviderError("EMAIL_FROM is not configured", false, "missing_from_address");
  }

  const resend = new Resend(env.resendApiKey);
  try {
    const response = await resend.emails.send(
      {
        from: env.emailFrom,
        to: message.to,
        replyTo: message.from,
        subject: message.subject,
        text: `${message.body}\n\nTo unsubscribe: ${message.unsubscribeUrl}`,
        headers: {
          "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
      {
        idempotencyKey: `scheduled-email/${message.emailId}`,
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (response.error) {
      throw new EmailProviderError(
        response.error.message,
        isRetryableResendError(response.error.statusCode, response.error.name),
        response.error.name,
        getRetryAfterMs(response.headers?.["retry-after"])
      );
    }

    return { messageId: response.data.id, previewUrl: null };
  } catch (error) {
    if (error instanceof EmailProviderError) throw error;
    throw new EmailProviderError(
      error instanceof Error ? error.message : "Resend network request failed",
      true,
      "network_error"
    );
  }
}

async function sendWithEthereal(message: EmailDeliveryInput): Promise<EmailDeliveryResult> {
  if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASSWORD) {
    throw new EmailProviderError("Ethereal SMTP credentials are not configured", false, "missing_test_credentials");
  }

  const port = Number(process.env.ETHEREAL_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.ETHEREAL_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.ETHEREAL_USER, pass: process.env.ETHEREAL_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await transporter.sendMail({
      from: message.from || env.emailFrom,
      to: message.to,
      subject: message.subject,
      text: `${message.body}\n\nTo unsubscribe: ${message.unsubscribeUrl}`,
      headers: {
        "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || null };
  } catch (error) {
    const responseCode = (error as { responseCode?: number }).responseCode;
    const retryable = responseCode === undefined || (responseCode >= 400 && responseCode < 500);
    throw new EmailProviderError(
      error instanceof Error ? error.message : "Ethereal SMTP request failed",
      retryable,
      responseCode ? `smtp_${responseCode}` : "smtp_network_error"
    );
  } finally {
    transporter.close();
  }
}

export async function sendEmail(message: EmailDeliveryInput): Promise<EmailDeliveryResult> {
  const baseBlock = deliveryBlockReason({
    testMode: process.env.NODE_ENV === "test",
    consentConfirmed: message.consentConfirmed,
    suppressed: false,
    provider: env.emailProvider,
    production: env.isProduction,
  });
  if (baseBlock) throw new EmailProviderError(baseBlock, false, baseBlock);
  const suppressed = await prisma.suppressedRecipient.findUnique({ where: { email: message.to.toLowerCase() } });
  const suppressionBlock = deliveryBlockReason({
    testMode: false,
    consentConfirmed: true,
    suppressed: Boolean(suppressed),
    provider: env.emailProvider,
    production: env.isProduction,
  });
  if (suppressionBlock) throw new EmailProviderError(suppressionBlock, false, suppressionBlock);

  if (env.emailProvider === "resend") return sendWithResend(message);
  if (env.emailProvider === "ethereal" && !env.isProduction) return sendWithEthereal(message);
  throw new EmailProviderError("Unsupported or unsafe email provider configuration", false, "provider_not_allowed");
}
