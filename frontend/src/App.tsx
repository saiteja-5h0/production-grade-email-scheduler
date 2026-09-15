import { useEffect, useState } from "react";
import { getMe, getScheduledEmails, getSentEmails, logout, type CurrentUser } from "./api";
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
  const [showCompose, setShowCompose] = useState(false);
  const [activeView, setActiveView] = useState<"scheduled" | "sent" | "queue">("scheduled");
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  async function refreshSession() {
    const currentUser = await getMe().catch(() => null);
    setUser(currentUser);
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
    // Handle redirect back from Google OAuth.
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");

    if (login === "success") setToast({ message: "Signed in successfully.", tone: "success" });
    else if (login === "failed") setToast({ message: "Google sign-in failed. Please try again.", tone: "error" });

    if (login) window.history.replaceState({}, "", window.location.pathname);

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

  const activeEmails = activeView === "scheduled" ? scheduledEmails : sentEmails;

  return (
    <div className="mail-app">
      <Header user={user} activeView={activeView} onNavigate={setActiveView} onLogout={handleLogout} />
      {activeView === "queue" ? (
        <main className="queue-view"><div className="page-heading"><div><span className="eyebrow">Operations</span><h2>Queue monitor</h2><p>Live BullMQ activity for scheduled email delivery.</p></div></div><iframe title="BullMQ dashboard" src={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/admin/queues`} /></main>
      ) : (
      <main className="workspace">
        <div className="page-heading"><div><span className="eyebrow">Outbox</span><h2>{activeView === "scheduled" ? "Scheduled" : "Sent"}</h2><p>{activeView === "scheduled" ? "Keep an eye on what is about to leave your inbox." : "A clear record of every delivered campaign."}</p></div><Button onClick={() => setShowCompose(true)}>Compose email</Button></div>
        <div className="summary-strip"><span><strong>{scheduledEmails.length}</strong> scheduled</span><span><strong>{sentEmails.filter((e) => e.status === "SENT").length}</strong> sent</span><span><strong>{sentEmails.filter((e) => e.status === "FAILED").length}</strong> failed</span></div>
        <section className="mail-panel"><div className="panel-toolbar"><div className="mail-tabs">
          <button onClick={() => setActiveView("scheduled")} className={activeView === "scheduled" ? "active" : ""}>Scheduled <span>{scheduledEmails.length}</span></button>
          <button onClick={() => setActiveView("sent")} className={activeView === "sent" ? "active" : ""}>Sent <span>{sentEmails.length}</span></button>
        </div><button className="refresh-button" onClick={() => void loadEmails()}>Refresh</button></div>
        <EmailTable emails={activeEmails} mode={activeView} loading={loadingEmails} error={loadError} /></section>
      </main>) }

      <footer className="app-footer">Made with <span aria-label="love">&hearts;</span> by Mulinti Saiteja</footer>

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
