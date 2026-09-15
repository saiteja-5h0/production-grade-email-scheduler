import type { CurrentUser } from "../api";
import { Button } from "./Button";

type Props = {
  user: NonNullable<CurrentUser>;
  activeView: "scheduled" | "sent" | "queue";
  onNavigate: (view: "scheduled" | "sent" | "queue") => void;
  onLogout: () => void;
};

export function Header({ user, activeView, onNavigate, onLogout }: Props) {
  return (
    <header className="app-header">
      <div className="brand">ONB<span>.</span></div>
      <nav className="main-nav"><button className={activeView === "scheduled" ? "active" : ""} onClick={() => onNavigate("scheduled")}>Scheduled</button><button className={activeView === "sent" ? "active" : ""} onClick={() => onNavigate("sent")}>Sent</button><button className={activeView === "queue" ? "active" : ""} onClick={() => onNavigate("queue")}>Queue dashboard</button></nav>
      <div className="user-area">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="user-copy">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <Button variant="ghost" onClick={onLogout}>Log out</Button>
      </div>
    </header>
  );
}
