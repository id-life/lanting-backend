FROM node:22-alpine3.21 AS builder

WORKDIR /app

COPY package*.json pnpm-*.yaml ./
#COPY prisma ./prisma/

RUN corepack enable && \
    npm install @antfu/ni -g
RUN nci

COPY . .

RUN npm run build

FROM node:22-alpine3.21

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-*.yaml ./
COPY --from=builder /app/dist ./dist
#COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]