import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
});

function brevoSender() {
  const configuredFrom = env.brevoSenderEmail?.trim() || env.emailFrom?.trim() || "";
  const match = configuredFrom.match(/^(.*?)\s*<([^>]+)>$/);
  const email = match?.[2]?.trim() || configuredFrom;
  const name = match?.[1]?.trim() || env.brevoSenderName;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("EMAIL_FROM must contain a valid Brevo-verified sender email");
  }

  return { email, name };
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
    if (!env.brevoApiKey || (!env.brevoSenderEmail && !env.emailFrom)) {
      throw new Error("Brevo email configuration is missing: set BREVO_API_KEY and BREVO_SENDER_EMAIL");
    }

    const sender = brevoSender();

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
