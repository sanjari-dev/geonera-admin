# ── Stage 1: Install deps & generate Prisma client ───────────────────────────
FROM oven/bun:1-alpine AS deps
# openssl diperlukan agar prisma generate mendeteksi OpenSSL 3.x
# dan menghasilkan engine linux-musl-openssl-3.0.x (bukan linux-musl/1.1.x)
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
RUN bunx prisma generate

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
LABEL maintainer="sansalfian"
LABEL org.opencontainers.image.title="geonera-admin-backend"
# curl  → healthcheck endpoint
# openssl → Prisma runtime mendeteksi OpenSSL 3.x dan memuat engine yang tepat
RUN apk add --no-cache curl openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3001
USER bun
CMD ["bun", "run", "src/index.ts"]
