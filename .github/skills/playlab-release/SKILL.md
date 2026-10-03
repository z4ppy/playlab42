---
name: playlab-release
description: >-
  Préparer une contribution ou une release Playlab42 : branche/worktree,
  revue du diff, validations Docker ciblées, builds, checklist de PR et suivi
  du déploiement GitHub Pages. Utiliser avant commit, PR ou publication.
  Ne jamais fusionner automatiquement, pousser sans autorisation ni contourner
  les permissions du rôle opérateur.
---

# Préparer une contribution ou une release

## Inspecter avant d'agir

Lire [AGENTS.md](../../../AGENTS.md), `docs/guides/contributing.md`,
`Makefile`, `package.json` et [la matrice de validation](references/release.md).
Appliquer le [guide qualité](../../../docs/guides/software-quality.md).
Le [skill de revue](../playlab-review/SKILL.md) complète cette préparation :
revue de conception et de comportement, sans autorisation implicite de livraison.
Les chemins en code sont relatifs à la racine du dépôt.

1. Inspecter branche, état Git et diff. Ne pas réinitialiser les modifications
   d'autrui et ne pas mélanger des contributions parallèles.
2. Utiliser une branche dédiée depuis la base demandée. Si la branche de travail
   existe déjà, la conserver ; ne pas créer une autre branche inutilement.
   En environnement bare/worktree, suivre les instructions de workspace au lieu
   de faire un checkout dans un worktree partagé.
3. Pour une nouvelle fonctionnalité, lire `openspec/AGENTS.md`, le changement
   approuvé et ses tâches. Ne pas archiver un changement non déployé.
4. Définir le périmètre : documentation seule, client UI, moteur, parcours,
   bibliothèque partagée ou pipeline. Choisir les validations correspondantes.

## Valider sans masquer les échecs

Tout runtime passe par Docker : `make npm CMD="..."`, cibles Make ou shell
du conteneur. Ne pas lancer `npm`, `node`, tests ou scripts sur le host.
Si le rôle interdit Docker, préparer les commandes pour l'opérateur et marquer
les validations non exécutées. Ne pas installer des dépendances pour une simple
lecture ou lancer `make init` si l'environnement est déjà prêt.

Commencer par les tests et le lint ciblés du périmètre ; regrouper les sélecteurs
du même runner. Ajouter les builds/catalogues nécessaires et les parcours
navigateur pour les interactions. Avant une livraison complète, appliquer aussi
les exigences globales d'`AGENTS.md` et de CI, sans présenter une validation
ciblée comme l'équivalent d'une CI complète.
Pour le code et la chaîne de fabrication, contrôler aussi `test:coverage` et
`audit:dependencies`. Une panne d'audit est un échec explicite ; ne pas baisser
un seuil, ignorer une CVE ou lancer un fix forcé pour contourner le contrôle.

Ne pas ignorer un code de sortie, supprimer un test, modifier les règles d'un jeu
ou mettre à jour une dépendance sans rapport pour faire passer une release.
Ne pas versionner les catalogues générés `data/*.json`, `dist/`, les rapports
de tests ou des secrets.

## Préparer le handoff

- Relire le diff final et sélectionner seulement les fichiers de la contribution.
  Un commit demandé utilise un message français et les trailers imposés par
  l'environnement.
- Préparer une description de PR conforme à `.github/PULL_REQUEST_TEMPLATE.md` :
  changement, motivation, lien OpenSpec pertinent, résultats réels et risques.
- Exécuter commit, push ou opérations GitHub uniquement si demandés et autorisés
  pour le rôle courant ; sinon remettre les fichiers et commandes à l'opérateur.
- **Ne jamais lancer de merge automatique**, `gh pr merge --auto` ou fusion de PR
  sans demande explicite. Une CI verte ne constitue pas une autorisation.
- Lire `.github/workflows/deploy.yml` pour expliquer la publication : GitHub Pages
  déploie depuis `main` ou un déclenchement manuel prévu. Ne pas déclencher un
  déploiement ou publier une version simplement parce qu'une PR est préparée.

## Livrer

Indiquer précisément ce qui est prêt, ce qui a réellement été exécuté et tout
blocage. Distinguer fichiers préparés, commit créé, PR ouverte, merge et
déploiement : ne pas annoncer l'étape suivante comme accomplie.
