import { prisma } from "../config/database.js";
import { buildEmailSearchWhere } from "./email-search-query.js";

export async function searchEmails(query: string, userId: string) {
  const emails = await prisma.email.findMany({
    where: buildEmailSearchWhere(query, userId),
    orderBy: { scheduledAt: "desc" },
    take: 10,
    include: { campaign: { select: { senderEmail: true, userId: true } } },
  });

  return emails.map((email) => ({
    id: email.id,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    status: email.status,
    scheduledAt: email.scheduledAt,
    sentAt: email.sentAt,
    senderEmail: email.campaign.senderEmail,
    userId: email.campaign.userId,
  }));
}
