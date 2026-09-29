# ==============================================================================
# MaraPlus On-Premise Relay Agent Dockerfile
# ==============================================================================
# Ultra-lightweight, hardened Node.js Alpine container for on-premise execution.
# Connects Supabase Cloud Realtime with local MaraPlus ERP (192.168.15.225:3002).
# ==============================================================================

FROM node:20-alpine AS base

# Install dumb-init to properly forward Linux OS signals (SIGTERM/SIGINT) to Node
RUN apk add --no-cache dumb-init tzdata

# Set working directory
WORKDIR /usr/src/app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    TZ=America/Caracas

# Copy dependency manifests first for optimal Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY index.js ./

# Ensure ownership belongs to non-root 'node' user
RUN chown -R node:node /usr/src/app

# Switch to unprivileged user for security compliance
USER node

# Expose internal metrics/healthcheck port
EXPOSE 3001

# Docker native healthcheck hitting the embedded /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/healthz || exit 1

# Launch using dumb-init PID 1 wrapper to guarantee proper signal handling and shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
