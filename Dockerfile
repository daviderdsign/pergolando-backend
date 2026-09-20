FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# The @pergolando/shared git dependency's "prepare" script needs git + a full
# devDependency install (it compiles itself from TypeScript on install).
RUN apt-get update && apt-get install -y --no-install-recommends git openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Only needs to be RESOLVABLE for `prisma generate` (part of postinstall) —
# not a real connection; the runtime container gets the real value at `docker run`.
ENV DATABASE_URL="file:./data/db.sqlite"
# prisma.config.ts must exist before `pnpm install` runs postinstall's
# `prisma generate` (Prisma 7 looks for it at the project root).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build

FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
# Full node_modules (including devDependencies) so `prisma migrate deploy`
# can run at container startup — see docker-compose.dev.yml's backend command.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
