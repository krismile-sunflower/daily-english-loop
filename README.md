# English Learning MVP

A full-stack English learning loop for Chinese learners:

Register or log in, choose a level, learn vocabulary, review due cards, complete lessons, practice, and track daily progress.

## Stack

- Web: Vite, React, TypeScript, TanStack Router, TanStack Query, Tailwind CSS, shadcn-style local UI components
- API: Hono, Drizzle ORM, SQLite via libSQL, Zod, HTTP-only JWT cookie auth
- Workspace: pnpm monorepo with shared Zod schemas in `packages/shared`

## Commands

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app runs on `http://localhost:5173` and the API runs on `http://localhost:8787`.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Docker Deploy

This repo includes a single-server Docker Compose setup:

- `web`: nginx serves the built React app and proxies `/api` to the API service.
- `api`: Hono runs on port `8787`, runs migrations and seed on startup, and stores SQLite data in the `api-data` Docker volume.

On the server:

```bash
cp .env.example .env

# Edit .env before starting. For direct IP testing, use:
# WEB_ORIGIN=http://your-server-ip:9000
# WEB_PORT=9000
# COOKIE_SECURE=false
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=replace-with-a-secure-admin-password

docker compose up -d --build
```

The first API start downloads the vocabulary sources, seeds the SQLite database, and creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Do not commit `.data`; production data is kept in the Docker volume.

The default Docker frontend port is `9000`, so direct testing is available at `http://your-server-ip:9000`.

For production auth cookies, serve the app over HTTPS. If another reverse proxy terminates TLS, keep `COOKIE_SECURE=true` and set `WEB_ORIGIN` to your HTTPS domain. For temporary HTTP-only testing by IP address, set `COOKIE_SECURE=false`.
