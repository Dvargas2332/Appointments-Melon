# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including dev) needed to compile TypeScript
RUN npm install --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# Remove dev dependencies for the runtime stage
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install libssl required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production

# Copy only what is needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
