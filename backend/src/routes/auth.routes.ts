import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../config/database.js";

const router = Router();
const states = new Map<string, { provider: "google" | "slack"; expires: number }>();
const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";

function createState(provider: "google" | "slack") {
  const state = randomBytes(24).toString("hex");
  states.set(state, { provider, expires: Date.now() + 10 * 60_000 });
  return state;
}

function validState(state: unknown, provider: "google" | "slack") {
  if (typeof state !== "string") return false;
  const record = states.get(state);
  states.delete(state);
  return record?.provider === provider && record.expires > Date.now();
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
    if (!validState(req.query.state, "google") || typeof req.query.code !== "string") throw new Error("Invalid OAuth response");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: process.env.GOOGLE_CALLBACK_URL || "", grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Google token exchange failed");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as { sub: string; email: string; name?: string; picture?: string };
    await prisma.user.upsert({ where: { email: profile.email }, update: { googleId: profile.sub, name: profile.name || profile.email, avatar: profile.picture }, create: { googleId: profile.sub, email: profile.email, name: profile.name || profile.email, avatar: profile.picture } });
    res.redirect(`${frontendUrl}/?login=success`);
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.redirect(`${frontendUrl}/?login=failed`);
  }
});

router.get("/slack", (_req, res) => {
  const state = createState("slack");
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID || "", redirect_uri: process.env.SLACK_CALLBACK_URL || "", scope: "chat:write", state }).toString();
  res.redirect(url.toString());
});

router.get("/slack/callback", async (req, res) => {
  try {
    if (!validState(req.query.state, "slack") || typeof req.query.code !== "string") throw new Error("Invalid OAuth response");
    const response = await fetch("https://slack.com/api/oauth.v2.access", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: req.query.code, client_id: process.env.SLACK_CLIENT_ID || "", client_secret: process.env.SLACK_CLIENT_SECRET || "", redirect_uri: process.env.SLACK_CALLBACK_URL || "" }) });
    const data = await response.json() as { ok?: boolean; access_token?: string; team?: { id?: string } };
    if (!data.ok || !data.access_token) throw new Error("Slack token exchange failed");
    await prisma.slackConnection.upsert({ where: { userId: "demo-user" }, update: { accessToken: data.access_token, teamId: data.team?.id }, create: { userId: "demo-user", accessToken: data.access_token, teamId: data.team?.id } });
    res.redirect(`${frontendUrl}/?slack=connected`);
  } catch (error) { console.error("Slack OAuth error:", error); res.redirect(`${frontendUrl}/?slack=failed`); }
});

export default router;
