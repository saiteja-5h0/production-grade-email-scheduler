import type { EmailJob } from "../api";

type Props = {
  jobs: EmailJob[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onRetry: (emailId: string) => void;
  retryingEmailId: string | null;
};

const emailStatusStyles: Record<EmailJob["email"]["status"], string> = {
  SCHEDULED: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
};

const dispatchLabels: Record<EmailJob["state"], string> = {
  PENDING: "Waiting to start",
  CLAIMED: "Starting workflow",
  DISPATCHED: "Workflow started",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function WorkflowJobs({ jobs, loading, error, onRefresh, onRetry, retryingEmailId }: Props) {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Email Jobs</h2>
          <p className="mt-1 text-slate-500">Vercel Workflow dispatch and delivery status.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh jobs"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">Could not load jobs: {error}</div>
      ) : loading && jobs.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-slate-500 shadow-sm">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">No email jobs yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[1050px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Recipient / subject</th>
                <th className="px-5 py-3">Scheduled</th>
                <th className="px-5 py-3">Email status</th>
                <th className="px-5 py-3">Dispatch</th>
                <th className="px-5 py-3">Attempts / run</th>
                <th className="px-5 py-3">Latest error</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.emailId} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{job.email.recipient}</p>
                    <p className="mt-1 text-slate-500">{job.email.subject}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(job.email.scheduledAt)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${emailStatusStyles[job.email.status]}`}>
                      {job.email.status}
                    </span>
                    {job.email.error && <p className="mt-2 max-w-xs break-words text-xs text-red-700">{job.email.error}</p>}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{dispatchLabels[job.state]}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <p>{job.attempts}</p>
                    {job.runId && <p className="mt-1 max-w-40 break-all font-mono text-xs">{job.runId}</p>}
                  </td>
                  <td className="px-5 py-4">
                    {job.lastError ? <p className="max-w-sm break-words text-xs text-red-700">{job.lastError}</p> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {job.state === "PENDING" && job.email.status === "SCHEDULED" ? (
                      <button
                        type="button"
                        onClick={() => onRetry(job.emailId)}
                        disabled={retryingEmailId === job.emailId}
                        className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {retryingEmailId === job.emailId ? "Retrying…" : "Retry dispatch"}
                      </button>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
