import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "vercel",
  modules: ["workflow/nitro"],
  vercel: {
    entryFormat: "node",
    config: {
      crons: [{ path: "/api/cron/recover-email-dispatches", schedule: "0 3 * * *" }],
    },
  },
  routes: {
    "/**": { handler: "./src/server.ts", format: "node" },
  },
});