export type DispatchState = "PENDING" | "CLAIMED" | "DISPATCHED";

export function isDispatchReclaimable(state: DispatchState, claimedAt: Date | null, now: Date, leaseMs: number) {
  return state === "PENDING" || (state === "CLAIMED" && (!claimedAt || claimedAt.getTime() < now.getTime() - leaseMs));
}

export function canClaimEmail(status: string, processingToken: string | null, leaseUntil: Date | null, token: string, now: Date) {
  if (status !== "SCHEDULED" && status !== "PROCESSING") return false;
  return processingToken === token || leaseUntil === null || leaseUntil < now;
}

export function emailWorkflowHookToken(emailId: string) {
  return `scheduled-email:${emailId}`;
}

export function retryDelay(attempt: number) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

export function effectiveCampaignStart(requestedAt: Date, now: Date) {
  return new Date(Math.max(requestedAt.getTime(), now.getTime() + 1000));
}

export type CapacityDecisionInput = {
  now: Date;
  hourWindowStart: Date;
  hourlyCount: number;
  hourlyLimit: number;
  nextAllowedAt: Date | null;
  providerCount: number;
  providerLimit: number;
  dailyWindowStart: Date;
  dailyCount: number;
  dailyLimit: number;
  enforceDailyLimit: boolean;
};

export function getCapacityBlock(input: CapacityDecisionInput) {
  const providerWindow = new Date(Math.floor(input.now.getTime() / 1000) * 1000);
  if (input.providerCount >= input.providerLimit) {
    return { reason: "provider" as const, retryAt: new Date(providerWindow.getTime() + 1000) };
  }
  if (input.enforceDailyLimit && input.dailyCount >= input.dailyLimit) {
    return { reason: "daily" as const, retryAt: new Date(input.dailyWindowStart.getTime() + 24 * 60 * 60_000) };
  }
  if (input.hourlyCount >= input.hourlyLimit) {
    return { reason: "hourly" as const, retryAt: new Date(input.hourWindowStart.getTime() + 60 * 60_000) };
  }
  if (input.nextAllowedAt && input.nextAllowedAt > input.now) {
    return { reason: "delay" as const, retryAt: input.nextAllowedAt };
  }
  return null;
}

export function deliveryBlockReason(input: {
  testMode: boolean;
  consentConfirmed: boolean;
  suppressed: boolean;
  provider: string;
  production: boolean;
}) {
  if (input.testMode) return "test_mode_blocked";
  if (!input.consentConfirmed) return "consent_required";
  if (input.suppressed) return "recipient_suppressed";
  if (input.provider !== "resend" && (input.production || input.provider !== "ethereal")) return "provider_not_allowed";
  return null;
}