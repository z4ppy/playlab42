## Context

GitHub accepte un check requis ignoré. Ajouter seulement `needs` à Build serait
donc insuffisant après un Security lint ou Trivy échoué/ignoré/annulé.
Les contrôles doivent rester parallèles, avec Build puis Browser sur le chemin
critique. Les droits de token publics sur fork ne permettent pas le commentaire PR.

## Decisions

1. Garder `name: Build`, attendre exactement `security-lint` et `trivy-scan`,
   et appliquer `if: always()` au job. La première étape Bash exige `success`
   pour chacun, sinon sort avec code 1 avant checkout, installation, build et
   upload. Les étapes suivantes n'ont pas de condition de contournement.
   Une annulation globale reste une CI non validée, pas une livraison autorisée.
2. Partager `.github/workflows/trivy-scan.yml` via `workflow_call` depuis CI et
   Security Audit. Le scan fs utilise vuln/secret, HIGH/CRITICAL,
   `--include-dev-deps`, `--exit-code 1`, JSON et la base CVE actuelle.
   L'installer existant épingle Trivy 0.75.0 et vérifie le checksum avant extraction.
   Actions externes épinglées, permissions `contents: read`, aucun catch favorable.
3. Le paramètre requis `artifact-name` est distinct chez les deux appelants :
   `ci-trivy-results` et `audit-trivy-results`. Une invocation fournit un nom
   unique dans son run ; ajouter un appelant exige un nom distinct.
   Rapports uploadés avec `always()` et fichier manquant en erreur.
4. Garder l'ID `trivy-scan` et `toJSON(needs)` dans le rapport complémentaire :
   le statut GitHub du job réutilisé reste une source, pas un nom de fichier.
   Le résumé scanner utilise `steps.scan.outcome` sans exposer le contenu JSON.
5. Garder les droits d'écriture PR au seul job de rapport, dégradés par GitHub
   pour un fork public. La condition du commentaire exige PR et dépôt source
   identique. Artefact et summary restent inconditionnels après génération ;
   l'API commentaire est attendue pour rendre ses erreurs explicites.
   Aucun `pull_request_target`, secret supplémentaire ou élévation globale.
6. Tester les 16 combinaisons success/failure/skipped/cancelled du vrai guard
   Bash, les statuts inconnus, conditions YAML, droits/forks, paramètres du scan,
   propagation des sorties scanner et des erreurs de commentaire.
   Les stubs ne sont pas présentés comme une analyse de vulnérabilités réelle.

## Risks and Limits

Build/Browser attendent le plus lent de Security lint et Trivy. Télécharger le
scanner et actualiser la base CVE ajoutent coût, variabilité réseau et possibilité
d'échec explicite. Le workflow partagé supprime la duplication de logique, pas
les invocations CI/audit indépendantes. Ne pas rendre le scanner consultatif
pour améliorer les timings.

La protection GitHub conserve ses neuf checks exacts, sans Security lint ou
Trivy natifs supplémentaires. Leur couverture s'appuie sur Build une fois le
workflow intégré. Les tests Docker ne sont ni une CI native ni une observation
du comportement de protection sur GitHub. Aucun merge/publication/archive.
