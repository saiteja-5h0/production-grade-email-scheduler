export type Email = {
  id: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  error?: string | null;
  campaign: { senderEmail: string };
};
