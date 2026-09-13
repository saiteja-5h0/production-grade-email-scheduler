import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// This module must be imported before modules that create Prisma or Redis clients.
// Resolving from the module keeps it correct for both `src/` and compiled `dist/`.
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN,
  minDelayMs: Number(process.env.MIN_DELAY_MS || 2000),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR || 200),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL || "http://127.0.0.1:5173",
  isProduction: process.env.NODE_ENV === "production",
};
