import type { Email } from "../types";

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleString() : "—";
}

const statusStyles: Record<Email["status"], string> = {
  SCHEDULED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  SENT: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

type Props = {
  emails: Email[];
  mode: "scheduled" | "sent" | "failed";
  loading: boolean;
  error: string;
};

export function EmailTable({ emails, mode, loading, error }: Props) {
  if (error) {
    return <div className="p-6 text-sm text-red-700">Could not load emails: {error}</div>;
  }

  if (loading) {
    return (
      <div className="animate-pulse divide-y divide-slate-100">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="grid gap-2 p-5 md:grid-cols-4">
            <div className="h-4 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="h-4 w-1/3 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500">
        No {mode === "scheduled" ? "scheduled" : mode === "sent" ? "sent" : "failed"} emails yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {emails.map((email) => (
        <div key={email.id} className="grid gap-2 p-5 md:grid-cols-4 md:items-center">
          <div>
            <p className="font-medium text-slate-900">{email.subject}</p>
            <p className="text-sm text-slate-500">{email.recipient}</p>
          </div>
          <p className="text-sm text-slate-600">From: {email.campaign.senderEmail}</p>
          <p className="text-sm text-slate-600">
            {mode === "scheduled"
              ? `Scheduled: ${formatDate(email.scheduledAt)}`
              : mode === "sent"
                ? `Sent: ${formatDate(email.sentAt)}`
                : email.status === "FAILED"
                  ? `Failed: ${formatDate(email.updatedAt ?? email.scheduledAt)}`
                  : `Overdue since: ${formatDate(email.scheduledAt)}`}
          </p>
          {mode === "failed" && (email.error || email.dispatch?.lastError) && (
            <p className="text-sm text-red-700">{email.error || email.dispatch?.lastError}</p>
          )}
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              mode === "failed" && email.status === "SCHEDULED" ? statusStyles.FAILED : statusStyles[email.status]
            }`}
            title={email.error || email.dispatch?.lastError || undefined}
          >
            {mode === "failed" && email.status === "SCHEDULED" ? "NOT SENT" : email.status}
          </span>
        </div>
      ))}
    </div>
  );
}
