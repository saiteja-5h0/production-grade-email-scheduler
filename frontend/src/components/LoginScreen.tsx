import { googleLoginUrl } from "../api";
import { Button } from "./Button";

export function LoginScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">ReachInbox</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to schedule and track your email campaigns.</p>

        <a href={googleLoginUrl()} className="mt-8 block">
          <Button className="w-full justify-center">Sign in with Google</Button>
        </a>
      </div>
    </div>
  );
}
