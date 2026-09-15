# Production-Grade Email Scheduler

A full-stack email scheduling platform built with **React, TypeScript, Express.js, PostgreSQL, Prisma, Redis, BullMQ, Elasticsearch, and Ethereal SMTP**.

The application allows users to create email campaigns, upload recipient lists, schedule emails for future delivery, control sending speed and hourly limits, and track scheduled, sent, and failed emails.

---

## Features

### Email Campaign Scheduling

- Create email campaigns with:
  - Sender email
  - Subject
  - Email body
  - Recipient list
  - Start time
  - Delay between emails
  - Hourly sending limit
- Upload recipient emails using CSV.
- Duplicate recipient emails are removed automatically.
- Invalid email addresses are filtered.
- Campaigns and individual email records are persisted in PostgreSQL.

### Reliable Background Processing

- Uses **BullMQ + Redis** for background email processing.
- Uses BullMQ delayed jobs instead of cron-based scheduling.
- Jobs survive API/worker restarts because scheduling state is stored in Redis and PostgreSQL.
- Each email uses its database email ID as the BullMQ job ID.
- This provides idempotent job handling and prevents duplicate queue entries.
- Worker concurrency is configurable using environment variables.

### Rate Limiting & Sending Control

- Per-sender minimum delay between emails.
- Per-sender hourly email limits.
- Redis is used for distributed rate-limit state.
- Rate-limit operations use atomic Redis scripting to avoid race conditions between concurrent workers.
- When the hourly limit is reached, jobs are delayed until the next available hour instead of being dropped.
- Sending speed and hourly limits can be configured per campaign.

### Email Delivery

- Uses **Ethereal SMTP** for development and demonstration.
- Stores:
  - Delivery status
  - Sent timestamp
  - Message ID
  - Ethereal preview URL
  - Error information for failed emails

### Email Tracking

Email states include:

```text
SCHEDULED
    ↓
PROCESSING
    ↓
SENT

or

PROCESSING
    ↓
FAILED
````

The dashboard APIs provide separate views for scheduled, sent, and failed emails.

### Elasticsearch Search

Sent and failed email records can be indexed in Elasticsearch.

Search is available through:

```text
GET /api/emails/search?q=<query>
```

### BullMQ Dashboard

BullMQ provides a live queue dashboard for monitoring background jobs.

Available at:

```text
/admin/queues
```

### Authentication & Integrations

The backend contains OAuth routes/configuration for:

* Google authentication

OAuth credentials and callback URLs are configured through environment variables and must never be committed to the repository.

---

# Architecture

```text
                    ┌─────────────────────┐
                    │       React         │
                    │     Frontend        │
                    └──────────┬──────────┘
                               │
                               │ HTTP API
                               ▼
                    ┌─────────────────────┐
                    │      Express.js     │
                    │       Backend       │
                    └──────┬──────┬───────┘
                           │      │
                ┌──────────┘      └──────────────┐
                ▼                                 ▼
        ┌───────────────┐                 ┌──────────────┐
        │  PostgreSQL   │                 │    Redis     │
        │    Prisma     │                 │   BullMQ     │
        └───────────────┘                 └──────┬───────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │ Email Worker    │
                                        │ Configurable    │
                                        │ Concurrency     │
                                        └────────┬────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │ Ethereal SMTP   │
                                        └─────────────────┘

                         ┌──────────────────────┐
                         │    Elasticsearch     │
                         │ Email indexing/search │
                         └──────────────────────┘

                         ┌──────────────────────┐
                         │     Bull Board       │
                         │ Queue monitoring     │
                         └──────────────────────┘
```

---

# Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

## Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM

## Data & Infrastructure

* PostgreSQL
* Redis
* BullMQ
* Elasticsearch

## Email

* Nodemailer
* Ethereal SMTP

## Queue Monitoring

* Bull Board

## Authentication / Integrations

* Google OAuth configuration

---

# Project Structure

```text
production-grade-email-scheduler/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── elasticsearch.ts
│   │   │   ├── env.ts
│   │   │   └── redis.ts
│   │   │
│   │   ├── queues/
│   │   │   └── email.queue.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   └── email.routes.ts
│   │   │
│   │   ├── services/
│   │   │   ├── email-search.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── rate-limit.service.ts
│   │   │   ├── send-delay.service.ts
│   │   │
│   │   ├── workers/
│   │   │   └── email.worker.ts
│   │   │
│   │   └── server.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── ...
│   │
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

# Database Design

The application uses PostgreSQL through Prisma.

### User

Stores application users and OAuth information.

### Campaign

Stores:

* Sender
* Subject
* Body
* Start time
* Minimum delay
* Hourly limit
* Campaign owner

### Email

Stores each individual recipient email and its processing state.

Important fields include:

* Recipient
* Subject
* Body
* Scheduled time
* Sent time
* Status
* Error
* Message ID
* Preview URL

---

# API Endpoints

## Health Check

```http
GET /health
```

Returns a dependency-free liveness response while the Node process is running.

Example response:

```json
{
   "status": "ok"
}
```

## Schedule Campaign

```http
POST /api/emails/schedule
```

Example request:

```json
{
  "subject": "Welcome to ReachInbox",
  "body": "Hello, this is a scheduled email.",
  "recipients": [
    "alice@example.com",
    "bob@example.com"
  ],
  "startTime": "2026-09-13T10:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 200,
  "senderEmail": "sender@example.com"
}
```

## Scheduled Emails

```http
GET /api/emails/scheduled
```

Returns currently scheduled emails.

## Sent Emails

```http
GET /api/emails/sent
```

Returns successfully sent emails.

## Failed Emails

```http
GET /api/emails/failed
```

Returns failed email records.

## Email Search

```http
GET /api/emails/search?q=<query>
```

Searches indexed email records using Elasticsearch.

## BullMQ Dashboard

```text
/admin/queues
```

---

# Local Development

## Prerequisites

Install:

* Node.js
* npm
* Docker Desktop
* Git

---

## 1. Clone the repository

```bash
git clone https://github.com/saiteja-5h0/production-grade-email-scheduler.git
cd production-grade-email-scheduler
```

---

## 2. Start infrastructure

Start PostgreSQL, Redis, and Elasticsearch:

```bash
docker compose up -d
```

Check running containers:

```bash
docker compose ps
```

---

## 3. Configure backend environment

Create:

```text
backend/.env
```

from:

```text
backend/.env.example
```

Then configure your local PostgreSQL, Redis, Elasticsearch, Ethereal SMTP, and Google OAuth values.

Example:

```env
PORT=4000

CORS_ORIGIN=http://localhost:5173

DATABASE_URL="postgresql://postgres:your-password@localhost:5432/reachinbox"

REDIS_HOST=localhost
REDIS_PORT=6379

ELASTICSEARCH_URL="http://localhost:9200"

WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASSWORD=
EMAIL_FROM="ReachInbox Demo <no-reply@reachinbox.local>"
EMAIL_PROVIDER=brevo
BREVO_SENDER_EMAIL=verified-sender@example.com
BREVO_SENDER_NAME="Email Scheduler"
BREVO_API_KEY=
# For Brevo, EMAIL_FROM must use an active verified Brevo sender.
```

---

# Backend Setup

```bash
cd backend
npm ci
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Start the API:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

---

# Start the Email Worker

Open a second terminal:

```bash
cd production-grade-email-scheduler/backend
npm run worker
```

The worker uses:

```env
WORKER_CONCURRENCY=5
```

by default.

---

# Frontend Setup

Open another terminal:

```bash
cd production-grade-email-scheduler/frontend
npm ci
npm run dev
```

The frontend is available at:

```text
http://localhost:5173
```

# Render Backend Deployment

Deploy `backend/` as a Render Web Service with **Root Directory** set to `backend`.

```text
Build Command: npm install && npm run build && npm run db:migrate
Start Command: npm start
Worker Start Command: npm run start:worker
Health Check Path: /health
```

The build runs `prisma generate` through `npm run build`, then applies committed
Prisma migrations with `prisma migrate deploy`. `DATABASE_URL` must point to the
production PostgreSQL database during the Render build. Run the API and worker
as separate Render services/processes sharing the same Redis instance.

Required Render environment variable names:

```text
NODE_ENV
PORT
CORS_ORIGIN
DATABASE_URL
REDIS_URL
ELASTICSEARCH_URL
JWT_SECRET
FRONTEND_URL
WORKER_CONCURRENCY
MIN_DELAY_MS
MAX_EMAILS_PER_HOUR
ETHEREAL_HOST
ETHEREAL_PORT
ETHEREAL_SECURE
ETHEREAL_USER
ETHEREAL_PASSWORD
EMAIL_FROM
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
```

Set `CORS_ORIGIN` to the deployed frontend origin, such as
`https://your-frontend.vercel.app`, without a trailing slash. Multiple origins
may be comma-separated. Local development continues to use
`http://localhost:5173` and `REDIS_HOST=localhost` / `REDIS_PORT=6379`.

Required external services are PostgreSQL, hosted Redis, hosted
Elasticsearch/OpenSearch, and an SMTP provider. Google OAuth requires a Google
Cloud OAuth client.
Elasticsearch is not needed for `/health`, but is required for email search and
indexing in production.

In Google Cloud Console, add this production redirect URI, replacing the Render
service hostname:

```text
https://<your-render-service-name>.onrender.com/api/auth/google/callback
```

Set the backend variable `GOOGLE_CALLBACK_URL` to that exact URI. The local
value remains `http://localhost:4000/api/auth/google/callback`.

The frontend uses the backend `/api` proxy during local development.

If the API is deployed separately, configure:

```env
VITE_API_URL=<your-api-url>
```

---

# Docker Services

The development environment uses:

```text
PostgreSQL     → 5432
Redis          → 6379
Elasticsearch  → 9200
```

The application API and frontend run separately using Node/Vite.

---

# Scheduler Design

The scheduler deliberately does **not** use cron jobs.

When a campaign is created:

```text
Campaign
   ↓
Create Email records in PostgreSQL
   ↓
Create BullMQ delayed jobs
   ↓
Redis stores delayed-job state
   ↓
BullMQ Worker receives job
   ↓
Check idempotency
   ↓
Check hourly rate limit
   ↓
Check minimum sender delay
   ↓
Send through Ethereal SMTP
   ↓
Update PostgreSQL
   ↓
Index email in Elasticsearch
```

This architecture allows scheduled jobs to survive API and worker restarts.

---

# Rate Limiting

Each sender has:

1. A minimum delay between sends.
2. An hourly sending limit.

Redis stores distributed sender state so multiple workers can coordinate.

Example:

```env
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
```

For testing the hourly limit:

```env
MAX_EMAILS_PER_HOUR=3
```

When the limit is reached, the email job is rescheduled for the next UTC hour rather than being discarded.

---

# Reliability

The scheduler includes several reliability mechanisms:

### Persistent Scheduling

Email records are stored in PostgreSQL and BullMQ delayed jobs are stored in Redis.

### Idempotent Jobs

The email database ID is used as the BullMQ job ID.

### Duplicate Recipient Removal

Recipient lists are normalized and duplicate addresses are removed before scheduling.

### Retry Handling

Email jobs support multiple attempts with exponential backoff.

### Queue Recovery

BullMQ keeps delayed jobs in Redis, allowing workers to restart without losing scheduled jobs.

### Transactional Campaign Creation

Campaign and email records are created using a PostgreSQL transaction before queue jobs are created.

---

# Email Testing

Development email delivery uses Ethereal SMTP.

Ethereal provides a preview URL for each email, allowing delivery to be inspected without sending real production email.

The application stores the generated preview URL with the email record.

---

# Elasticsearch

Email search is provided through Elasticsearch.

Search endpoint:

```http
GET /api/emails/search?q=hello
```

This can be used to search indexed email content and metadata.

---

# BullMQ Dashboard

Bull Board is available through:

```text
http://localhost:4000/admin/queues
```

It provides visibility into:

* Waiting jobs
* Delayed jobs
* Active jobs
* Completed jobs
* Failed jobs

This is useful for verifying scheduler behavior during development and demonstrations.

---

# Security

Sensitive configuration is intentionally excluded from Git.

The following must never be committed:

```text
.env
API keys
OAuth client secrets
SMTP passwords
Private keys
Database passwords
Access tokens
```

Use `.env.example` to document required environment variables without exposing actual credentials.

---

# Testing Checklist

Before deployment or submission, verify:

* [ ] PostgreSQL starts successfully
* [ ] Redis starts successfully
* [ ] Elasticsearch starts successfully
* [ ] Backend health endpoint works
* [ ] Prisma migrations succeed
* [ ] Frontend starts successfully
* [ ] CSV recipient upload works
* [ ] Campaign scheduling works
* [ ] BullMQ delayed jobs are created
* [ ] Worker processes scheduled emails
* [ ] Ethereal preview is generated
* [ ] Email status changes to `SENT`
* [ ] Sent timestamp is stored
* [ ] Message ID is stored
* [ ] Rate limit delays jobs instead of dropping them
* [ ] Minimum delay is respected
* [ ] Worker restart does not lose scheduled jobs
* [ ] Elasticsearch search works
* [ ] Bull Board displays queue activity
* [ ] OAuth configuration is tested before enabling production authentication

---

# Production Considerations

Before using this system for real production email delivery, replace Ethereal SMTP with a production email provider and add production-grade operational controls such as:

* Secure secret management
* HTTPS
* Authentication middleware
* Authorization
* Request validation
* Structured logging
* Monitoring
* Alerting
* Bounce handling
* Email provider webhooks
* Unsubscribe management
* Retry/dead-letter policies
* Database backups
* Redis persistence and high availability
* Elasticsearch lifecycle management

---

# Environment Variables

See:

```text
backend/.env.example
```

for the complete environment variable template.

Never commit actual secret values.

---

# Available Scripts

## Backend

```bash
npm run dev
npm run worker
npm run build
npm start
npm run db:generate
npm run db:migrate
```

## Frontend

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

---

# Project Status

The project is under active development.

### Implemented

* Full-stack project structure
* React + Tailwind frontend
* Express + TypeScript backend
* PostgreSQL + Prisma
* Redis
* BullMQ delayed scheduling
* Configurable worker concurrency
* Bulk campaign scheduling
* CSV recipient parsing
* Ethereal SMTP delivery
* Email status tracking
* Idempotent queue jobs
* Redis-based sender rate limiting
* Minimum sender delay
* Elasticsearch email search
* BullMQ monitoring dashboard
* Google OAuth integration structure

### Remaining / Deployment Configuration

* Production OAuth credentials and callback configuration
* Final frontend dashboard integration
* Production deployment configuration
* Final end-to-end testing
* Production email provider configuration

---

# Author

**SaiTeja Mulinti**

GitHub:

[https://github.com/saiteja-5h0](https://github.com/saiteja-5h0)

```
