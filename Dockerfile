# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS builder

ENV SCARF_ANALYTICS=false

WORKDIR /app
RUN set -eu; \
    for attempt in 1 2 3 4 5; do \
      if apt-get -o Acquire::Retries=5 update \
        && apt-get -o Acquire::Retries=5 install -y --no-install-recommends openssl; then \
        rm -rf /var/lib/apt/lists/*; \
        break; \
      fi; \
      rm -rf /var/lib/apt/lists/*; \
      if [ "$attempt" = 5 ]; then exit 1; fi; \
      sleep "$((attempt * 2))"; \
    done
RUN set -eu; \
    corepack enable; \
    for attempt in 1 2 3 4 5; do \
      if corepack prepare pnpm@10.11.0 --activate; then break; fi; \
      if [ "$attempt" = 5 ]; then exit 1; fi; \
      sleep "$((attempt * 2))"; \
    done

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=lanting-backend-bio-pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=lanting-backend-bio-prisma,target=/root/.cache/prisma \
    pnpm install --frozen-lockfile --ignore-scripts
RUN --mount=type=cache,id=lanting-backend-bio-prisma,target=/root/.cache/prisma \
    set -eu; \
    for attempt in 1 2 3 4 5; do \
      if pnpm rebuild @prisma/client @prisma/engines @swc/core esbuild prisma unrs-resolver; then break; fi; \
      if [ "$attempt" = 5 ]; then exit 1; fi; \
      sleep "$((attempt * 2))"; \
    done

COPY . .
RUN --mount=type=cache,id=lanting-backend-bio-prisma,target=/root/.cache/prisma \
    pnpm prisma:generate
RUN pnpm test:migration \
    && pnpm build \
    && pnpm prune --prod --ignore-scripts

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runtime

RUN set -eu; \
    for attempt in 1 2 3 4 5; do \
      if apt-get -o Acquire::Retries=5 update \
        && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates chromium openssl; then \
        rm -rf /var/lib/apt/lists/*; \
        break; \
      fi; \
      rm -rf /var/lib/apt/lists/*; \
      if [ "$attempt" = 5 ]; then exit 1; fi; \
      sleep "$((attempt * 2))"; \
    done

ENV NODE_ENV=production \
    PORT=8000 \
    CHROME_BIN=/usr/bin/chromium \
    EMAIL_WORKER_ENABLED=false

WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
RUN install -d -o node -g node -m 0750 /app/data /tmp/lanting-chromium

USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/main"]
