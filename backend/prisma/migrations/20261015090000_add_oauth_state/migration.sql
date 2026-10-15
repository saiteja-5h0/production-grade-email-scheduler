CREATE TYPE "public"."OAuthProvider" AS ENUM ('GOOGLE', 'SLACK');

CREATE TABLE "public"."OAuthState" (
    "stateHash" TEXT NOT NULL,
    "provider" "public"."OAuthProvider" NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("stateHash")
);

CREATE INDEX "OAuthState_expiresAt_idx" ON "public"."OAuthState"("expiresAt");

ALTER TABLE "public"."OAuthState"
ADD CONSTRAINT "OAuthState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;