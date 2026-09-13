import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPassword,
  },
});

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
  if (env.isProduction) {
    if (!env.brevoApiKey || !env.emailFrom) {
      throw new Error("Brevo email configuration is missing");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: env.emailFrom },
        to: [{ email: to }],
        subject,
        textContent: body,
      }),
    });

    const result = (await response.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
    } | null;

    if (!response.ok || !result?.messageId) {
      throw new Error(result?.message || `Brevo request failed (${response.status})`);
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
