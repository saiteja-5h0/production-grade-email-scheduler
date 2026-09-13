import { useState } from "react";
import { Modal } from "./Modal";
import { Input, Textarea } from "./Input";
import { Button } from "./Button";
import { scheduleCampaign } from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
  onScheduled: (message: string) => void;
};

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setSenderEmail("");
    setSubject("");
    setBody("");
    setRecipients([]);
    setStartTime("");
    setDelayMs(2000);
    setHourlyLimit(200);
    setError("");
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      const emails = text
        .split(/\r?\n|,/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line));
      setRecipients([...new Set(emails)]);
    };
    reader.readAsText(file);
  }

  async function handleSchedule() {
    setError("");

    if (!senderEmail || !subject || !body || recipients.length === 0 || !startTime) {
      setError("Please fill all fields and upload a valid CSV.");
      return;
    }

    try {
      setLoading(true);
      const result = await scheduleCampaign({
        senderEmail,
        subject,
        body,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
      });
      onScheduled(`Campaign scheduled successfully. ${result.recipientCount} emails queued.`);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
      }}
      title="Compose Email Campaign"
      description="Create and schedule an email campaign."
    >
      <div className="space-y-6">
        <Input
          label="Sender Email"
          type="email"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
          placeholder="sender@example.com"
        />

        <Input
          label="Subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
        />

        <Textarea
          label="Email Body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email..."
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Recipients CSV</label>
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-500">Upload a CSV/text file of recipient email addresses</p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="mt-4 block w-full text-sm text-slate-600"
            />
            <p className="mt-2 text-xs text-slate-400">{recipients.length} recipients loaded</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Input
            label="Start Time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Delay Between Emails (ms)"
            type="number"
            min={0}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
          />
          <Input
            label="Hourly Limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={loading}>
            {loading ? "Scheduling..." : "Schedule Campaign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
