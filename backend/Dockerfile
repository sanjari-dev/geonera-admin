# ── Stage 1: Install deps & generate Prisma client ───────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
RUN bunx prisma generate

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
LABEL maintainer="sansalfian"
LABEL org.opencontainers.image.title="geonera-admin-backend"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3001
USER bun
CMD ["bun", "run", "src/index.ts"]
