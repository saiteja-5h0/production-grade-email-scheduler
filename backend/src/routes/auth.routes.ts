import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { SESSION_COOKIE, signSession } from "../middleware/auth.js";

const router = Router();

const states = new Map<string, { provider: "google"; expires: number }>();
const frontendUrl = env.frontendUrl;

// In production the frontend (Vercel) and backend (Render) live on different
// domains, so the session cookie must be SameSite=None + Secure to be sent
// cross-site. Locally (http, same-ish origin) "lax" is fine and doesn't
// require HTTPS.
const cookieOptions = {
  httpOnly: true,
  sameSite: env.isProduction ? ("none" as const) : ("lax" as const),
  secure: env.isProduction,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function createState(provider: "google") {
  const state = randomBytes(24).toString("hex");
  states.set(state, { provider, expires: Date.now() + 10 * 60_000 });
  return state;
}

function validState(state: unknown, provider: "google") {
  if (typeof state !== "string") return null;
  const record = states.get(state);
  states.delete(state);
  if (!record || record.provider !== provider || record.expires <= Date.now()) return null;
  return record;
}

router.get("/google", (_req, res) => {
  const state = createState("google");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.googleClientId || "",
    redirect_uri: env.googleCallbackUrl || "",
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  res.redirect(url.toString());
});

router.get("/google/callback", async (req, res) => {
  try {
    if (!validState(req.query.state, "google") || typeof req.query.code !== "string") {
      throw new Error("Invalid OAuth response");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: env.googleClientId || "",
        client_secret: env.googleClientSecret || "",
        redirect_uri: env.googleCallbackUrl || "",
        grant_type: "authorization_code",
      }),
    });

    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Google token exchange failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await profileResponse.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: { googleId: profile.sub, name: profile.name || profile.email, avatar: profile.picture },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || profile.email,
        avatar: profile.picture,
      },
    });

    res.cookie(SESSION_COOKIE, signSession(user.id), cookieOptions);
    res.redirect(`${frontendUrl}/?login=success`);
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.redirect(`${frontendUrl}/?login=failed`);
  }
});

router.get("/me", (req, res) => {
  if (!req.isAuthenticated || !req.user) {
    return res.json({ success: true, user: null });
  }
  res.json({ success: true, user: req.user });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true });
});

export default router;
