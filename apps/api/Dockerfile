# syntax=docker/dockerfile:1
# Сборка ведётся из корня монорепо: docker build -f apps/api/Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl нужен движку Prisma; bookworm-slim идёт без него.
RUN corepack enable \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- зависимости -----------------------------------------------------------
# Копируем только манифесты: слой переустанавливается лишь когда меняется
# package.json или лок-файл, а не на каждую правку исходников.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/terrain/package.json packages/terrain/
RUN pnpm install --frozen-lockfile

# --- сборка ----------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @favplace/shared build \
	&& pnpm --filter @favplace/terrain build \
	&& pnpm --filter @favplace/api exec prisma generate \
	&& pnpm --filter @favplace/api build
# Выбрасываем dev-зависимости и заново генерируем клиент Prisma —
# prune сносит ранее сгенерированный клиент из дерева node_modules.
RUN pnpm install --frozen-lockfile --prod \
	&& pnpm --filter @favplace/api exec prisma generate

# --- рантайм ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app /app
WORKDIR /app/apps/api
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
