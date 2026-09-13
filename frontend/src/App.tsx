import { useEffect, useState } from "react";
import {
  getScheduledEmails,
  getSentEmails,
  scheduleCampaign,
} from "./api";

function App() {
  const [showCompose, setShowCompose] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    "scheduled",
  );

  void scheduledEmails;
  void sentEmails;
  void activeTab;
  void setActiveTab;

  const loadEmails = async () => {
    try {
      const [scheduled, sent] = await Promise.all([
        getScheduledEmails(),
        getSentEmails(),
      ]);

      setScheduledEmails(scheduled.emails || []);
      setSentEmails(sent.emails || []);
    } catch (error) {
      console.error("Failed to load emails:", error);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleSchedule = async () => {
    setMessage("");

    if (
      !senderEmail ||
      !subject ||
      !body ||
      recipients.length === 0 ||
      !startTime
    ) {
      setMessage("Please fill all fields and upload a valid CSV.");
      return;
    }

    try {
      setLoading(true);

      const result = await scheduleCampaign({
        senderEmail,
        subject,
        body,
        recipients,
        startTime,
        delayMs,
        hourlyLimit,
      });

      setMessage(
        `Campaign scheduled successfully. ${result.recipientCount} emails queued.`,
      );

      await loadEmails();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to schedule campaign",
      );
    } finally {
      setLoading(false);
    }
  };

  if (showCompose) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => setShowCompose(false)}
            className="mb-6 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Dashboard
          </button>

          <div className="rounded-xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Compose Email Campaign
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create and schedule an email campaign.
            </p>

            <div className="mt-8 space-y-6">
              {/* Sender */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Sender Email
                </label>

                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="sender@example.com"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Subject
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email Body
                </label>

                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              {/* CSV */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Recipients CSV
                </label>

                <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm text-slate-500">
                    Upload a CSV file containing recipient email addresses
                  </p>

                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (!file) return;

                      const reader = new FileReader();

                      reader.onload = (event) => {
                        const text = String(event.target?.result || "");

                        const emails = text
                          .split(/\r?\n/)
                          .map((line) => line.trim().toLowerCase())
                          .filter((line) =>
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line),
                          );

                        setRecipients([...new Set(emails)]);
                      };

                      reader.readAsText(file);
                    }}
                    className="mt-4 block w-full text-sm text-slate-600"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    {recipients.length} recipients loaded
                  </p>
                </div>
              </div>

              {/* Scheduling */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Start Time
                  </label>

                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Delay Between Emails (ms)
                  </label>

                  <input
                    type="number"
                    value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value))}
                    min={0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Hourly Limit
                  </label>

                  <input
                    type="number"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    min={1}
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {message && (
                <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
                  {message}
                </div>
              )}

              {/* Action */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                <button
                  onClick={() => setShowCompose(false)}
                  className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Scheduling..." : "Schedule Campaign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 p-6 text-white">
        <h1 className="text-2xl font-bold">ReachInbox</h1>

        <p className="mt-2 text-sm text-slate-400">
          Email Scheduler
        </p>

        <nav className="mt-10 space-y-2">
          <button className="w-full rounded-lg bg-slate-800 px-4 py-3 text-left">
            Dashboard
          </button>

          <button className="w-full rounded-lg px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
            Scheduled
          </button>

          <button className="w-full rounded-lg px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
            Sent
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="ml-64 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Dashboard
            </h2>

            <p className="mt-1 text-slate-500">
              Manage your scheduled email campaigns.
            </p>
          </div>

          <button
            onClick={() => setShowCompose(true)}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            + Compose Email
          </button>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Scheduled</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">0</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Sent</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">0</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Failed</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">0</p>
          </div>
        </div>

        {/* Campaigns */}
        <div className="mt-8 rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent Campaigns
            </h3>
          </div>

          <div className="p-10 text-center text-slate-500">
            No campaigns yet.
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
