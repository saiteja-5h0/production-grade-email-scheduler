import { Client } from "@elastic/elasticsearch";
import { env } from "./env.js";

export const elasticsearch = env.elasticsearchUrl
  ? new Client({ node: env.elasticsearchUrl })
  : null;
