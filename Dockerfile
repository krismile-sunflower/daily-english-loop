# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM base AS api

ENV NODE_ENV=production
ENV PORT=8787
ENV DATABASE_URL=file:/app/.data/local.db

EXPOSE 8787

CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm --filter @english-learning/api start"]

FROM nginx:1.27-alpine AS web

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=base /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
