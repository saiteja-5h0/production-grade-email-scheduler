# Production-Grade Email Scheduler

A React/Vite email scheduling dashboard backed by an Express API, PostgreSQL/Prisma, and durable Vercel Workflows.

## Active Architecture

- Frontend: React, TypeScript, Vite; deployed as a Vercel SPA.
- API: Express exported to Nitro's Vercel preset as a Vercel Function.
- Database: PostgreSQL through Prisma. `DATABASE_URL` is the pooled runtime URL; `DIRECT_URL` is for migrations.
- Scheduling: the API commits campaigns, email rows, and outbox rows together. One durable Workflow is dispatched per email and sleeps until `scheduledAt`.
- Delivery: Resend HTTP API in production; Ethereal is restricted to non-production testing.
- Search: parameterized Prisma/PostgreSQL search scoped to the authenticated campaign owner.
- Authentication: Google OAuth, HttpOnly session cookie, and database-backed one-time OAuth state. Slack OAuth remains supported.

BullMQ, Redis, Bull Board, and Elasticsearch are no longer application dependencies. Vercel Workflows is the campaign dispatcher. The recovery cron is bounded to 100 pending outbox rows and runs daily on Vercel Hobby; failed dispatch recovery may therefore take about a day.

## Local Development

Prerequisites: Node.js 22.12+ and PostgreSQL. Copy `backend/.env.example` to `backend/.env`, provide local PostgreSQL and OAuth values, and keep credentials out of source control. For non-production email previews, use the Ethereal settings and set `EMAIL_PROVIDER=ethereal`.

```sh
cd backend
npm ci
npm run db:generate
npm run dev
```

`npm run dev` uses Nitro and the Workflow SDK's Local World. The frontend can be run separately:

```sh
cd frontend
npm ci
npm run dev
```

The Vite development proxy targets `VITE_API_URL` or `http://localhost:4000`. Apply Prisma migrations only to a database you intentionally selected and backed up. `npm run db:migrate` is not part of build or test commands.

## API

- `GET /health`
- `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/auth/google`, `GET /api/auth/google/callback`
- `GET /api/auth/slack`, `GET /api/auth/slack/callback`, `GET /api/auth/slack/status`
- `POST /api/emails/schedule`
- `GET /api/emails/scheduled`, `/api/emails/sent`, `/api/emails/failed`
- `GET /api/emails/search?q=<query>`
- `POST /api/emails/unsubscribe/:token`
- `POST /api/emails/webhooks/resend`
- `GET /api/cron/recover-email-dispatches` (requires `CRON_SECRET`)

All campaign/email reads and search results require a valid session and are scoped to its user. Campaigns require explicit recipient-consent confirmation and are limited to 100 recipients per request. Existing rows retain `UNKNOWN` consent and will not be sent automatically.

Search matches recipient, sender, subject, body, or a known email status. Results remain owner-scoped, ordered by scheduled time descending, and capped at 10 as in the previous Elasticsearch default response size.

## Reliability and Safety

- The PostgreSQL outbox survives a successful campaign transaction even when workflow dispatch fails; the recovery endpoint retries pending dispatches.
- PostgreSQL leases/claims and a stable workflow Hook token prevent concurrent attempts from intentionally sending the same email.
- Sender minimum delays, UTC hourly limits, a global provider request limit, and the configured daily Resend limit are reserved atomically in PostgreSQL.
- Resend idempotency keys reduce duplicates for 24 hours. Delivery is not exactly-once if the provider accepts a message but the API loses the result beyond that window.
- Unsubscribe links and signed provider webhooks populate a global suppression table. Bounce, complaint, and suppression events prevent future sends to the recipient.
- Test mode refuses all provider sends. Real-email tests are not part of automated tests.

Resend requires a verified sender domain. Its currently published Free transactional quota is 100 messages/day and 3,000/month. Resend distinguishes transactional from marketing messages; confirm account approval and campaign-purpose requirements before production bulk sending. Vercel Hobby Workflows currently include 50,000 events and 1 GB data written per month. Vercel Hobby Cron is daily only; choose a paid plan or different recovery arrangement if faster recovery is required. Hobby use is restricted to personal, non-commercial projects.

## Configuration Names

Backend variables (names only): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_CALLBACK_URL`, `SLACK_DEFAULT_CHANNEL_ID`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_DAILY_LIMIT`, `UNSUBSCRIBE_SECRET`, `PUBLIC_API_URL`, `CRON_SECRET`, `ETHEREAL_HOST`, `ETHEREAL_PORT`, `ETHEREAL_USER`, `ETHEREAL_PASSWORD`, `MIN_DELAY_MS`, `MAX_EMAILS_PER_HOUR`.

Frontend build variable: `VITE_API_URL`.

## Vercel Setup Notes

Create a backend Vercel project rooted at `backend/`, build with `npm run build`, and enable access to Vercel system environment variables so the Workflow SDK can select the Vercel World. Create the frontend project rooted at `frontend/` and configure `VITE_API_URL` to the deployed API origin. The frontend SPA rewrite remains in `frontend/vercel.json`; do not add a rewrite to an unknown backend URL. Configure exact frontend origins in `CORS_ORIGIN` and `FRONTEND_URL`.

Review and intentionally apply the OAuth-state and durable-jobs migrations to the chosen database before cutover. They have not been run by this repository work. Keep Render until the deployed API, OAuth, scheduled delivery, recovery, webhook, and data checks pass.

## Checks

```sh
cd backend
npm test
npm run typecheck
npm run build
```

```sh
cd frontend
npm run build
```