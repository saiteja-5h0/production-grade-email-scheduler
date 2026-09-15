import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// This module must be imported before modules that create Prisma or Redis clients.
// Resolving from the module keeps it correct for both `src/` and compiled `dist/`.
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  elasticsearchUrl:
    process.env.ELASTICSEARCH_URL ||
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:9200"),
  smtpHost: process.env.ETHEREAL_HOST,
  smtpPort: Number(process.env.ETHEREAL_PORT || 587),
  smtpUser: process.env.ETHEREAL_USER,
  smtpPassword: process.env.ETHEREAL_PASSWORD,
  smtpSecure: process.env.ETHEREAL_SECURE === "true",
  emailProvider: (process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === "production" ? "brevo" : "ethereal")) as "brevo" | "ethereal",
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  brevoSenderName: process.env.BREVO_SENDER_NAME || "Email Scheduler",
  emailFrom: process.env.EMAIL_FROM,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  minDelayMs: Number(process.env.MIN_DELAY_MS || 2000),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR || 200),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL || "http://127.0.0.1:5173",
  isProduction: process.env.NODE_ENV === "production",
};

if (env.isProduction) {
  const required = [
    ["DATABASE_URL", env.databaseUrl],
    ["REDIS_URL", env.redisUrl],
    ["CORS_ORIGIN", process.env.CORS_ORIGIN],
    ["JWT_SECRET", process.env.JWT_SECRET],
    ...(env.emailProvider === "brevo" ? [["BREVO_API_KEY", env.brevoApiKey] as const] : []),
  ] as const;
  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}
