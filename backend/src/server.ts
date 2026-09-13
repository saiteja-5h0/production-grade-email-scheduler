import express from "express";
import cors from "cors";
import "./config/env.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { redis } from "./config/redis.js";
import { emailQueue } from "./queues/email.queue.js";
import emailRoutes from "./routes/email.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin ? env.corsOrigin.split(",") : true,
  })
);
app.use(express.json());

const queueDashboard = new ExpressAdapter();
queueDashboard.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: queueDashboard,
});
app.use("/admin/queues", queueDashboard.getRouter());
app.use("/api/emails", emailRoutes);
app.use("/api/auth", authRoutes);

app.get("/health", async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);

    res.json({
      success: true,
      message: "ReachInbox Email Scheduler API is running",
      database: "connected",
      redis: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Service dependencies are unavailable",
    });
  }
});

app.post("/test/schedule", async (_req, res) => {
  try {
    const job = await emailQueue.add(
      "test-email",
      {
        message: "Hello from BullMQ",
      },
      {
        delay: 10000,
      }
    );

    res.json({
      success: true,
      message: "Job scheduled",
      jobId: job.id,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to schedule job",
    });
  }
});

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
