import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "./config/env.js";
import { env } from "./config/env.js";
import { emailQueue } from "./queues/email.queue.js";
import emailRoutes from "./routes/email.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { attachUser } from "./middleware/auth.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(attachUser);

const queueDashboard = new ExpressAdapter();
queueDashboard.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: queueDashboard,
});
app.use("/admin/queues", queueDashboard.getRouter());
app.use("/api/emails", emailRoutes);
app.use("/api/auth", authRoutes);

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
