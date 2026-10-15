import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../config/database.js";

const STATE_TTL_MS = 10 * 60_000;
type OAuthProvider = "GOOGLE" | "SLACK";

function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createOAuthState(provider: OAuthProvider, userId?: string) {
  const state = randomBytes(32).toString("hex");
  const now = new Date();

  await prisma.oAuthState.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.oAuthState.create({
    data: {
      stateHash: hashState(state),
      provider,
      userId,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    },
  });

  return state;
}

export async function consumeOAuthState(state: unknown, provider: OAuthProvider) {
  if (typeof state !== "string") return null;

  const stateHash = hashState(state);
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const record = await transaction.oAuthState.findUnique({ where: { stateHash } });
    if (!record || record.provider !== provider || record.expiresAt <= now) return null;

    const consumed = await transaction.oAuthState.deleteMany({
      where: { stateHash, provider, expiresAt: { gt: now } },
    });
    return consumed.count === 1 ? { userId: record.userId } : null;
  });
}