FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @svc-rms/shared... --filter @svc-rms/api...

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY scripts ./scripts

RUN pnpm --filter @svc-rms/shared build
RUN pnpm --filter @svc-rms/api exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @svc-rms/api build
RUN pnpm prune --prod --no-optional

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN mkdir -p /app/storage && chown -R node:node /app

USER node

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/packages/shared ./packages/shared
COPY --chown=node:node --from=build /app/apps/api ./apps/api
COPY --chown=node:node --from=build /app/scripts ./scripts

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
