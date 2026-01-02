# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# If package-lock.json doesn't exist, npm ci will fail, so we use npm install as fallback
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

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
# If package-lock.json doesn't exist, npm ci will fail, so we use npm install as fallback
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy GraphQL schema file (needed at runtime)
COPY --from=builder /app/src/graphql/schema.graphql ./dist/graphql/schema.graphql

# Copy ABI JSON files (needed at runtime)
COPY --from=builder /app/src/contracts/nodeManager.abi.json ./dist/contracts/nodeManager.abi.json
COPY --from=builder /app/src/contracts/stfuel.abi.json ./dist/contracts/stfuel.abi.json

# Copy .env file from build context if it exists (optional)
# Runtime environment variables (via -e or --env-file) will override .env values
# Note: If .env doesn't exist in build context, comment out the line below
# The application will use runtime environment variables instead
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

