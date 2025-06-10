FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json pnpm-*.yaml ./
COPY prisma ./prisma/

RUN corepack enable && \
    npm install @antfu/ni -g
RUN nci

RUN nr prisma:generate
COPY generated ./generated  

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
COPY --from=builder /app/generated ./generated

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]