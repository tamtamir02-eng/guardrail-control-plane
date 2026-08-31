# Required build argument example:
# --build-arg NODE_BASE_IMAGE=node:20.19.5-bookworm-slim@sha256:<APPROVED_DIGEST>
ARG NODE_BASE_IMAGE
FROM ${NODE_BASE_IMAGE}

ARG VCS_REF

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN node -e "if (!/^[0-9a-f]{40}$/.test(process.argv[1])) process.exit(1)" "$VCS_REF" \
    && printf '%s\n' "$VCS_REF" > /app/BUILD_COMMIT \
    && chown node:node /app/BUILD_COMMIT
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node src ./src
COPY --chown=node:node config ./config
COPY --chown=node:node scripts/preflight.mjs ./scripts/preflight.mjs

LABEL org.opencontainers.image.title="guardrail-control-plane" \
      org.opencontainers.image.version="4.2.0" \
      org.opencontainers.image.revision=$VCS_REF

ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["sh", "-c", "node scripts/preflight.mjs && exec node src/server.mjs"]
