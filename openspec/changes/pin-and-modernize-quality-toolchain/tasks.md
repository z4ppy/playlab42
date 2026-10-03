## Préparation
- [x] 1. Finaliser le lot 1, ouvrir la PR #135 et créer un worktree empilé isolé.
- [x] 2. Vérifier les versions, références et compatibilités avant installation.

## Implémentation
- [x] 3. Moderniser le lint de sécurité et les cibles locales, avec erreurs explicites.
- [x] 4. Épingler actions et images, versionner et vérifier les scanners avant exécution.
- [x] 5. Corriger les diagnostics pertinents existants et tester les gates.
- [x] 6. Actualiser guides, parcours, skills, maintenance et politique d'exceptions.

## Vérification
- [x] 7. Vérifier tests, lint, types, audits, build et navigateur dans Docker.

Preuves locales avant correctif CI : 87 suites / 1 882 tests avec couverture, gates qualité/sécurité
JS, types, audit npm et OpenSpec strict (24 items). Build local et 58 scénarios
Chromium sur le site préconstruit sans modification de ses sommes ; la régression
JSON échouait avant correction à horloge contrôlée. Références/checksums et
syntaxe des workflows vérifiés, scanners réels exercés sans valeur de secret
publiée. La PR #136 est ouverte ; ce n'est pas une livraison.

Le premier run natif a révélé une option `sha256sum -s` acceptée dans Alpine
mais refusée par GNU coreutils. Utiliser `-c` commun aux deux environnements :
contrôles réels positif/négatif, pas seulement un mock du vérificateur.
Les deux vrais scanners ont été installés et leurs checksums vérifiés sous GNU ;
le résultat de la CI native corrigée reste à constater.

## Suite à décider
- [ ] 8. Ajouter le lint TypeScript lorsque le parser supporte TS 7 sans forçage.
- [ ] 9. Faire relire et ouvrir une PR du lot 2 sur demande.
  PR #136 ouverte sur demande ; revue indépendante non présumée.
- [ ] 10. Après autorisation et livraison constatée, décider sync et archive.
