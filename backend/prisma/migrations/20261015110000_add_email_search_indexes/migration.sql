CREATE INDEX "Campaign_userId_idx" ON "public"."Campaign"("userId");

CREATE INDEX "Email_campaignId_scheduledAt_idx"
ON "public"."Email"("campaignId", "scheduledAt");