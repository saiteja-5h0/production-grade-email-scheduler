# Production-Grade Email Scheduler

*A full-stack student project for composing email campaigns, scheduling them for later, and tracking their outcomes from a dashboard.*

## 🌐 Live Demo

[Open the email scheduler](https://frontend-three-ebon-77.vercel.app/)

## 💻 GitHub Repository

[production-grade-email-scheduler](https://github.com/saiteja-5h0/production-grade-email-scheduler)

---

## 📖 About

Production-Grade Email Scheduler demonstrates the workflow of an email scheduling platform. A user composes a message, chooses when it should be processed, and follows its status in the dashboard.

The project uses a PostgreSQL database to save campaigns and email records. Durable workflows process scheduled messages, while Google sign-in and Slack integration are available where configured.

### Features

- Compose email campaigns and schedule them for now or a future time
- Track scheduled, sent, and failed outcomes in the dashboard
- Search email records and review their status
- Apply sender spacing and hourly sending limits
- Sign in with Google and connect Slack where configured
- Store scheduling and delivery state in PostgreSQL

### Email Simulation Notice

This is an educational student project. **No real email is sent.** When a scheduled email is processed, the app randomly records a simulated success or failure. About one in five processed emails is expected to fail, so the dashboard can demonstrate both outcomes. “Sent” means simulated success only.

## 🛠 Tech Stack

- React, TypeScript, and Vite
- Node.js, Express, and Nitro
- PostgreSQL and Prisma
- Vercel Functions and durable Workflows
- Google OAuth and Slack integration

## 🚀 Run Locally

Prerequisites: Node.js 22.12 or newer and PostgreSQL. Set the required local database and OAuth values in `backend/.env` using `backend/.env.example` as a reference. Do not commit credentials.

Start the backend:

```bash
cd backend
npm ci
npm run db:generate
npm run dev
```

In another terminal, start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

## 👨‍💻 Developer

**SaiTeja Mulinti**

[GitHub profile](https://github.com/saiteja-5h0)
