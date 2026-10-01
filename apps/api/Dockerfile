FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @svc-rms/shared... --filter @svc-rms/api...

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @svc-rms/shared build
RUN pnpm --filter @svc-rms/api exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @svc-rms/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
