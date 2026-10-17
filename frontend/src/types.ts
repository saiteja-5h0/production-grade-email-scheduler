export type Email = {
  id: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  updatedAt?: string;
  status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  error?: string | null;
  dispatch?: {
    state: "PENDING" | "CLAIMED" | "DISPATCHED";
    attempts: number;
    lastError: string | null;
  } | null;
  campaign: { senderEmail: string };
};
