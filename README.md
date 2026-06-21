# AlphaTeam AI

A gentle, anti-guilt productivity companion for individuals and teams. Mira listens to your chat, detects tasks before they become pressure, and shrinks each one into a 2-minute first step. Previously AlphaTeam AI.

Built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **Prisma**, and **PostgreSQL**.

## Features

- **Waitlist landing page** for founders and managers.
- **Team chat** with silent AI task detection.
- **2-minute unlock ritual** with affective labeling and focus companion.
- **Crew space** for team mood, load balancing, milestones, and pair-start.
- **Insights, Day mode, Night wind-down, Capture, and Settings** screens.
- **Stripe checkout and subscriptions** for team/business plans.
- **AI coordinator and health-check engine** for workspace signals.
- **Evidence collection** via in-app feedback.

## Local development

The fastest way to run the project locally is with Docker Compose. It starts PostgreSQL, generates the Prisma client, pushes the schema, and runs the Next.js dev server with hot reload.

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1. Start everything

```bash
docker-compose up --build
```

Wait until you see:

```
✅ PostgreSQL is ready
🚀 Starting Next.js dev server...
✓ Ready in ...
```

### 2. Open the app

```text
http://localhost:3000
```

### Stop

```bash
# Stop containers (keep database)
docker-compose down

# Stop and delete database
docker-compose down -v
```

### Optional: run without Docker

If you prefer to run directly on your machine:

```bash
npm install
# Start PostgreSQL manually, then:
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Tests

```bash
npm run test:run      # unit tests
npm run test:e2e      # Playwright end-to-end tests
```

## GCP deployment architecture

```
User ──▶ Cloud Run (Next.js)
            │
            ├──▶ Cloud SQL (PostgreSQL)
            ├──▶ Secret Manager (env vars)
            └──▶ Stripe (payments)

Build: Cloud Build ──▶ Artifact Registry ──▶ Cloud Run
```

### GCP services used

- **Cloud Run** — serverless container runtime
- **Cloud Build** — CI/CD pipeline
- **Artifact Registry** — Docker image storage
- **Cloud SQL (PostgreSQL)** — managed database
- **Secret Manager** — secure environment variables
- **Cloud Logging** — centralized logs
- **Cloud Monitoring** — metrics, uptime checks, alerts
- **Cloud Load Balancing** (optional) — custom domains and CDN
- **Cloud DNS** (optional) — domain DNS
- **Vertex AI** (optional) — future LLM features
- **Cloud Storage** (optional) — backups and exports

### Deploy to staging

1. Follow the one-time setup in [`GCP_DEPLOY.md`](./GCP_DEPLOY.md).
2. Run migrations:

```bash
gcloud builds submit --config cloudbuild-migrate.yaml
```

3. Build and deploy:

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_NEXTAUTH_URL=https://<your-url>.run.app
```

Detailed instructions, service account setup, and production checklist are in [`GCP_DEPLOY.md`](./GCP_DEPLOY.md).

## Project structure

```
src/
  app/           # Next.js App Router pages and API routes
  features/      # Domain-driven modules (auth, chat, tasks, rituals)
  server/lib/    # Prisma, Stripe, AI coordinator, health engine
  shared/ui/     # Reusable UI components (Mira, Button, etc.)
prisma/          # Schema, migrations
scripts/         # Evidence export and utilities
```

## Hackathon deliverables

See [`HACKATHON.md`](./HACKATHON.md) for narrative, demo flow, evidence collection, and export script.

## License

Private — built for the hackathon.
