# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS builder

WORKDIR /app
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=lanting-backend-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN --mount=type=cache,id=lanting-backend-prisma,target=/root/.cache/prisma \
    pnpm prisma:generate
RUN pnpm test:migration \
    && pnpm build \
    && pnpm prune --prod --ignore-scripts

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runtime

COPY --from=builder /app/package.json /tmp/lanting-build-complete
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates openssl wget \
    && wget --tries=10 --retry-connrefused --timeout=30 \
      https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
      -O /tmp/google-chrome.deb \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends /tmp/google-chrome.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/google-chrome.deb /tmp/lanting-build-complete

ENV NODE_ENV=production \
    PORT=8000 \
    CHROME_BIN=/usr/bin/google-chrome \
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
