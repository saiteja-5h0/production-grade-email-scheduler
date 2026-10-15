import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// This module must be imported before modules that create clients.
// Resolving from the module keeps it correct for both `src/` and compiled `dist/`.
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters in production");
}
const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;
if (process.env.NODE_ENV === "production" && (!unsubscribeSecret || unsubscribeSecret.length < 32)) {
  throw new Error("UNSUBSCRIBE_SECRET must be configured with at least 32 characters in production");
}

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN,
  minDelayMs: Number(process.env.MIN_DELAY_MS || 2000),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR || 200),
  jwtSecret: jwtSecret || "dev-insecure-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL || "http://127.0.0.1:5173",
  isProduction: process.env.NODE_ENV === "production",
  emailProvider: process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === "production" ? "resend" : "ethereal"),
  emailFrom: process.env.EMAIL_FROM,
  resendApiKey: process.env.RESEND_API_KEY,
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  resendDailyLimit: Number(process.env.RESEND_DAILY_LIMIT || 100),
  unsubscribeSecret: unsubscribeSecret || "local-only-unsubscribe-secret",
  publicApiUrl: process.env.PUBLIC_API_URL || "http://localhost:4000",
  cronSecret: process.env.CRON_SECRET,
};
