# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S labkom -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=labkom:nodejs /app/dist ./dist
COPY --from=builder --chown=labkom:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=labkom:nodejs /app/package*.json ./
COPY --from=builder --chown=labkom:nodejs /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p uploads && chown labkom:nodejs uploads

# Switch to non-root user
USER labkom

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/server.js"]