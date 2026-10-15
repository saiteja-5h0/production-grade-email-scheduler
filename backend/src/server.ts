import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "./config/env.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import emailRoutes, { cronEmailRoutes, publicEmailRoutes } from "./routes/email.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { attachUser } from "./middleware/auth.js";

const app = express();
const allowedOrigins = new Set(
  [...(env.corsOrigin || "").split(","), env.frontendUrl]
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin)
);

app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: "Origin not allowed" });
  }
  return next();
});

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
  })
);
app.use(express.json({
  verify: (req, _res, body) => {
    (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(body);
  },
}));
app.use(cookieParser());
app.use(attachUser);

app.use("/api/emails", publicEmailRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cron", cronEmailRoutes);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "ReachInbox Email Scheduler API is running",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database is unavailable",
    });
  }
});

export default app;
