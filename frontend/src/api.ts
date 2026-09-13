const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

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

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to schedule campaign");
  }

  return result;
}

export async function getScheduledEmails() {
  const response = await fetch(`${API_URL}/api/emails/scheduled`);

  if (!response.ok) {
    throw new Error("Failed to fetch scheduled emails");
  }

  return response.json();
}

export async function getSentEmails() {
  const response = await fetch(`${API_URL}/api/emails/sent`);

  if (!response.ok) {
    throw new Error("Failed to fetch sent emails");
  }

  return response.json();
}
