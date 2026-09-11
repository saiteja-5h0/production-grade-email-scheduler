ALTER TABLE "public"."Campaign" ADD COLUMN "senderEmail" TEXT;

UPDATE "public"."Campaign"
SET "senderEmail" = 'no-reply@reachinbox.local'
WHERE "senderEmail" IS NULL;

ALTER TABLE "public"."Campaign"
ALTER COLUMN "senderEmail" SET NOT NULL;
