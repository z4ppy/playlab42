## Mesure avant décision

Baseline locale `ef0a2aa` : jscpd 5.4.0, minimum 50 tokens / 5 lignes,
44 clones de production ; ESLint 10.12.0, 85 fonctions de production > 10,
dont 10 > 20 ; Biome 2.5.15 mesure le cognitif TS, pas son cyclomatique.
Le périmètre de duplication initial omet les assets de parcours et ne mesure
pas les CSS autonomes ; documenter ces limites et reconstruire une baseline
avec la configuration définitive avant comparaison CI.

La duplication est un signal de revue, pas une preuve de mauvais design.
Les clones de tests et supports pédagogiques sont séparés. Extraire une
responsabilité partagée lorsqu'elle conserve un contrat clair, sans classes
de base artificielles ni fonctions génériques à paramètres multiples.

## Scopes indépendants

- Validation de déploiement et hiérarchie parcours.
- Fabrication : validation de manifests, bilan CLI et compilation.
- Musique : commandes clavier et calcul des niveaux XP.
- Particules : forces et coordonnées, même ordre de calcul numérique.
- Intégrateur : outils/rapport, collecte, budgets et documentation.

Les agents ne modifient pas les configurations centrales. Les helpers extraits
restent instrumentés ; l'orchestration CLI et les scripts HTML sont contrôlés
par subprocessus/navigateur quand Jest ne les instrumente pas.

## Rapport et garanties

Outils disponibles après `npm ci`, versions/lockfile, exclusions partagées des
sorties/vendor. Aucun téléchargement d'outil à la volée dans la CI.
JSON/Markdown contiennent SHA/run/tentative, paramètres et scopes ; une erreur
de scanner ou un rapport invalide échoue, sans défaut silencieux.
Conserver les gates actuels et appliquer des budgets ciblés après mesure,
sans seuil global artificiel ni `continue-on-error` cachant le rapport.

Tests de comportement avant extraction ; comparaison différentielle des
calculs et outputs, lint/types, rapport avant/après à configuration constante,
suite intégrée et vrai Chromium. CI finale et artefacts vérifiés séparément.
