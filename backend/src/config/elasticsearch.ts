import { Client } from "@elastic/elasticsearch";

export const elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});
