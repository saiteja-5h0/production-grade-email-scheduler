import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

function signEmailId(emailId: string) {
  return createHmac("sha256", env.unsubscribeSecret).update(emailId).digest("base64url");
}

export function createUnsubscribeToken(emailId: string) {
  const encodedId = Buffer.from(emailId).toString("base64url");
  return `${encodedId}.${signEmailId(emailId)}`;
}

export function verifyUnsubscribeToken(token: unknown) {
  if (typeof token !== "string") return null;
  const [encodedId, signature, ...extra] = token.split(".");
  if (!encodedId || !signature || extra.length > 0) return null;

  const emailId = Buffer.from(encodedId, "base64url").toString();
  const expected = Buffer.from(signEmailId(emailId));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return emailId;
}