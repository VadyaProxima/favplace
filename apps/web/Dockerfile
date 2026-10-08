# syntax=docker/dockerfile:1
# Сборка ведётся из корня монорепо: docker build -f apps/web/Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- зависимости -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/terrain/package.json packages/terrain/
# Ставим только фронт и его зависимости — бэковые в образе не нужны.
RUN pnpm install --frozen-lockfile --filter @favplace/web...

# --- сборка ----------------------------------------------------------------
FROM deps AS build
# Раскладку standalone включаем только здесь: см. комментарий в next.config.ts.
ENV NEXT_OUTPUT_STANDALONE=1
COPY . .
RUN pnpm --filter @favplace/shared build \
	&& pnpm --filter @favplace/web build

# --- рантайм ---------------------------------------------------------------
# output: 'standalone' уже собрал минимальный серверный бандл со своими
# node_modules, поэтому pnpm в финальном образе не нужен.
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# Без этого standalone-сервер слушает localhost и снаружи контейнера недоступен.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
