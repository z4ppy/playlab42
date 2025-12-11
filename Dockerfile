# Playlab42 - Container de développement
FROM node:20-alpine

# Outils de base
RUN apk add --no-cache \
    git \
    make \
    bash \
    curl

# Répertoire de travail
WORKDIR /workspace

# L'utilisateur node existe déjà dans l'image node
USER node

# Commande par défaut
CMD ["tail", "-f", "/dev/null"]
