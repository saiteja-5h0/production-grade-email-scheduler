import { googleLoginUrl } from "../api";
import { Button } from "./Button";

export function LoginScreen() {
  return (
    <div className="login-screen"><div className="login-card">
        <div className="brand login-brand">ONB<span>.</span></div><span className="eyebrow">Outbound workspace</span><h1>Welcome back</h1>
        <p>Sign in to schedule and track your email campaigns.</p>

        <a href={googleLoginUrl()} className="mt-8 block">
          <Button className="google-button">G <span>Continue with Google</span></Button>
        </a>
      </div>
    </div>
  );
}
