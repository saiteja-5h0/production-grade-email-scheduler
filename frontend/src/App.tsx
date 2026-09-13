import { useEffect, useState } from "react";
import { getMe, getScheduledEmails, getSentEmails, getSlackStatus, logout, type CurrentUser } from "./api";
import type { Email } from "./types";
import { Header } from "./components/Header";
import { LoginScreen } from "./components/LoginScreen";
import { Button } from "./components/Button";
import { EmailTable } from "./components/EmailTable";
import { ComposeModal } from "./components/ComposeModal";
import { Toast } from "./components/Toast";

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<CurrentUser>(null);
  const [slackConnected, setSlackConnected] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  async function refreshSession() {
    const currentUser = await getMe().catch(() => null);
    setUser(currentUser);
    if (currentUser) {
      setSlackConnected(await getSlackStatus().catch(() => false));
    }
  }

  async function loadEmails() {
    try {
      setLoadingEmails(true);
      setLoadError("");
      const [scheduled, sent] = await Promise.all([getScheduledEmails(), getSentEmails()]);
      setScheduledEmails(scheduled.emails || []);
      setSentEmails(sent.emails || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load campaign data.");
    } finally {
      setLoadingEmails(false);
    }
  }

  useEffect(() => {
    // Handle redirect back from Google/Slack OAuth (?login=success, ?slack=connected, ...)
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    const slack = params.get("slack");

    if (login === "success") setToast({ message: "Signed in successfully.", tone: "success" });
    else if (login === "failed") setToast({ message: "Google sign-in failed. Please try again.", tone: "error" });
    else if (slack === "connected") setToast({ message: "Slack connected.", tone: "success" });
    else if (slack === "failed") setToast({ message: "Slack connection failed.", tone: "error" });

    if (login || slack) window.history.replaceState({}, "", window.location.pathname);

    refreshSession().finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (user) void loadEmails();
  }, [user]);

  async function handleLogout() {
    await logout().catch(() => null);
    setUser(null);
  }

  if (checkingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Loading…</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const activeEmails = activeTab === "scheduled" ? scheduledEmails : sentEmails;

  return (
    <div className="min-h-screen bg-slate-100">
      <Header user={user} slackConnected={slackConnected} onLogout={handleLogout} />

      <main className="mx-auto max-w-6xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
            <p className="mt-1 text-slate-500">Manage your scheduled email campaigns.</p>
          </div>
          <Button onClick={() => setShowCompose(true)}>+ Compose Email</Button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Scheduled</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{scheduledEmails.length}</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Sent</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {sentEmails.filter((e) => e.status === "SENT").length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Failed</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {sentEmails.filter((e) => e.status === "FAILED").length}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("scheduled")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  activeTab === "scheduled" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Scheduled Emails
              </button>
              <button
                onClick={() => setActiveTab("sent")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  activeTab === "sent" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Sent Emails
              </button>
            </div>
            <Button variant="ghost" onClick={() => void loadEmails()}>
              Refresh
            </Button>
          </div>

          <EmailTable emails={activeEmails} mode={activeTab} loading={loadingEmails} error={loadError} />
        </div>
      </main>

      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        onScheduled={(message) => setToast({ message, tone: "success" })}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default App;
