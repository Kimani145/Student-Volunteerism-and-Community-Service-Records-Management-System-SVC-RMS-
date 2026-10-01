# Student Volunteerism and Community Service Records Management System (SVC-RMS)

## Quickstart

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
cp .env.example .env
docker compose -f ops/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit:verify
pnpm trace:check
```
