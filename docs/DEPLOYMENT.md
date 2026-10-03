# Guide de déploiement

Le site est statique et publié sur [GitHub Pages](https://z4ppy.github.io/playlab42/).
Ce guide décrit les workflows versionnés ; une modification de workflow n'est
effective en production qu'après sa livraison. Les réglages GitHub sont distincts
des fichiers du dépôt.

## La chaîne de livraison

```text
PR vers main → CI réutilisable → contrôles + archive publique + navigateur

Push main / lancement manuel sur main
  → check-ref
  → validate : appelle la même CI
      ├─ lint qualité/sécurité JS, tests Jest et seuils ciblés, types, audit npm, OpenSpec
      └─ build → archive github-pages → navigateur sur cette archive
  → deploy : publie cette archive après le succès de toute la CI
  → smoke : contrôle HTTP du site et du commit
```

[deploy.yml](../.github/workflows/deploy.yml) appelle
[ci.yml](../.github/workflows/ci.yml) dans le **même run**, sur le même commit.
Il ne se contente pas de supposer qu'une ancienne CI de PR était verte.
Un contrôle requis échoué empêche `deploy` de démarrer.

Le workflow CI ne se déclenche pas séparément sur push : le workflow de livraison
l'appelle, sans doubler les suites. Les PR et les lancements manuels de CI restent
possibles. Les analyses de sécurité complémentaires restent séparées, mais
l'audit npm au seuil modéré est requis dans la CI et peut bloquer `deploy`.

## Configuration GitHub

- **Settings → Pages** : source « GitHub Actions ».
- L'environnement de publication est `github-pages`.
- Le token GitHub fourni au job de publication reçoit `contents: read`,
  `pages: write` et `id-token: write`. Les jobs de validation ont seulement
  `contents: read`.
- `CODECOV_TOKEN` sert à l'envoi des rapports, si configuré. L'échec d'envoi
  ne fait pas échouer les tests ; il ne faut pas en déduire un rapport disponible.
- `concurrency: pages`, avec `cancel-in-progress: false`, évite deux publications
  simultanées sans interrompre celle en cours.

Le contrôle de référence fait **échouer** un lancement manuel hors `main`.
Les workflows ne réalisent pas de merge, de revue ou d'archivage OpenSpec.

### Protection de main : activée sur GitHub

Après autorisation utilisateur, une **protection de branche classique** a été
activée et relue via l'API le **3 octobre 2026** : `protected: true`.
Elle est distincte des rulesets ; une liste de rulesets vide ne signifie donc
plus que `main` est dépourvue de protection.

- PR obligatoire, contrôles à jour avec `main`, discussions résolues.
- Règles appliquées aussi aux administrateurs, sans contournement.
- Historique linéaire : squash ou rebase, tous deux disponibles dans le dépôt.
- Force-push et suppression de `main` interdits.
- Neuf checks requis, rattachés à GitHub Actions (app ID `15368`) :
  `Lint`, `Tests`, `TypeScript`, `Build`, `Browser / Chromium interactions`,
  `OpenSpec`, `Dependency audit`, `Audit dépendances npm` et `Détection de secrets`.

Ces noms ont été observés sur une PR native réussie, pas déduits des noms de
workflows. Les contrôles consultatifs et le job Docker ignoré sur PR ne sont
pas requis.

**Limite assumée : zéro approbation externe obligatoire**, car l'API ne listait
qu'un mainteneur capable de revoir les PR. Les PR et checks restent obligatoires
pour lui ; cela ne constitue pas une revue indépendante. Passer à au moins une
approbation dès qu'un second reviewer habilité est disponible.

Les `check-runs` de la PR #135 ont permis d'ajuster le contexte navigateur
réutilisé et d'ajouter OpenSpec/Dependency audit, sans désactiver les autres
protections. Une ancienne PR doit intégrer ce pipeline avant sa fusion ;
ne pas contourner un check requis absent. Refaire cette observation après tout
changement de nom ou structure. Les workflows seuls ne remplacent pas ce réglage.

## Build et contenu publié

Dans Docker :

```bash
make npm CMD="run build"        # TypeScript, runtime, catalogues, OG, guides, site
make npm CMD="run build:local"  # même chaîne, sans collecte distante Open Graph
```

`npm run build` inclut désormais `build:ts` ; le workflow n'a pas à ajouter
une compilation séparée. Le build de production conserve l'enrichissement
Open Graph des bookmarks. Il n'est donc **pas hermétique** : le réseau et les
métadonnées distantes peuvent influencer les sorties. `build:local` ne prouve
pas que cette collecte réseau de production a fonctionné.

`build:site` prépare **`site/`**, pas une copie aveugle du dépôt :

| Publié | Non publié |
|--------|------------|
| Portail, `app/`, `lib/`, outils, jeux, parcours | `node_modules/`, scripts et gabarits de développement |
| `assets/`, dont les distributions runtime générées | Tests, mocks, couverture et rapports |
| Catalogues et images de bookmarks | Cache de collecte Open Graph |
| Guides HTML, Markdown de référence et specs | `.github/`, `.claude/`, fichiers cachés et secrets |
| README, conventions, licence et éventuel CNAME | Dockerfile, Makefile, package/lockfile de développement |

Le lecteur de guides renvoie vers GitHub pour les fichiers réservés au dépôt.
Les fichiers générés restent ignorés par Git, **y compris `site/`**. `.gitignore`
ne constitue pas un filtre de publication ; c'est le script de packaging qui
définit le contenu public. Un lien symbolique dans une ressource publique fait
échouer le packaging plutôt que copier des fichiers externes.

Le job build archive `site/` dans `github-pages` (rétention 7 jours).
Le navigateur extrait cette archive et utilise `PLAYWRIGHT_PREBUILT=1`, sans
reconstruire les catalogues. `deploy-pages` publie **la même archive**, pas un
second build. Les rapports d'échec navigateur sont conservés 14 jours.

## Vérifier une publication

`site/build-info.json` fournit :

```json
{
  "version": "0.2.0",
  "commit": "0123456789abcdef0123456789abcdef01234567"
}
```

Le SHA ci-dessus est un exemple. En CI, la valeur réelle est `GITHUB_SHA` ;
en local, elle vaut `null`, sauf identité explicitement fournie au build.
Ce fichier identifie les sources mais **n'est pas une attestation signée**.

Après publication, le job `smoke` vérifie neuf ressources : identité du build,
portail, accueil des guides, trois catalogues, premier outil, premier jeu et
première slide. Il compare le commit au SHA du run et rejette un catalogue vide
ou invalide, une erreur HTTP ou une ressource hors du sous-chemin publié.

Il effectue au plus cinq tentatives, annoncées dans les logs et espacées de
10 secondes, pour la propagation Pages. Un échec final fait échouer le workflow :
**le site a cependant déjà été publié**. Il n'y a pas de rollback automatique.
Ce smoke test HTTP ne vérifie ni toutes les interactions, ni tous les contenus,
ni la disponibilité continue.

Pour tester le dossier préparé, avec `make serve` déjà actif :

```bash
# Dans le conteneur, 5242 est le port interne ; make info donne le port externe.
make npm CMD="run check:deployment -- http://127.0.0.1:5242/site/"
```

Pour contrôler une URL publique, ajouter un SHA réel si disponible :

```bash
make npm CMD="run check:deployment -- https://z4ppy.github.io/playlab42/ SHA_COMPLET"
```

Remplacer `SHA_COMPLET`, ne pas exécuter l'exemple littéralement.
Ne pas annoncer une CI native ou une publication validée sur la seule base de
tests locaux ; consulter les résultats GitHub du commit concerné.

## Rollback et incidents

1. Identifier le commit déployé dans `build-info.json` et le dernier état valide.
2. Créer une **branche de correction et une PR de revert** :

   ```bash
   git switch -c fix/revert-publication
   git revert COMMIT_PROBLEMATIQUE
   git push -u origin fix/revert-publication
   ```

3. Faire relire les contrôles et décider explicitement du merge.
4. Vérifier le nouveau run de publication et le smoke test.
5. Noter l'incident et sa résolution ; ne synchroniser/archiver OpenSpec qu'après
   livraison et décision explicite.

Un lancement manuel sur `main` redéploie son état courant : **ce n'est pas un
rollback vers un ancien artefact**. Aucun `push --force` n'est une procédure
normale de récupération. La restauration d'un artefact connu, le suivi de
disponibilité et les notifications d'incident restent des évolutions proposées.

## Versions et maintenance

La version courante vient de `package.json`. Ne pas la dupliquer dans les guides
à chaque release. Tags, changelog et GitHub Releases ne sont pas créés
automatiquement ; toute commande `npm version` s'exécute dans Docker et exige
une décision de release. Elle peut créer un commit/tag : inspecter son effet,
ne pas la combiner avec une création de commit présentée comme indépendante.

En cas de ressource manquante, vérifier le build, le contenu de `site/` et les
chemins relatifs compatibles avec `/playlab42/`, plutôt que modifier `.gitignore`
ou supposer que `make build` construit le site : cette cible construit **l'image Docker**.

## Références

- [L'usine logicielle et sa feuille de route](guides/software-factory.md)
- [Pipelines](../.github/docs/PIPELINES.md)
- [Stratégie de tests](TESTING_STRATEGY.md)
- [Dépannage](TROUBLESHOOTING.md)
- [GitHub Pages](https://docs.github.com/en/pages)
- [Livraison continue DORA](https://dora.dev/capabilities/continuous-delivery/)

Actualisé le 3 octobre 2026.
