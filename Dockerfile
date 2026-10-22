# syntax=docker/dockerfile:1.7
# Multi-arch (linux/arm64 AWS Graviton & linux/amd64) Dockerfile for Meterbox
# Supports:
#   --target backend   -> Ultra-light Alpine image running the Go control plane & OpenMeter gateway (:6071, :8888)
#   --target frontend  -> Node 20 Alpine image running the Next.js console (:6070)
#   (default target)   -> Combined runtime starting both backend (:6071/:8888) and frontend (:6070)

# -----------------------------------------------------------------------------
# Stage 1: Build Go Backend (Native static ARM64 / AMD64 binary)
# -----------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS backend-builder
ARG TARGETOS=linux
ARG TARGETARCH=arm64

WORKDIR /src/backend
COPY backend/go.mod ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/meterbox ./cmd/meterbox

# -----------------------------------------------------------------------------
# Stage 2: Build Next.js Frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm ci || npm install

COPY frontend/ ./
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Target A: Dedicated Go Backend Runtime (--target backend)
# -----------------------------------------------------------------------------
FROM alpine:3.20 AS backend
RUN apk add --no-cache ca-certificates tzdata wget && mkdir -p /app/data
WORKDIR /app

COPY --from=backend-builder /out/meterbox /usr/local/bin/meterbox
COPY infra/ /app/infra/

ENV METERBOX_ADDR=:6071
ENV METERBOX_STATE_FILE=/app/data/meterbox_state.json

EXPOSE 6071 8888
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:6071/healthz || exit 1

CMD ["meterbox"]

# -----------------------------------------------------------------------------
# Target B: Dedicated Next.js Console Runtime (--target frontend)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend
RUN apk add --no-cache libc6-compat wget
WORKDIR /app/frontend

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=6070

COPY --from=frontend-builder /src/frontend/package*.json ./
COPY --from=frontend-builder /src/frontend/node_modules ./node_modules
COPY --from=frontend-builder /src/frontend/.next ./.next
COPY --from=frontend-builder /src/frontend/public ./public

EXPOSE 6070
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:6070/ || exit 1

CMD ["npm", "run", "start"]

# -----------------------------------------------------------------------------
# Target C (Default): Unified All-in-One Container (Backend + Frontend)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache ca-certificates tzdata wget && mkdir -p /app/data
WORKDIR /app

COPY --from=backend-builder /out/meterbox /usr/local/bin/meterbox
COPY --from=frontend-builder /src/frontend /app/frontend

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV METERBOX_ADDR=:6071
ENV METERBOX_STATE_FILE=/app/data/meterbox_state.json

EXPOSE 6070 6071 8888

CMD ["/bin/sh", "-c", "meterbox & cd /app/frontend && npm run start"]
