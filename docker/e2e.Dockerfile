FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2 AS node
FROM mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f

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
