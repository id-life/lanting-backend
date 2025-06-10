FROM node:22-alpine3.21 AS builder

WORKDIR /app

COPY package*.json pnpm-*.yaml ./
COPY prisma ./prisma/

RUN corepack enable && \
    npm install @antfu/ni -g
RUN nci

COPY . .

RUN npm run build

FROM node:22-alpine3.21

# 安装 Chromium 和必要的依赖
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus

# 设置 Chromium 环境变量
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_NO_SANDBOX=true
ENV CHROME_DISABLE_GPU=true
ENV CHROME_HEADLESS=true

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-*.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]