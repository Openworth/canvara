# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite (will be overwritten by volume mount)
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]

