# syntax=docker/dockerfile:1

# -------------------- Build stage --------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Prisma needs a DATABASE_URL to resolve the adapter config during generate.
# The value below is a harmless placeholder; replace at runtime via env vars.
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# -------------------- Production stage --------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy the full build artifact + node_modules (incl. generated Prisma client),
# then prune devDependencies. Prisma's generated client lives under
# node_modules/.prisma and node_modules/@prisma/client and is a production
# dependency, so it survives the prune. This shrinks the shipped image from
# ~1.4 GB to ~400 MB, which speeds up the registry push considerably.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["npm", "run", "start"]
