# AlphaTeam AI — Hackathon Deliverable

## 30-second narrative

Procrastination is not a time problem; it is an emotion problem. Most productivity tools shame users with overdue lists, broken streaks, and public scores. **AlphaTeam AI** does the opposite.

Mira, our gentle companion orb, listens to team chat, detects tasks before they become pressure, and shrinks each one into a 2-minute first step. No guilt, no piles, no streaks — just a kind nudge to begin.

For teams, AlphaTeam adds a quiet layer of care: a Crew space that spots load imbalance, pairs people for hard starts, and tracks recovered time instead of hours lost.

## What we built

| Module | Status |
|--------|--------|
| Landing page + waitlist | ✅ Live, tested |
| Extended Prisma schema (B2B, Stripe, Waitlist) | ✅ Validated via `prisma generate` |
| 7 coming-soon screens (Crew, Insights, Day, Settings, Night, Capture, Me) | ✅ Migrated to Next.js |
| GCP staging setup | ✅ Dockerfile + Cloud Build + Cloud Run docs |
| AI agents (detector, coordinator, check engine) | ✅ Code + tests |
| Stripe checkout + subscriptions | ✅ API routes + schema |
| Customer onboarding + evidence collection | ✅ Feedback widget + API |

## Demo flow (2 minutes)

1. **Landing** — founder/manager sees value prop and joins waitlist.
2. **Home** — one immediate, tiny step is surfaced; the rest is hidden.
3. **Chat** — type “I need to write the launch report”; Mira quietly detects it.
4. **Task sheet** — accept the AI-shrunken first step.
5. **Ritual** — pick a feeling, validate it, start the 2-minute unlock.
6. **Focus** — a calm timer with Mira; no countdown pressure.
7. **Reward** — celebrate starting and see recovered minutes.
8. **Crew** — check team mood, load guardian, milestone, pair-start.
9. **Settings** — share evidence/feedback for the hackathon.

## Evidence to collect

Use the Feedback widget in Settings, or call `POST /api/feedback`:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"type":"testimonial","content":"...","tags":["hackathon"]}'
```

Metrics we care about:
- Waitlist signups (`Waitlist` table)
- Recovered minutes per user (`UserMetric` type `recovered_minutes`)
- Tasks detected and started (`Task` + `RitualSession`)
- Team mood and load signals (`TeamMetric`, `HealthSignal`)
- Qualitative feedback (`Feedback` table)

Export a summary:

```bash
npx tsx scripts/export-evidence.ts
```

## Tech stack

- Next.js 16 App Router + React 19
- TypeScript + Tailwind CSS v4
- Prisma + PostgreSQL (Cloud SQL on GCP)
- NextAuth.js
- Stripe
- GCP: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL, Secret Manager, Cloud Logging, Cloud Monitoring, Vertex AI (Gemini)

## GCP architecture

```
User ──▶ Cloud Run (Next.js container)
            │
            ├──▶ Cloud SQL (PostgreSQL)
            ├──▶ Secret Manager (DATABASE_URL, NEXTAUTH_SECRET, Stripe keys)
            ├──▶ Vertex AI (Gemini 2.5 Flash)
            └──▶ Stripe (checkout + webhooks)

Build:
Git/Local ──▶ Cloud Build ──▶ Artifact Registry ──▶ Cloud Run
```

All services are fully managed, serverless, and scale automatically. See [GCP_DEPLOY.md](./GCP_DEPLOY.md) for the full one-time setup and production checklist.

## Deploy to staging

```bash
# 1. Run migrations
gcloud builds submit --config cloudbuild-migrate.yaml

# 2. Build and deploy
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_NEXTAUTH_URL=https://<your-service-url>.run.app
```

For detailed setup (APIs, Cloud SQL, Secret Manager, service account), see [GCP_DEPLOY.md](./GCP_DEPLOY.md).

## Team & roles

- Landing, narrative, waitlist
- Schema + seed + B2B models
- Screen migration + shared UI
- GCP + DevOps
- AI agents + coordinator
- Stripe + subscriptions
- Onboarding + evidence

## Gemini integration notes

- Gemini is used via **Vertex AI** in GCP.
- The default model is **Gemini 2.5 Flash** (cheap + fast).
- All task detection, Mira chat, and crew mood analysis fallback to the existing heuristic engine if Gemini is disabled or fails.
- In production, `GEMINI_ENABLED=true` is set automatically by `cloudbuild.yaml`.
- Local dev can run without Gemini by leaving `GEMINI_ENABLED=false`.

## Next 48 hours

1. Run end-to-end smoke tests on staging.
2. Record 2-minute demo video.
3. Collect 5+ founder/manager testimonials via waitlist + feedback widget.
4. Submit evidence export with the project.
