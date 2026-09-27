# ---------- Stage 1: Builder ----------
FROM node:22-alpine AS builder

# openssl + libc6-compat: Prisma engines. python3/make/g++: argon2 native build.
RUN apk add --no-cache openssl libc6-compat python3 make g++

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm i -g npm@12 && npm ci

RUN npx prisma generate

COPY src ./src
COPY tsconfig*.json nest-cli.json ./
RUN npm run build

RUN cp -r node_modules/.prisma /tmp/dot-prisma \
  && cp -r node_modules/@prisma /tmp/at-prisma \
  && rm -rf node_modules \
  && npm ci --omit=dev --ignore-scripts \
  && rm -rf node_modules/.prisma node_modules/@prisma \
  && cp -r /tmp/dot-prisma node_modules/.prisma \
  && cp -r /tmp/at-prisma node_modules/@prisma \
  && rm -rf /tmp/dot-prisma /tmp/at-prisma \
  && rm -rf node_modules/typescript node_modules/@types

# ---------- Stage 2: Runner ----------
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --chown=appuser:appgroup --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /app/prisma ./prisma
COPY --chown=appuser:appgroup --from=builder /app/package.json ./package.json

USER appuser

# The cloud injects PORT at runtime (app.config defaults to 3000).
EXPOSE 3000

# Pending migrations first, then the server. Seed (RBAC-safe) is manual:
#   node prisma/seed.mjs   (demo content only with SEED_DEMO_CONTENT=true)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
