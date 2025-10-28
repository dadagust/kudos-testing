# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache libc6-compat \
    && corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .prettierrc ./
COPY frontend/package.json ./frontend/package.json
COPY staff ./staff

WORKDIR /app/staff
RUN pnpm install --frozen-lockfile \
    && pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
