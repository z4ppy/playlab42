FROM node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS node
FROM mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d

# Conserver les navigateurs officiels, sans dependre de la version Node de Noble.
COPY --from=node /usr/local/ /usr/local/
WORKDIR /workspace
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV HOME=/tmp
ENV NPM_CONFIG_CACHE=/tmp/playlab42-e2e-cache

COPY package.json package-lock.json ./
RUN node -e "if (Number(process.versions.node.split('.')[0]) !== 26) throw new Error('Node 26 requis')" \
    && npm ci --cache /tmp/npm-cache

CMD ["npm", "run", "test:e2e"]
