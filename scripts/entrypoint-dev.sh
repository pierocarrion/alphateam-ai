#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

echo "🗄️ Pushing schema to database..."
npx drizzle-kit push

echo "🚀 Starting Next.js dev server..."
npm run dev
