import { start } from "workflow/api";
import { prisma } from "../config/database.js";
import { claimDispatch, listRecoverableDispatches, recordWorkflowStarted, releaseDispatchClaim } from "./email-job.service.js";
import { sendScheduledEmail } from "../workflows/send-email.workflow.js";

export async function dispatchEmail(emailId: string) {
  const claim = await claimDispatch(emailId);
  if (!claim) {
    const existing = await prisma.emailDispatch.findUnique({ where: { emailId } });
    return { dispatched: false, runId: existing?.runId ?? null };
  }

  try {
    const run = await start(sendScheduledEmail, [emailId]);
    const recorded = await recordWorkflowStarted(claim, run.runId);
    if (recorded.count !== 1) throw new Error("Workflow dispatch lease was lost");
    return { dispatched: true, runId: run.runId };
  } catch (error) {
    await releaseDispatchClaim(claim, error);
    throw error;
  }
}

export async function recoverPendingEmailDispatches(limit = 100) {
  const pending = await listRecoverableDispatches(limit);
  let dispatched = 0;
  let failed = 0;
  for (const { emailId } of pending) {
    try {
      if ((await dispatchEmail(emailId)).dispatched) dispatched += 1;
    } catch {
      failed += 1;
    }
  }
  return { examined: pending.length, dispatched, failed };
}