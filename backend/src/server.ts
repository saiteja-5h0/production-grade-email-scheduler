import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { prisma } from "./config/database.js";
import { emailQueue } from "./queues/email.queue.js";
import emailRoutes from "./routes/email.routes.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/emails", emailRoutes);

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
      message: "Database connection failed",
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});