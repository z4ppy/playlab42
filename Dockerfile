# Playlab42 - Container de développement
FROM node:25-alpine

# Outils de base
RUN apk add --no-cache \
    git \
    make \
    bash \
    curl \
    python3 \
    py3-pip \
    py3-yaml

# Créer un utilisateur non-root (bonne pratique de sécurité)
# UID 1000 correspond généralement à l'utilisateur host
ARG UID=1000
ARG GID=1000
RUN addgroup -g ${GID} devuser && \
    adduser -D -u ${UID} -G devuser devuser

# Répertoire de travail
WORKDIR /workspace

# Donner les permissions à l'utilisateur non-root
RUN chown -R devuser:devuser /workspace

# Utiliser l'utilisateur non-root par défaut
USER devuser

# Commande par défaut
CMD ["tail", "-f", "/dev/null"]
