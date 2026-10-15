# Vercel API and Workflows

Deploy the backend as a separate Vercel project rooted at `backend/`. Enable
access to Vercel system environment variables; the Workflow SDK uses
`VERCEL_DEPLOYMENT_ID` to select Vercel's durable World instead of its local
filesystem-backed World. The
official Workflow SDK is compiled by Nitro through `workflow/nitro`; do not
replace `npm run dev` or `npm run build` with plain `tsx`/`tsc` when exercising
workflow routes. `src/server.ts` exports Express and never calls `listen()`.
Use `npm run dev` for the workflow-aware local runtime and `npm run build` for
the Vercel Build Output API artifact.

The existing frontend is a separate Vercel project rooted at `frontend/`. Its
SPA rewrite remains unchanged. Configure the frontend's `VITE_API_URL` to the
deployed backend origin. API paths already include `/api`, so the frontend
should call `<backend-origin>/api/...` without an additional path rewrite.
Configure backend `FRONTEND_URL` and `CORS_ORIGIN` with the exact frontend
origin(s); production session cookies remain `Secure` and `SameSite=None` for
this cross-origin arrangement.

Do not add a frontend rewrite to an assumed backend URL. A same-origin rewrite
is only appropriate after deciding to route the frontend project to a known
backend deployment or to co-locate both projects under a Vercel configuration
that supports both the Vite build and function entry point.

For Neon, configure `DATABASE_URL` with the pooled connection string for runtime
queries and `DIRECT_URL` with the direct connection string for Prisma
migrations. Keep both values in Vercel environment settings. The OAuth-state,
durable-jobs/safety, and PostgreSQL search-index migrations must be reviewed and
intentionally applied to the selected database by the deployment operator; this
phase does not run them.

## Scheduled email processing

Campaign rows, email rows, and pending outbox records are written in one
PostgreSQL transaction. The API dispatches one durable Workflow per email. Each
workflow sleeps until its persisted `scheduledAt`, then checks consent and
suppression, claims the email using a leased PostgreSQL token, atomically
reserves sender/hour/provider capacity, sends, and updates the existing email
status fields. The email ID is the deterministic Workflow Hook token; an active
duplicate workflow exits before any send step. Resend's `Idempotency-Key` is
also the email ID and is retained by Resend for 24 hours.

If dispatch fails after the database transaction, its outbox row remains
`PENDING`. The protected `/api/cron/recover-email-dispatches` endpoint scans a
bounded batch and retries dispatch. Nitro's Vercel Build Output config schedules
this recovery once daily because Vercel Hobby Cron supports daily schedules only. Therefore, a
persistently failed initial dispatch can remain pending for up to about a day;
the transaction is durable, but Hobby cron is not prompt recovery. Configure
`CRON_SECRET` in Vercel.

Existing scheduled email rows are backfilled into the outbox by the new
reviewable migration. Old rows keep `consentStatus=UNKNOWN` and will fail closed
when the new workflow encounters them; no consent is inferred.

## Email and safety configuration

Production uses Resend's HTTP API (`EMAIL_PROVIDER=resend`) and requires
`RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET`,
and `PUBLIC_API_URL`. Resend requires a verified sender domain. The conservative
default `RESEND_DAILY_LIMIT` is 100; set it no higher than the active account
quota. Resend Free currently documents 100 transactional messages per day and
3,000 per month, with 10 API requests/second. It distinguishes marketing from
transactional messages, so sender account terms and campaign purpose must be
confirmed before production bulk use. This API requires explicit campaign
consent, includes unsubscribe headers, accepts signed one-click unsubscribe,
and applies suppression from unsubscribe, bounce, and complaint events.

Local Ethereal delivery is selected with `EMAIL_PROVIDER=ethereal`; its SMTP
credentials are used only outside production. Test runs are explicitly blocked
from sending through either provider.

The production API has no Redis, BullMQ, Bull Board, or Elasticsearch
configuration. Search uses parameterized PostgreSQL `contains` filters and is
scoped to the authenticated campaign owner. The current UI has no search
control; the existing backend search API contract remains available. Slack OAuth
and rate-limit notifications use PostgreSQL and the persisted Slack connection.

The old worker, Redis connection, queue, dashboard and Elasticsearch client
have been removed from source and dependencies. PostgreSQL is the only local
Docker service required by the application. The OAuth-state, durable-job/safety,
and search-index migrations are reviewable but have not been applied.