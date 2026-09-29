# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY src/prisma ./src/prisma
RUN npx prisma generate --schema src/prisma/schema.prisma

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

# Only copy package files to install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built code
COPY --from=builder /app/dist ./dist
# We also need the schema for `prisma migrate deploy` which will run as an exec command
COPY src/prisma ./src/prisma

# Expose port (internal)
EXPOSE 3000

CMD ["node", "dist/server.js"]
