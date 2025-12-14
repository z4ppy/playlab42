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

# Répertoire de travail
WORKDIR /workspace

# Commande par défaut
CMD ["tail", "-f", "/dev/null"]
