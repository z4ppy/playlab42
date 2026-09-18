# Playlab42 - Container de développement
FROM node:26-alpine

# Outils de base
RUN apk add --no-cache \
    git \
    make \
    bash \
    curl \
    python3 \
    py3-pip \
    py3-yaml

# Bloc « utilisateur non-root » désactivé — NE PAS décommenter tel quel.
# Sur node:26-alpine, l'UID et le GID 1000 sont déjà pris par l'utilisateur
# « node » de l'image de base : `addgroup -g 1000 devuser` échoue avec
# « addgroup: gid '1000' in use » et casse le build.
# Le conteneur de développement ne tourne pas en root pour autant : c'est
# docker-compose.yml qui impose l'identité, via
# `user: "${LOCAL_UID:-1000}:${LOCAL_GID:-1000}"` sur le service dev.
# Pour durcir aussi `docker run` sans compose, la piste est `USER node`
# (utilisateur déjà présent dans l'image), pas la recréation d'un devuser.
#ARG UID=1000
#ARG GID=1000
#RUN addgroup -g ${GID} devuser && \
#    adduser -D -u ${UID} -G devuser devuser

# Script d'initialisation des volumes
COPY docker/init-volumes.sh /usr/local/bin/init-volumes.sh
RUN chmod +x /usr/local/bin/init-volumes.sh

# Répertoire de travail
WORKDIR /workspace

# Donner les permissions à l'utilisateur non-root
#RUN chown -R devuser:devuser /workspace

# Utiliser l'utilisateur non-root par défaut
#USER devuser

# Commande par défaut
CMD ["tail", "-f", "/dev/null"]
