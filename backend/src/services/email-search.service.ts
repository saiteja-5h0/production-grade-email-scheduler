import { elasticsearch } from "../config/elasticsearch.js";

const INDEX = "scheduled-emails";

export async function indexEmail(email: {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  senderEmail: string;
}) {
  if (!elasticsearch) return;

  await elasticsearch.index({
    index: INDEX,
    id: email.id,
    document: email,
    refresh: "wait_for",
  });
}

export async function searchEmails(query: string) {
  if (!elasticsearch) {
    throw new Error("Elasticsearch is not configured");
  }

  const result = await elasticsearch.search({
    index: INDEX,
    query: query
      ? { multi_match: { query, fields: ["recipient", "senderEmail", "subject", "body", "status"] } }
      : { match_all: {} },
    sort: [{ scheduledAt: { order: "desc" } }],
  });

  return result.hits.hits.map((hit) => hit._source);
}
