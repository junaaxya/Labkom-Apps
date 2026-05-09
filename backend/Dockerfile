# Multi-stage build for production
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S labkom -u 1001
WORKDIR /app
COPY --from=builder --chown=labkom:nodejs /app/dist ./dist
COPY --from=builder --chown=labkom:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=labkom:nodejs /app/package*.json ./
COPY --from=builder --chown=labkom:nodejs /app/prisma ./prisma
ENV UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown labkom:nodejs /app/uploads
USER labkom
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/server.js"]
