export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

// ---- Auth ----

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
} | null;

export async function getMe(): Promise<CurrentUser> {
  const response = await apiFetch("/api/auth/me");
  const payload = await readResponse(response);
  return payload.user;
}

export async function logout() {
  const response = await apiFetch("/api/auth/logout", { method: "POST" });
  return readResponse(response);
}

export async function getSlackStatus(): Promise<boolean> {
  const response = await apiFetch("/api/auth/slack/status");
  const payload = await readResponse(response);
  return Boolean(payload.connected);
}

export function googleLoginUrl() {
  return `${API_URL}/api/auth/google`;
}

export function slackConnectUrl() {
  return `${API_URL}/api/auth/slack`;
}

// ---- Emails ----

export async function scheduleCampaign(data: {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  senderEmail: string;
}) {
  const response = await apiFetch("/api/emails/schedule", {
    method: "POST",
    body: JSON.stringify(data),
  });

  return readResponse(response);
}

export async function getScheduledEmails() {
  return readResponse(await apiFetch("/api/emails/scheduled"));
}

export async function getSentEmails() {
  return readResponse(await apiFetch("/api/emails/sent"));
}

export async function getFailedEmails() {
  return readResponse(await apiFetch("/api/emails/failed"));
}
