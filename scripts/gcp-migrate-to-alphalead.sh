#!/usr/bin/env bash
# =============================================================================
# Migrate GCP resources: alphateam-*  ->  alphalead-*
# Project: alphalead-ai
# Strategy: Option A (create new resources, migrate data, cutover, cleanup).
#
# Resources migrated:
#   Artifact Registry  : alphateam-ai   -> alphalead-ai
#   Cloud SQL instance : alphateam-db   -> alphalead-db
#   Cloud SQL database : alphateam      -> alphalead
#   Cloud SQL user     : alphateam      -> alphalead
#   Service Account    : cloud-run-alphateam-ai@  -> cloud-run-alphalead-ai@
#   Cloud Run service  : alphateam      -> alphalead
#
# Secrets (database-url, nextauth-secret, stripe-*) keep their names since they
# have no alphateam prefix. Only the VALUE of database-url changes (points to
# the new instance), which intentionally breaks the old service after cutover.
#
# Prerequisites:
#   - gcloud installed and authenticated:  gcloud auth login
#   - Active project:                      gcloud config set project alphalead-ai
#   - Cloud SQL Admin API enabled
#   - Run from repo root.
# =============================================================================

set -euo pipefail

# ---- Configuration ----------------------------------------------------------
PROJECT_ID="alphalead-ai"
REGION="us-central1"

OLD_INSTANCE="alphateam-db"
NEW_INSTANCE="alphalead-db"

OLD_DB="alphateam"
NEW_DB="alphalead"

OLD_USER="alphateam"
NEW_USER="alphalead"

OLD_REPO="alphateam-ai"
NEW_REPO="alphalead-ai"

OLD_SA="cloud-run-alphateam-ai@${PROJECT_ID}.iam.gserviceaccount.com"
NEW_SA_NAME="cloud-run-alphalead-ai"
NEW_SA="${NEW_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

OLD_SERVICE="alphateam"
NEW_SERVICE="alphalead"

DOMAIN="alphalead.space"

# Roles to mirror from old SA to new SA
ROLES=(
  roles/cloudsql.client
  roles/secretmanager.secretAccessor
  roles/logging.logWriter
  roles/monitoring.metricWriter
  roles/aiplatform.user
  roles/run.admin
)

# ---- Helpers ----------------------------------------------------------------
confirm() {
  if [[ -z "${YES:-}" ]]; then
    read -r -p "$(tput bold)$1$(tput sgr0) [y/N] " ans
    [[ "${ans,,}" == "y" ]] || { echo "Aborted."; exit 1; }
  fi
}

step() { echo; echo "$(tput setaf 2)[$(date +%H:%M:%S)]$(tput sgr0) $(tput bold)$*$(tput sgr0)"; }
info() { echo "      $*"; }
warn() { echo "$(tput setaf 3)      WARN: $*$(tput sgr0)"; }

# ---- Pre-flight -------------------------------------------------------------
step "Pre-flight checks"
gcloud config set project "$PROJECT_ID"
info "Project: $PROJECT_ID"
info "Region:  $REGION"
info ""
info "This script will CREATE new alphalead-* resources, MIGRATE data, "
info "CUTOVER the database-url secret (old service will stop working),"
info "and optionally DELETE the old alphateam-* resources."
info ""
confirm "Continue with migration?"

# =============================================================================
# STEP 1 — Artifact Registry
# =============================================================================
step "1/7 Artifact Registry: create ${NEW_REPO}"
if gcloud artifacts repositories describe "$NEW_REPO" \
     --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  info "Repository ${NEW_REPO} already exists. Skipping."
else
  gcloud artifacts repositories create "$NEW_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="AlphaLead AI container images"
  info "Created ${NEW_REPO}."

  # Copy existing images from old repo (optional, keeps rollback image history)
  if gcloud artifacts repositories describe "$OLD_REPO" \
       --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    info "Copying images from ${OLD_REPO} to ${NEW_REPO}..."
    images=$(gcloud artifacts docker images list \
      "${REGION}-docker.pkg.dev/${PROJECT_ID}/${OLD_REPO}" \
      --format="value(package)")
    for img in $images; do
      for tag in latest $(gcloud artifacts docker images list \
          "${REGION}-docker.pkg.dev/${PROJECT_ID}/${OLD_REPO}/${img}" \
          --format="value(tags)" 2>/dev/null | tr ',' '\n'); do
        [[ -z "$tag" ]] && continue
        gcloud artifacts docker images add-tag \
          "${REGION}-docker.pkg.dev/${PROJECT_ID}/${OLD_REPO}/${img}@${tag}" \
          "${REGION}-docker.pkg.dev/${PROJECT_ID}/${NEW_REPO}/${img}:${tag}" \
          --quiet || warn "Could not copy ${img}:${tag}"
      done
    done
  fi
fi

# =============================================================================
# STEP 2 — Cloud SQL: create new instance
# =============================================================================
step "2/7 Cloud SQL: create instance ${NEW_INSTANCE}"
if gcloud sql instances describe "$NEW_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  info "Instance ${NEW_INSTANCE} already exists. Skipping creation."
else
  info "Creating ${NEW_INSTANCE} (db-f1-micro, POSTGRES_16). This takes 2-5 minutes..."
  gcloud sql instances create "$NEW_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --edition=ENTERPRISE \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-auto-increase \
    --project="$PROJECT_ID"
fi

# =============================================================================
# STEP 3 — Cloud SQL: database, user, and data migration
# =============================================================================
step "3/7 Cloud SQL: create database + user"
if ! gcloud sql databases describe "$NEW_DB" --instance="$NEW_INSTANCE" \
       --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql databases create "$NEW_DB" --instance="$NEW_INSTANCE" \
    --project="$PROJECT_ID"
  info "Created database ${NEW_DB}."
else
  info "Database ${NEW_DB} already exists."
fi

NEW_DB_PASSWORD="$(openssl rand -base64 24)"
if ! gcloud sql users describe "$NEW_USER" --instance="$NEW_INSTANCE" \
       --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql users create "$NEW_USER" \
    --instance="$NEW_INSTANCE" \
    --password="$NEW_DB_PASSWORD" \
    --project="$PROJECT_ID"
  info "Created user ${NEW_USER}."
else
  info "User ${NEW_USER} already exists. Resetting password..."
  gcloud sql users set-password "$NEW_USER" \
    --instance="$NEW_INSTANCE" \
    --password="$NEW_DB_PASSWORD" \
    --project="$PROJECT_ID"
fi

step "3b/7 Cloud SQL: migrate data ${OLD_DB} -> ${NEW_DB}"
info "Dumping ${OLD_INSTANCE}/${OLD_DB} via Cloud SQL proxy..."
mkdir -p .migration
 trap 'rm -rf .migration' EXIT

# Start proxy on both instances
curl -sSLo cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

OLD_PW=$(gcloud sql users list --instance="$OLD_INSTANCE" --project="$PROJECT_ID" \
  --format='value(password)' 2>/dev/null || true)
# Cloud SQL does not return passwords; the user must supply the OLD password.
if [[ -z "${OLD_DB_PASSWORD_USER:-}" ]]; then
  warn "Cloud SQL does not expose passwords."
  warn "Set OLD_DB_PASSWORD_USER env var with the password of '${OLD_USER}' on '${OLD_INSTANCE}'."
  warn "If you do not have it, data migration will be skipped (schema will be created by Prisma migrations later)."
  SKIP_DATA_MIGRATION=1
else
  ./cloud-sql-proxy --structured-logs \
    --instances="${PROJECT_ID}:${REGION}:${OLD_INSTANCE}=tcp:5433" \
    --instances="${PROJECT_ID}:${REGION}:${NEW_INSTANCE}=tcp:5434" &
  PROXY_PID=$!
  trap 'kill $PROXY_PID 2>/dev/null || true; rm -rf .migration cloud-sql-proxy' EXIT
  info "Waiting for proxy..."
  sleep 8

  PGPASSWORD="$OLD_DB_PASSWORD_USER" pg_dump \
    --host=127.0.0.1 --port=5433 --username="$OLD_USER" \
    --no-owner --no-acl --dbname="$OLD_DB" \
    --file=.migration/dump.sql

  PGPASSWORD="$NEW_DB_PASSWORD" psql \
    --host=127.0.0.1 --port=5434 --username="$NEW_USER" \
    --dbname="$NEW_DB" \
    --file=.migration/dump.sql

  info "Data migrated: $(wc -l < .migration/dump.sql) lines."
fi

# =============================================================================
# STEP 4 — Service Account
# =============================================================================
step "4/7 IAM: create service account ${NEW_SA}"
if gcloud iam service-accounts describe "$NEW_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  info "Service account ${NEW_SA} already exists."
else
  gcloud iam service-accounts create "$NEW_SA_NAME" \
    --display-name="AlphaLead Cloud Run" \
    --project="$PROJECT_ID"
  info "Created ${NEW_SA}."
fi

step "4b/7 IAM: mirror roles from ${OLD_SA}"
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${NEW_SA}" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null || warn "Could not bind $ROLE"
  info "Bound $ROLE"
done

# =============================================================================
# STEP 5 — Secret Manager: update database-url
# =============================================================================
step "5/7 Secret Manager: update database-url -> ${NEW_INSTANCE}"
NEW_DATABASE_URL="postgresql://${NEW_USER}:${NEW_DB_PASSWORD}@/${NEW_DB}?host=/cloudsql/${PROJECT_ID}:${REGION}:${NEW_INSTANCE}"

warn "This will change the value of secret 'database-url'."
warn "The OLD Cloud Run service '${OLD_SERVICE}' will stop working immediately after."
confirm "Proceed to update database-url?"

if gcloud secrets describe database-url --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo -n "$NEW_DATABASE_URL" | gcloud secrets versions add database-url \
    --data-file=- --project="$PROJECT_ID"
  info "Updated secret database-url (new version)."
else
  echo -n "$NEW_DATABASE_URL" | gcloud secrets create database-url \
    --data-file=- --project="$PROJECT_ID"
  info "Created secret database-url."
fi

# =============================================================================
# STEP 6 — Deploy new Cloud Run service
# =============================================================================
step "6/7 Cloud Run: deploy ${NEW_SERVICE}"
info "Submitting cloudbuild.yaml (build + push + deploy)..."
info "This takes 5-10 minutes."

gcloud builds submit . \
  --config=cloudbuild.yaml \
  --substitutions="_REGION=${REGION},_REPO=${NEW_REPO},_SERVICE=${NEW_SERVICE},_DB_INSTANCE=${NEW_INSTANCE},_SERVICE_ACCOUNT=${NEW_SA},_NEXTAUTH_URL=https://${DOMAIN}" \
  --project="$PROJECT_ID"

NEW_URL=$(gcloud run services describe "$NEW_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)')
info "New service URL: ${NEW_URL}"

# =============================================================================
# STEP 7 — Domain mapping
# =============================================================================
step "7/7 Cloud Run: map domain ${DOMAIN} -> ${NEW_SERVICE}"
if gcloud run domain-mappings describe "$DOMAIN" \
     --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  info "Domain mapping for ${DOMAIN} already exists."
  info "If it pointed to the old service, you must delete and re-create:"
  info "  gcloud run domain-mappings delete ${DOMAIN} --region=${REGION} --project=${PROJECT_ID}"
  info "  gcloud run domain-mappings create --service=${NEW_SERVICE} --domain=${DOMAIN} --region=${REGION}"
else
  gcloud run domain-mappings create \
    --service="$NEW_SERVICE" \
    --domain="$DOMAIN" \
    --region="$REGION" \
    --project="$PROJECT_ID" || warn "Could not create mapping (may already be a Firebase mapping)."
fi

# =============================================================================
# Summary + Cleanup checklist
# =============================================================================
step "Migration complete"
cat <<EOF

$(tput bold)New resources:$(tput sgr0)
  Artifact Registry : ${REGION}-docker.pkg.dev/${PROJECT_ID}/${NEW_REPO}
  Cloud SQL         : ${NEW_INSTANCE} / db: ${NEW_DB} / user: ${NEW_USER}
  Service Account   : ${NEW_SA}
  Cloud Run         : ${NEW_SERVICE}
  URL               : ${NEW_URL}
  Domain            : https://${DOMAIN}

$(tput bold)Save this DB password (will not be shown again):$(tput sgr0)
  ${NEW_DB_PASSWORD}

$(tput bold)Next steps (manual):$(tput sgr0)
  1. Verify https://${DOMAIN} works end-to-end (sign up, login, etc).
  2. Update Stripe webhook endpoint to the new URL (Stripe dashboard).
  3. Update GitHub Actions secrets if any reference ${OLD_SERVICE}.
  4. In Firebase Hosting, connect custom domain ${DOMAIN} to the new
     Cloud Run service (or verify the existing mapping points to ${NEW_SERVICE}).
  5. After 24-48h of stable operation, clean up old resources:

$(tput setaf 1)# Rollback / cleanup of OLD resources (DESTRUCTIVE):$(tput sgr0)
      gcloud run services delete ${OLD_SERVICE} \\
        --region=${REGION} --project=${PROJECT_ID}
      gcloud sql instances delete ${OLD_INSTANCE} --project=${PROJECT_ID}
      gcloud artifacts repositories delete ${OLD_REPO} \\
        --location=${REGION} --project=${PROJECT_ID}
      gcloud iam service-accounts delete ${OLD_SA} --project=${PROJECT_ID}

  6. Update NEXTAUTH_URL in production env if you want to enforce the new
     domain immediately.
EOF
