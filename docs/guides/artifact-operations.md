# Fabrication vérifiable et reprise

Ce runbook décrit le lot 5 préparé, pas un déploiement déjà réalisé.
Application statique, pas de backend ou plateforme d'exploitation ajoutée.

## Actualisation éditoriale et fabrication

Le build normal lit `metadata/bookmarks-og.json`, version 1, sans collecte OG.
Une URL nouvelle sans métadonnées conserve son titre/description manuels avec
un warning ; snapshot manquant ou corrompu = erreur. Le snapshot n'est pas le
cache technique ignoré `data/bookmarks-cache.json`.

```bash
make npm CMD="run refresh:bookmarks"
git diff -- metadata/bookmarks-og.json data/bookmarks-images/
make npm CMD="run build"
make npm CMD="run verify:site"
```

Le refresh autorise explicitement le réseau et respecte la TTL du cache
(sept jours). Inspecter titres, descriptions, images, licences et échecs avant
commit. Le snapshot initial comporte 128 URL ; 11 entrées sans métadonnées
distantes restent facultatives, signalées, avec leurs champs manuels.
Ne pas annoncer ces échecs comme une collecte complète.
`OG_REFRESH_IMAGES=1`, passé au conteneur lors du refresh, autorise à remplacer
les images déjà présentes lorsque la page est effectivement récupérée.
Le build normal ne respecte pas cette variable comme ordre de collecte.
`build:local` omet l'enrichissement ; il n'est pas identique au build de production.

## Reproductibilité : périmètre précis

La CI utilise le timestamp Git comme SOURCE_DATE_EPOCH, effectue deux vrais
builds, compare les manifestes, puis revérifie le site et exerce sa reprise.
Les mêmes sources, commit, dépendances installées, outils, plateforme et epoch
doivent produire les mêmes **octets publics**, pas nécessairement la même
enveloppe tar (permissions/mtime/compression ne sont pas comparés).

Dans un worktree propre, les commandes Git ci-dessous inspectent uniquement
les métadonnées host ; tout runtime reste dans Docker :

```bash
git status --short # arrêter si les sources ne correspondent pas au commit
SHA=$(git rev-parse HEAD)
EPOCH=$(git show -s --format=%ct "$SHA")
docker compose exec -T -e GITHUB_SHA="$SHA" -e SOURCE_DATE_EPOCH="$EPOCH" dev sh -c '
  mkdir -p .docker &&
  npm run build &&
  npm run verify:site &&
  cp site/build-manifest.json .docker/playlab-first-manifest.json &&
  npm run build &&
  cmp .docker/playlab-first-manifest.json site/build-manifest.json &&
  npm run verify:site &&
  npm run check:recovery
'
```

Sans epoch, le développement local utilise l'heure réelle et ne revendique pas
une fabrication reproductible. Une epoch malformée échoue. L'installation npm
reste une étape préalable avec réseau ; ce n'est pas une certification de
build hermétique. Des CDN et modèles du navigateur restent externes, notamment
Chart.js non versionné et Magenta Image/modèles : le site entier n'est pas offline.

### Images : source revue, pas cache local implicite

Les images téléchargées dans `data/bookmarks-images/` sont ignorées par Git,
sauf les fichiers explicitement versionnés. Une image nouvelle de ce cache
ne devient **pas** une dépendance locale du snapshot : son URL OG d'origine,
résolue sur la page et décodée, reste une ressource HTTP(S) externe.
Le snapshot conserve trois images locales déjà revues et 98 références distantes.
Les images locales nouvelles demandent revue/licence et ajout Git explicite,
pas publication automatique d'un cache. Le packaging copie les seules images
locales référencées et refuse celles absentes, non régulières ou hors périmètre
avant remplacement du site. Les caches supplémentaires n'influencent plus
l'inventaire public. La vérification de l'archive extraite contrôle aussi ces
références : des hashes cohérents ne suffisent pas si une image référencée manque.
Lors d'un refresh en erreur, les métadonnées éditoriales
précédentes restent disponibles, sans promouvoir un fichier temporaire.

## Inventaire, SBOM et source de confiance

- `build-info.json` : version et SHA CI (null en développement sans SHA fourni).
- `build-sbom.cdx.json` : CycloneDX native `npm sbom`, dépendances de fabrication
  réellement installées, dont devDependencies. Ce n'est pas la liste des seuls
  composants distribués au navigateur. Serial aléatoire supprimé, timestamp
  fixé et nom racine normalisé, graphe/composants conservés.
- `build-manifest.json` : version, commit, outils, epoch, hash du lockfile et du
  snapshot, vendors générés, chemins/tailles/SHA-256 de tous les fichiers publics
  sauf le manifeste lui-même. Les assets réellement livrés, licences et SBOM
  sont inclus ; les ressources dynamiques externes ne le sont pas.

`verify:site` refuse fichiers modifiés, absents, supplémentaires, liens
symboliques, identité différente et inventaire non canonique. La CI le lance
avant archivage puis sur l'archive extraite avant Chromium.
Le manifeste est **non signé** : remplacer simultanément ses hashes et les
fichiers peut le rendre cohérent. Choisir une archive/run et un commit revus
comme source de confiance ; les hashes ne remplacent pas une signature ou
attestation indépendante. Aucun niveau SLSA ou audit de licence global prétendu.

## Reprise locale, sans production

```bash
make npm CMD="run check:recovery"
```

Le script vérifie le site, crée une vraie archive tar dans son temporaire
unique, l'extrait, altère uniquement sa copie d'index, exige le refus
d'intégrité, réextrait l'archive et exige sa vérification complète.
Le site original reste inchangé et les temporaires possédés sont nettoyés.
Cela prouve une reprise de fichiers locaux, pas une reprise Pages en production.

## Monitoring et incident

`site-monitor.yml` prépare un contrôle quotidien à 06:23 UTC et manuel. Le cron
ne s'active qu'après intégration à la branche par défaut. Il utilise main comme
identité attendue et contrôle dix ressources, dont le manifeste et ses empreintes
lockfile/snapshot comparées au checkout main, pas tous les hashes distants,
l'audio, les inférences ML ou l'intégralité des interactions.
Configurer `PLAYLAB_SITE_URL` si l'URL Pages change et les notifications d'échec
GitHub Actions ; vérifier leur réception et désigner un responsable.
Ce dispositif n'est ni une surveillance continue, ni une alerte indépendante,
ni un SLO de disponibilité déjà mesuré.

En cas d'échec, relever run, heure UTC, SHA attendu/publié et ressource en défaut.
Distinguer propagation Pages, panne réseau, mauvais artefact et défaut client.
Identifier le dernier run/archive **validé**, vérifier son identité/intégrité et
exercer sa restauration localement. La rétention actuelle de l'archive Pages
est sept jours : ne pas compter sur une archive déjà expirée.
Décider humainement d'une PR de correction/revert ou d'une republication
explicitement autorisée d'un ancien artefact. Le workflow actuel republie
main, pas un ancien run choisi. Ni force-push, rollback automatique, déploiement
ou archivage OpenSpec ne sont autorisés par ce runbook.

Après intervention autorisée, constater publication et smoke, documenter la
cause, le temps de récupération et une régression pertinente. Voir
[déploiement](../DEPLOYMENT.md) et [qualité](software-quality.md).
