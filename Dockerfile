FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.12.2 --activate

# 国内构建加速：使用 npmmirror（原淘宝源）
ENV npm_config_registry=https://registry.npmmirror.com

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig packages/tsconfig

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @native-location/shared build \
  && pnpm --filter @native-location/api prisma:generate \
  && pnpm --filter @native-location/api build

ENV NODE_ENV=production
ENV PORT=18156
WORKDIR /app/apps/api
EXPOSE 18156

CMD ["sh", "-c", "pnpm prisma:migrate:deploy && node dist/main.js"]
