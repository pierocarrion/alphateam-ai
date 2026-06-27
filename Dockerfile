# syntax=docker/dockerfile:1

# -------------------- Build stage --------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# -------------------- Production stage --------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy the full build artifact + node_modules, then prune devDependencies.
# This shrinks the shipped image considerably.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["npm", "run", "start"]
