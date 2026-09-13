const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

export async function scheduleCampaign(data: {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  senderEmail: string;
}) {
  const response = await fetch(`${API_URL}/api/emails/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return readResponse(response);
}

export async function getScheduledEmails() {
  const response = await fetch(`${API_URL}/api/emails/scheduled`);

  return readResponse(response);
}

export async function getSentEmails() {
  const response = await fetch(`${API_URL}/api/emails/sent`);

  return readResponse(response);
}

export async function getFailedEmails() {
  const response = await fetch(`${API_URL}/api/emails/failed`);
  return readResponse(response);
}
