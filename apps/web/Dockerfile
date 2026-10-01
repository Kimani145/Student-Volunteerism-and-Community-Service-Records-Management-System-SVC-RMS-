FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
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

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/web ./apps/web

EXPOSE 3000
CMD ["pnpm", "--filter", "@svc-rms/web", "start"]
