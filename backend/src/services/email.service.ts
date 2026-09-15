import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
});

function parseSender(configuredFrom: string, fallbackName: string) {
  const match = configuredFrom.match(/^(.*?)\s*<([^>]+)>$/);
  const email = match?.[2]?.trim() || configuredFrom;
  const name = match?.[1]?.trim() || fallbackName;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return null;
  }

  return { email, name };
}

async function brevoSender() {
  const explicitSender = env.brevoSenderEmail?.trim();
  if (explicitSender) {
    const sender = parseSender(explicitSender, env.brevoSenderName);
    if (sender) return sender;
  }

  const legacySender = env.emailFrom?.trim();
  if (legacySender && !legacySender.includes(".local")) {
    const sender = parseSender(legacySender, env.brevoSenderName);
    if (sender) return sender;
  }

  const response = await fetch("https://api.brevo.com/v3/senders?limit=50&offset=0", {
    headers: { accept: "application/json", "api-key": env.brevoApiKey || "" },
  });
  const result = (await response.json().catch(() => null)) as {
    senders?: Array<{ email?: string; active?: boolean }>;
    message?: string;
  } | null;
  const activeSender = result?.senders?.find((sender) => sender.active && sender.email);

  if (activeSender?.email) {
    return { email: activeSender.email, name: env.brevoSenderName };
  }

  throw new Error(result?.message || "No active Brevo sender is configured");
}

export async function sendEmail({
  from,
  to,
  subject,
  body,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  if (env.emailProvider === "brevo") {
    if (!env.brevoApiKey) {
      throw new Error("Brevo email configuration is missing: set BREVO_API_KEY");
    }

    const sender = await brevoSender();

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        textContent: body,
      }),
    });

    const result = (await response.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
      code?: string;
    } | null;

    if (!response.ok || !result?.messageId) {
      throw new Error(result?.message ? `Brevo: ${result.message}` : `Brevo request failed (${response.status}${result?.code ? `, ${result.code}` : ""})`);
    }

    return {
      messageId: result.messageId,
      previewUrl: undefined,
    };
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPassword) {
    throw new Error("Ethereal SMTP credentials are not configured");
  }

  const info = await transporter.sendMail({
    from: from || env.emailFrom,
    to,
    subject,
    text: body,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
