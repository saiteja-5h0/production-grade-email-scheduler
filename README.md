# Production-grade email scheduler

## Local setup

1. Start PostgreSQL and Redis with `docker compose up -d postgres redis`.
2. Copy `backend/.env.example` to `backend/.env` and provide valid PostgreSQL,
   Redis, and Ethereal SMTP settings. The default API port is `4000`, avoiding
   the macOS service that commonly occupies port `5000`.
3. From `backend`, run `npm ci`, `npm run db:generate`, `npm run db:migrate`,
   `npm run dev`, and (in a second terminal) `npm run worker`.
4. From `frontend`, run `npm ci` and `npm run dev`.

The frontend uses its same-origin `/api` proxy in development. Set
`VITE_API_URL` only when the API is hosted at a different URL. Set
`CORS_ORIGIN` in the backend to the deployed frontend origin (or a
comma-separated allow-list of origins).

## Checks

Run `npm run build` in both `backend` and `frontend`, then run
`npm run lint` in `frontend`.

## Scheduler architecture

- Scheduling uses BullMQ delayed jobs backed by Redis—no cron jobs. Each job has
  the database email ID as its BullMQ job ID, so it remains idempotent across
  API restarts.
- The worker uses configurable `WORKER_CONCURRENCY`, per-sender Redis-backed
  delay keys, and Redis-backed UTC-hour counters. Jobs delayed by rate limits
  are moved to the next hour rather than dropped.
- Sent and failed email records are indexed in Elasticsearch and are available
  through `GET /api/emails/search?q=...`. The live BullMQ dashboard is at
  `/admin/queues`.

## OAuth and Slack configuration

To enable the required live OAuth flows, configure Google and Slack client
credentials and registered callback URLs for your deployment. Do not commit
those secrets. The scheduler itself remains usable with the local demo user.
