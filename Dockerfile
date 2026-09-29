# ==============================================================================
# MaraPlus On-Premise Relay Agent Dockerfile
# ==============================================================================
FROM node:20-alpine AS base

RUN apk add --no-cache dumb-init tzdata

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3001 \
    TZ=America/Caracas

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY index.js ./

RUN chown -R node:node /usr/src/app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/healthz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
