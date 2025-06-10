FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json pnpm-*.yaml ./
COPY prisma ./prisma/

ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

RUN corepack enable && \
    npm install @antfu/ni -g
RUN nci

COPY . .

RUN npm run build

FROM node:22-slim

RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    ca-certificates \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && dpkg -i google-chrome-stable_current_amd64.deb || true \
    && apt-get install -f -y \
    && rm google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/google-chrome

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-*.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]