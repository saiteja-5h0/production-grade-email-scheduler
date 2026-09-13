import type { CurrentUser } from "../api";
import { slackConnectUrl } from "../api";
import { Button } from "./Button";

type Props = {
  user: NonNullable<CurrentUser>;
  slackConnected: boolean;
  onLogout: () => void;
};

export function Header({ user, slackConnected, onLogout }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">ReachInbox</h1>
        <p className="text-xs text-slate-400">Email Scheduler</p>
      </div>

      <div className="flex items-center gap-4">
        {slackConnected ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            Slack connected
          </span>
        ) : (
          <a href={slackConnectUrl()}>
            <Button variant="secondary">Connect Slack</Button>
          </a>
        )}

        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="leading-tight">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <Button variant="ghost" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
