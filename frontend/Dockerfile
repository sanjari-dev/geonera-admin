# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve static files with nginx ────────────────────────────────────
FROM nginx:alpine AS runner
LABEL maintainer="sansalfian"
LABEL org.opencontainers.image.title="geonera-admin-frontend"
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template
ENV BACKEND_HOST=geonera-admin-backend
ENV BACKEND_PORT=3001
EXPOSE 80
# envsubst hanya mengganti $BACKEND_HOST dan $BACKEND_PORT; nginx vars ($uri, $host, dll.) tetap utuh
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOST} ${BACKEND_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
