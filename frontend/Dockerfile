# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache libc6-compat \
    && corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .prettierrc ./
COPY staff/package.json ./staff/package.json
COPY frontend ./frontend

WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile \
    && npx prettier --write . \
    && pnpm build

EXPOSE 4000

CMD ["pnpm", "start"]
