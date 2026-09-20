FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# The @pergolando/shared git dependency's "prepare" script needs git + a full
# devDependency install (it compiles itself from TypeScript on install).
RUN apt-get update && apt-get install -y --no-install-recommends git openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
