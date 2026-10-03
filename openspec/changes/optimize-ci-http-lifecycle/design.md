## Contexte et mesure

Baseline : run CI 37132029357, job Build 111228862898.
Le build npm utile affiche sa fin OG à 15:06:46 puis reste vivant jusqu'à
15:11:28 ; les étapes suivantes sont rapides. Les installations npm durent
quelques secondes, le navigateur attend l'archive et prend environ 1 min 36 s.

## Décisions

1. Le helper HTTP privé reçoit un consommateur asynchrone de réponse. Son délai
   de huit secondes couvre en-têtes et corps, pas seulement l'ouverture.
2. Dans `finally`, libérer le délai et interrompre la requête encore associée
   à la réponse, même quand son statut HTTP conduit à un retour anticipé.
3. Garder le parsing et la sauvegarde hors du transport. L'échec d'une page
   conserve son statut `failed` et son repli éventuel, sans entrer dans le cache.
   L'échec d'une image optionnelle est visible et conserve le contrat existant.
4. Tester les corps HTTP laissés ouverts depuis un vrai processus Node :
   sortie naturelle en moins de trois secondes sur une erreur immédiate.
   Tester le délai de lecture du corps avec une horloge contrôlée.
5. Ne pas retirer de gates, raccourcir les tests ni forcer la sortie du build.
   Ne pas partager `node_modules` entre ABI Alpine/Ubuntu. L'installation
   isolée et le cache de téléchargement npm restent inchangés.
6. Les lots suivants sont empilés sur des branches de contribution : les
   workflows CI/audit acceptent toutes les bases de PR. Le déploiement reste
   limité à main ; les noms de checks et permissions sont conservés.

## Vérification et limites

Les tests de build hors ligne et les métadonnées normales doivent rester
compatibles. La mesure native corrigée sera comparée à la baseline, sans
attribuer au correctif les différences de charge runner ou de réseau.
La fabrication conserve encore l'enrichissement externe et n'est pas hermétique.
