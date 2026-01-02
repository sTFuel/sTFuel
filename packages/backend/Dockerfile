# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Build TypeScript and copy GraphQL schema
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy GraphQL schema file (needed at runtime)
COPY --from=builder /app/src/graphql/schema.graphql ./dist/graphql/schema.graphql

# Copy ABI JSON files (needed at runtime)
COPY --from=builder /app/src/contracts/nodeManager.abi.json ./dist/contracts/nodeManager.abi.json
COPY --from=builder /app/src/contracts/stfuel.abi.json ./dist/contracts/stfuel.abi.json

# Copy .env file from build context if it exists (optional)
# Runtime environment variables (via -e or --env-file) will override .env values
# If .env doesn't exist in build context, comment out the line below and use --env-file at runtime
# To include .env in image: ensure .env exists and is not excluded in .dockerignore
# To exclude .env from image: keep .env in .dockerignore (default) and use --env-file at runtime
COPY .env .env

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port the app runs on
EXPOSE 4000

# Health check using GraphQL endpoint
# Uses Node.js to check if server responds (200 or 400 both indicate server is up)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/graphql', (r) => process.exit(r.statusCode >= 200 && r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]

