import assert from "node:assert/strict";
import test from "node:test";
import { hasAuthenticatedSession } from "../src/middleware/access-control.js";
import { buildEmailSearchWhere } from "../src/services/email-search-query.js";
import { canClaimEmail, deliveryBlockReason, effectiveCampaignStart, emailWorkflowHookToken, getCapacityBlock, isDispatchReclaimable, retryDelay, simulatedDeliveryShouldFail } from "../src/services/email-job-policy.js";
import { isRetryableResendError, sendEmail } from "../src/services/email.service.js";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "../src/services/unsubscribe.service.js";

test("protected requests require a valid session and attached user", () => {
  assert.equal(hasAuthenticatedSession({}), false);
  assert.equal(hasAuthenticatedSession({ isAuthenticated: false, user: { id: "user-1" } }), false);
  assert.equal(hasAuthenticatedSession({ isAuthenticated: true }), false);
  assert.equal(hasAuthenticatedSession({ isAuthenticated: true, user: { id: "user-1" } }), true);
});

test("email search scopes all matching conditions to the authenticated owner", () => {
  const where = buildEmailSearchWhere("invoice", "user-1");
  assert.deepEqual(where.campaign, { userId: "user-1" });
  assert.deepEqual(where.OR, [
    { recipient: { contains: "invoice", mode: "insensitive" } },
    { subject: { contains: "invoice", mode: "insensitive" } },
    { body: { contains: "invoice", mode: "insensitive" } },
    { campaign: { senderEmail: { contains: "invoice", mode: "insensitive" } } },
  ]);
});

test("empty email searches remain owner-scoped", () => {
  assert.deepEqual(buildEmailSearchWhere("", "user-2"), { campaign: { userId: "user-2" } });
});

test("email search matches addresses, subjects and body with literal parameter values", () => {
  const where = buildEmailSearchWhere("alice@example.test", "user-3");
  assert.deepEqual(where.OR, [
    { recipient: { contains: "alice@example.test", mode: "insensitive" } },
    { subject: { contains: "alice@example.test", mode: "insensitive" } },
    { body: { contains: "alice@example.test", mode: "insensitive" } },
    { campaign: { senderEmail: { contains: "alice@example.test", mode: "insensitive" } } },
  ]);
  assert.deepEqual(buildEmailSearchWhere("%_'; DROP TABLE Email;--", "user-3").OR?.[0], {
    recipient: { contains: "%_'; DROP TABLE Email;--", mode: "insensitive" },
  });
});

test("email status search matches known statuses", () => {
  const where = buildEmailSearchWhere("failed", "user-4");
  assert.deepEqual(where.OR?.at(-1), { status: "FAILED" });
});

test("dispatch leases can be reclaimed only after expiry", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  assert.equal(isDispatchReclaimable("PENDING", null, now, 60_000), true);
  assert.equal(isDispatchReclaimable("CLAIMED", new Date(now.getTime() - 60_001), now, 60_000), true);
  assert.equal(isDispatchReclaimable("CLAIMED", new Date(now.getTime() - 59_999), now, 60_000), false);
  assert.equal(isDispatchReclaimable("DISPATCHED", null, now, 60_000), false);
});

test("email claim is owned by one lease token and finished email statuses cannot be claimed", () => {
  const now = new Date();
  assert.equal(canClaimEmail("SCHEDULED", null, null, "step-1", now), true);
  assert.equal(canClaimEmail("PROCESSING", "step-1", new Date(now.getTime() + 60_000), "step-1", now), true);
  assert.equal(canClaimEmail("PROCESSING", "step-1", new Date(now.getTime() + 60_000), "step-2", now), false);
  assert.equal(canClaimEmail("SENT", null, null, "step-1", now), false);
});

test("workflow token and retry delay are stable and bounded", () => {
  assert.equal(emailWorkflowHookToken("email-123"), "scheduled-email:email-123");
  assert.equal(retryDelay(1), 1000);
  assert.equal(retryDelay(3), 4000);
  assert.equal(retryDelay(99), 60_000);
});

test("simulated delivery failure uses a random 20 percent threshold", () => {
  assert.equal(simulatedDeliveryShouldFail(() => 0), true);
  assert.equal(simulatedDeliveryShouldFail(() => 0.1999), true);
  assert.equal(simulatedDeliveryShouldFail(() => 0.2), false);
  assert.equal(simulatedDeliveryShouldFail(() => 0.9999), false);
});

test("campaign scheduling supports immediate and future requested starts", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");
  assert.equal(effectiveCampaignStart(now, now).getTime(), now.getTime() + 1000);
  const future = new Date(now.getTime() + 60_000);
  assert.equal(effectiveCampaignStart(future, now).getTime(), future.getTime());
});

test("sender and provider reservations respect hourly, delay, second and daily limits", () => {
  const now = new Date("2026-10-15T12:30:00.000Z");
  const hourWindowStart = new Date("2026-10-15T12:00:00.000Z");
  const dailyWindowStart = new Date("2026-10-15T00:00:00.000Z");
  const input = {
    now,
    hourWindowStart,
    hourlyCount: 0,
    hourlyLimit: 5,
    nextAllowedAt: null,
    providerCount: 0,
    providerLimit: 8,
    dailyWindowStart,
    dailyCount: 0,
    dailyLimit: 100,
    enforceDailyLimit: true,
  };
  assert.equal(getCapacityBlock(input), null);
  assert.equal(getCapacityBlock({ ...input, hourlyCount: 5 })?.reason, "hourly");
  assert.equal(getCapacityBlock({ ...input, nextAllowedAt: new Date(now.getTime() + 1000) })?.reason, "delay");
  assert.equal(getCapacityBlock({ ...input, providerCount: 8 })?.reason, "provider");
  assert.equal(getCapacityBlock({ ...input, dailyCount: 100 })?.reason, "daily");
});

test("delivery policy requires consent and blocks suppressed recipients or unsafe providers", () => {
  const config = { testMode: false, consentConfirmed: true, suppressed: false, provider: "resend", production: true };
  assert.equal(deliveryBlockReason(config), null);
  assert.equal(deliveryBlockReason({ ...config, consentConfirmed: false }), "consent_required");
  assert.equal(deliveryBlockReason({ ...config, suppressed: true }), "recipient_suppressed");
  assert.equal(deliveryBlockReason({ ...config, provider: "ethereal" }), "provider_not_allowed");
  assert.equal(deliveryBlockReason({ ...config, testMode: true }), "test_mode_blocked");
});

test("Resend retry classification distinguishes transient and permanent errors", () => {
  assert.equal(isRetryableResendError(429, "rate_limit_exceeded"), true);
  assert.equal(isRetryableResendError(503, "internal_server_error"), true);
  assert.equal(isRetryableResendError(400, "validation_error"), false);
});

test("unsubscribe tokens validate tampering", () => {
  const token = createUnsubscribeToken("email-123");
  assert.equal(verifyUnsubscribeToken(token), "email-123");
  assert.equal(verifyUnsubscribeToken(`${token}x`), null);
});

test("test mode blocks email delivery before provider or database access", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    await assert.rejects(
      sendEmail({ emailId: "test-email", consentConfirmed: true, from: "sender@example.test", to: "recipient@example.test", subject: "Test", body: "No delivery", unsubscribeUrl: "https://example.test/unsubscribe" }),
      /test_mode_blocked/
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});