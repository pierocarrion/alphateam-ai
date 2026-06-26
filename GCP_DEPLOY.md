# AlphaLead AI — GCP Staging & Production Deployment Guide

This guide walks through deploying AlphaLead AI to Google Cloud Platform (GCP) using a fully managed, serverless stack.

## GCP services used

| Service | Purpose |
|---------|---------|
| **Cloud Run** | Runs the Next.js container (HTTP requests, auto-scaling, scale-to-zero) |
| **Cloud Build** | Builds the Docker image and deploys to Cloud Run |
| **Artifact Registry** | Stores Docker images |
| **Cloud SQL (PostgreSQL)** | Managed relational database for Prisma |
| **Secret Manager** | Stores sensitive env vars (DB URL, auth, Stripe keys) |
| **Cloud Logging** | Centralized logs from Cloud Build and Cloud Run |
| **Cloud Monitoring** | Uptime checks, alerts, and dashboards |
| **Cloud Load Balancing** (optional) | Custom domain + HTTPS + CDN for production |
| **Cloud DNS** (optional) | Custom domain DNS records |
| **Vertex AI** | Gemini LLM calls for task detection, Alpha chat, and crew mood analysis |
| **Cloud Storage** (optional) | Static assets, backups, or export dumps |

## Architecture overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   User      │────▶│  Cloud Run   │────▶│  Cloud SQL  │
│  (browser)  │     │  (Next.js)   │     │ (Postgres)  │
└─────────────┘     └──────────────┘     └─────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Secret Manager │
                    │  (env vars)    │
                    └────────────────┘

Build pipeline:
Source ──▶ Cloud Build ──▶ Artifact Registry ──▶ Cloud Run
```

## One-time setup

### 1. Create a GCP project

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1

gcloud config set project $PROJECT_ID
```

### 2. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  vpcaccess.googleapis.com \
  aiplatform.googleapis.com
```

### 3. Create the Artifact Registry repository

```bash
gcloud artifacts repositories create alphalead-ai \
  --repository-format=docker \
  --location=$REGION \
  --description="AlphaLead AI container images"
```

### 4. Create the Cloud SQL PostgreSQL instance

```bash
export DB_INSTANCE=alphalead-ai-db
export DB_NAME=alphalead-ai
export DB_USER=alphalead-ai
export DB_PASSWORD=$(openssl rand -base64 24)

gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-auto-increase

gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE

gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE \
  --password=$DB_PASSWORD
```

Save the connection string:

```bash
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
```

### 5. Store secrets in Secret Manager

```bash
# Database URL
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=-

# NextAuth secret (min 32 chars)
export NEXTAUTH_SECRET=$(openssl rand -hex 32)
echo -n "$NEXTAUTH_SECRET" | gcloud secrets create nextauth-secret --data-file=-

# Stripe keys
echo -n "sk_test_..." | gcloud secrets create stripe-secret-key --data-file=-
echo -n "whsec_..." | gcloud secrets create stripe-webhook-secret --data-file=-
echo -n "pk_test_..." | gcloud secrets create stripe-public-key --data-file=-

# Stripe price IDs
echo -n "price_..." | gcloud secrets create stripe-price-team --data-file=-
echo -n "price_..." | gcloud secrets create stripe-price-business --data-file=-
```

### 6. Create a Cloud Run service account

```bash
export SERVICE_ACCOUNT=cloud-run-alphalead-ai

gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="AlphaLead Cloud Run"

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## Deploy

### 1. Run database migrations

```bash
gcloud builds submit --config cloudbuild-migrate.yaml \
  --substitutions=_REGION=$REGION,_DB_INSTANCE=$DB_INSTANCE,_DB_SECRET=database-url
```

### 2. Build and deploy the application

The Cloud Run service will receive `GOOGLE_CLOUD_PROJECT_ID`, `VERTEX_AI_LOCATION`, `GEMINI_ENABLED=true`, and `GEMINI_MODEL` automatically from `cloudbuild.yaml`. No additional Secret Manager entry is required for Vertex AI because authentication uses the Cloud Run service account IAM.

```bash
export SERVICE_NAME=alphalead-staging
export NEXTAUTH_URL="https://${SERVICE_NAME}-${PROJECT_ID_HASH}-uc.a.run.app"

gcloud builds submit --config cloudbuild.yaml \
  --substitutions=\
_REGION=$REGION,\
_SERVICE=$SERVICE_NAME,\
_NEXTAUTH_URL=$NEXTAUTH_URL,\
_SERVICE_ACCOUNT="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
```

After the first deploy, get the real URL:

```bash
gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)'
```

Update `NEXTAUTH_URL` and redeploy if needed.

### 3. Configure Stripe webhook endpoint

In the Stripe Dashboard, create a webhook endpoint pointing to:

```
https://<your-cloud-run-url>/api/stripe/webhook
```

Subscribe to these events:
- `checkout.session.completed`
- `invoice.payment_failed`
- `customer.subscription.deleted`

Copy the webhook signing secret into Secret Manager as `stripe-webhook-secret` and redeploy.

## Production checklist

- [ ] Use a dedicated Cloud SQL tier (`db-g1-small` or higher).
- [ ] Set `--max-instances` and `--concurrency` based on expected load.
- [ ] Configure a custom domain with Cloud Load Balancing + Cloud DNS.
- [ ] Enable Cloud Monitoring uptime checks and alerting.
- [ ] Set up Cloud SQL backups and point-in-time recovery.
- [ ] Restrict Cloud Run ingress to `internal-and-cloud-load-balancing` if using a load balancer.
- [ ] Rotate Stripe webhook secrets periodically.
- [ ] Enable Cloud Armor (optional) for DDoS protection.

## Local Docker smoke test

```bash
# Build
docker build -t alphalead-staging .

# Run with env file
docker run -p 3000:8080 --env-file .env alphalead-staging
```

## Useful commands

```bash
# View logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME"

# Connect to Cloud SQL locally
gcloud sql connect $DB_INSTANCE --user=$DB_USER

# Manual migration (from a machine with DB access)
export DATABASE_URL="postgresql://..."
npm run db:deploy
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `STRIPE_SECRET_KEY is not set` | Verify Secret Manager secret is attached to Cloud Run |
| `connection refused` to database | Ensure `--add-cloudsql-instances` is set and the service account has `cloudsql.client` |
| Build fails with module errors | Run `npm install` locally and commit `package-lock.json` |
| `Gemini is not enabled` | Verify `GEMINI_ENABLED=true` env var and service account has `roles/aiplatform.user` |
| `Permission denied on Vertex AI` | Ensure `aiplatform.googleapis.com` is enabled and Cloud Run service account has `roles/aiplatform.user` |
| Prisma migration fails | Run `cloudbuild-migrate.yaml` before deploying |
