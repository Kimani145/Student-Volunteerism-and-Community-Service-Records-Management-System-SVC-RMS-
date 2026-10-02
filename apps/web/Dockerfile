FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @svc-rms/shared... --filter @svc-rms/web...

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm --filter @svc-rms/shared build
RUN pnpm --filter @svc-rms/web build
RUN pnpm prune --prod --no-optional

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

USER node

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/packages/shared ./packages/shared
COPY --chown=node:node --from=build /app/apps/web ./apps/web

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@svc-rms/web", "start"]
