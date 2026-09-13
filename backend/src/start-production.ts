import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = dirname(fileURLToPath(import.meta.url));
const children: ChildProcess[] = [
  spawn(process.execPath, [resolve(distDirectory, "server.js")], {
    env: process.env,
    stdio: "inherit",
  }),
  spawn(process.execPath, [resolve(distDirectory, "workers/email.worker.js")], {
    env: process.env,
    stdio: "inherit",
  }),
];

let shuttingDown = false;
let exitCode = 0;

const stopChildren = (signal: NodeJS.Signals) => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
};

const shutdown = (code: number, signal?: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  exitCode = code;
  stopChildren(signal ?? "SIGTERM");
};

for (const child of children) {
  child.once("error", (error) => {
    console.error("Production child process failed to start:", error);
    shutdown(1);
  });

  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      shutdown(code ?? 1, signal ?? undefined);
    }
  });
}

process.once("SIGINT", () => shutdown(0, "SIGINT"));
process.once("SIGTERM", () => shutdown(0, "SIGTERM"));
process.once("beforeExit", () => {
  process.exitCode = exitCode;
});