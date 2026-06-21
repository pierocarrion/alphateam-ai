#!/usr/bin/env bash
# One-time GCP setup for AlphaTeam AI on project alphalead-ai.
# Run this after installing gcloud and running:
#   gcloud auth login
#   gcloud config set project alphalead-ai

set -euo pipefail

PROJECT_ID="alphalead-ai"
REGION="us-central1"
DB_INSTANCE="alphateam-db"
DB_NAME="alphateam"
DB_USER="alphateam"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24)}"
SERVICE_ACCOUNT="cloud-run-alphateam-ai"
SERVICE_NAME="alphateam"

echo "=== GCP setup for AlphaTeam AI ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# 1. Verify project
gcloud config set project "$PROJECT_ID"

# 2. Enable APIs
echo "Enabling APIs..."
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

# 3. Create Artifact Registry
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create alphateam-ai \
  --repository-format=docker \
  --location="$REGION" \
  --description="AlphaTeam AI container images" || true

# 4. Create Cloud SQL PostgreSQL instance
echo "Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --edition=ENTERPRISE \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-auto-increase || true

gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" || true

gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD" || true

# 5. Store secrets
echo "Storing secrets in Secret Manager..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=- || true

NEXTAUTH_SECRET="$(openssl rand -hex 32)"
echo -n "$NEXTAUTH_SECRET" | gcloud secrets create nextauth-secret --data-file=- || true

# Stripe placeholders — replace with real values before deploying
# echo -n "sk_test_..." | gcloud secrets create stripe-secret-key --data-file=- || true
# echo -n "whsec_..."  | gcloud secrets create stripe-webhook-secret --data-file=- || true
# echo -n "pk_test_..." | gcloud secrets create stripe-public-key --data-file=- || true
# echo -n "price_..." | gcloud secrets create stripe-price-team --data-file=- || true
# echo -n "price_..." | gcloud secrets create stripe-price-business --data-file=- || true

# 6. Create Cloud Run service account
echo "Creating Cloud Run service account..."
gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
  --display-name="AlphaTeam Cloud Run" || true

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter roles/monitoring.metricWriter roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="$ROLE" || true
done

echo ""
echo "=== Setup complete ==="
echo "Database password (save this somewhere safe): $DB_PASSWORD"
echo "Service account: $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "Next steps:"
echo "1. Add your real Stripe secrets to Secret Manager."
echo "2. Run migrations: gcloud builds submit --config cloudbuild-migrate.yaml --substitutions=_REGION=$REGION,_DB_INSTANCE=$DB_INSTANCE,_DB_SECRET=database-url"
echo "3. Deploy: gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=$REGION,_SERVICE=$SERVICE_NAME,_NEXTAUTH_URL=https://<your-url>.run.app,_SERVICE_ACCOUNT=$SERVICE_ACCOUNT_EMAIL"
