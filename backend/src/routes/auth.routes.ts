import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { SESSION_COOKIE, signSession } from "../middleware/auth.js";

const router = Router();

// state -> { provider, expires, userId? } (userId is set for the Slack flow so the
// callback knows which logged-in user to attach the Slack connection to)
const states = new Map<string, { provider: "google" | "slack"; expires: number; userId?: string }>();
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

function createState(provider: "google" | "slack", userId?: string) {
  const state = randomBytes(24).toString("hex");
  states.set(state, { provider, expires: Date.now() + 10 * 60_000, userId });
  return state;
}

function validState(state: unknown, provider: "google" | "slack") {
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
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
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
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
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

router.get("/slack", (req, res) => {
  if (!req.isAuthenticated || !req.user) {
    return res.redirect(`${frontendUrl}/?slack=failed&reason=not-logged-in`);
  }

  const state = createState("slack", req.user.id);
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    redirect_uri: process.env.SLACK_CALLBACK_URL || "",
    scope: "chat:write",
    state,
  }).toString();
  res.redirect(url.toString());
});

router.get("/slack/callback", async (req, res) => {
  try {
    const state = validState(req.query.state, "slack");
    if (!state?.userId || typeof req.query.code !== "string") {
      throw new Error("Invalid OAuth response");
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: process.env.SLACK_CLIENT_ID || "",
        client_secret: process.env.SLACK_CLIENT_SECRET || "",
        redirect_uri: process.env.SLACK_CALLBACK_URL || "",
      }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      access_token?: string;
      team?: { id?: string; name?: string };
    };
    if (!data.ok || !data.access_token) throw new Error("Slack token exchange failed");

    await prisma.slackConnection.upsert({
      where: { userId: state.userId },
      update: { accessToken: data.access_token, teamId: data.team?.id },
      create: { userId: state.userId, accessToken: data.access_token, teamId: data.team?.id },
    });

    res.redirect(`${frontendUrl}/?slack=connected`);
  } catch (error) {
    console.error("Slack OAuth error:", error);
    res.redirect(`${frontendUrl}/?slack=failed`);
  }
});

router.get("/slack/status", async (req, res) => {
  if (!req.user) return res.json({ success: true, connected: false });
  const connection = await prisma.slackConnection.findUnique({ where: { userId: req.user.id } });
  res.json({ success: true, connected: Boolean(connection) });
});

export default router;
