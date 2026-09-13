import nodemailer from "nodemailer";
import "../config/env.js";

const transporter = nodemailer.createTransport({
  host: process.env.ETHEREAL_HOST,
  port: Number(process.env.ETHEREAL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASSWORD,
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
  if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASSWORD) {
    throw new Error("Ethereal SMTP credentials are not configured");
  }

  const info = await transporter.sendMail({
    from: from || process.env.EMAIL_FROM,
    to,
    subject,
    text: body,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
