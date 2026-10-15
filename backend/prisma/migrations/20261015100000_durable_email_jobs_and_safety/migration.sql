CREATE TYPE "public"."EmailDispatchState" AS ENUM ('PENDING', 'CLAIMED', 'DISPATCHED');
CREATE TYPE "public"."RecipientConsent" AS ENUM ('UNKNOWN', 'CONFIRMED');

ALTER TABLE "public"."Email"
ADD COLUMN "consentStatus" "public"."RecipientConsent" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "consentedAt" TIMESTAMP(3),
ADD COLUMN "consentSource" TEXT,
ADD COLUMN "processingToken" TEXT,
ADD COLUMN "processingLeaseUntil" TIMESTAMP(3);

CREATE INDEX "Email_status_processingLeaseUntil_idx"
ON "public"."Email"("status", "processingLeaseUntil");

CREATE TABLE "public"."EmailDispatch" (
    "emailId" TEXT NOT NULL,
    "state" "public"."EmailDispatchState" NOT NULL DEFAULT 'PENDING',
    "runId" TEXT,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailDispatch_pkey" PRIMARY KEY ("emailId")
);

CREATE INDEX "EmailDispatch_state_claimedAt_idx"
ON "public"."EmailDispatch"("state", "claimedAt");

ALTER TABLE "public"."EmailDispatch"
ADD CONSTRAINT "EmailDispatch_emailId_fkey"
FOREIGN KEY ("emailId") REFERENCES "public"."Email"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."SenderThrottle" (
    "senderEmail" TEXT NOT NULL,
    "hourWindowStart" TIMESTAMP(3) NOT NULL,
    "hourlyCount" INTEGER NOT NULL DEFAULT 0,
    "nextAllowedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SenderThrottle_pkey" PRIMARY KEY ("senderEmail")
);

CREATE TABLE "public"."ProviderRateThrottle" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderRateThrottle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."RateLimitNotification" (
    "senderEmail" TEXT NOT NULL,
    "hourWindowStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateLimitNotification_pkey" PRIMARY KEY ("senderEmail", "hourWindowStart")
);

CREATE TABLE "public"."SuppressedRecipient" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuppressedRecipient_pkey" PRIMARY KEY ("email")
);

CREATE TABLE "public"."EmailProviderEvent" (
    "eventId" TEXT NOT NULL,
    "emailId" TEXT,
    "providerEmailId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailProviderEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "EmailProviderEvent_providerEmailId_idx"
ON "public"."EmailProviderEvent"("providerEmailId");

ALTER TABLE "public"."EmailProviderEvent"
ADD CONSTRAINT "EmailProviderEvent_emailId_fkey"
FOREIGN KEY ("emailId") REFERENCES "public"."Email"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."EmailDispatch" ("emailId", "state", "updatedAt")
SELECT "id", 'PENDING', CURRENT_TIMESTAMP
FROM "public"."Email"
WHERE "status" = 'SCHEDULED'
ON CONFLICT ("emailId") DO NOTHING;