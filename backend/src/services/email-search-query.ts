import type { Prisma } from "@prisma/client";

const EMAIL_STATUSES = new Set(["SCHEDULED", "PROCESSING", "SENT", "FAILED"]);

export function buildEmailSearchWhere(query: string, userId: string): Prisma.EmailWhereInput {
  const term = query.trim();
  const normalizedStatus = term.toUpperCase();

  return {
    campaign: { userId },
    ...(term
      ? {
          OR: [
            { recipient: { contains: term, mode: "insensitive" as const } },
            { subject: { contains: term, mode: "insensitive" as const } },
            { body: { contains: term, mode: "insensitive" as const } },
            { campaign: { senderEmail: { contains: term, mode: "insensitive" as const } } },
            ...(EMAIL_STATUSES.has(normalizedStatus)
              ? [{ status: normalizedStatus as "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" }]
              : []),
          ],
        }
      : {}),
  };
}