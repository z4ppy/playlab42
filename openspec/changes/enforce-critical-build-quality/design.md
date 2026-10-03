## Limites et compatibilité

Périmètre critique, pas de refactor cosmétique universel ou nouvel outil de score.
ESLint existant mesure les fonctions OG : baseline 14 pour extraction, 17 pour
orchestration. La réduction vient de responsabilités nommées et de duplication
retirée, pas d'ignores. Seuil ciblé retenu après correction et testé négativement.

Les lecteurs de manifests/cache attendent un objet JSON, pas un tableau,
primitive ou null. Avec un collecteur, ils enregistrent un diagnostic et
retournent null ; sans collecteur ils lèvent une erreur contextualisée.
Les builders sont câblés au collecteur pour conserver leurs rapports agrégés.
Une absence de cache facultatif reste normale ; une corruption ne l'est pas.

Le cache doit avoir une date valide, passée, âgée de moins de sept jours.
Un timestamp futur n'est pas une entrée fraîche. Les entités numériques hors
Unicode utilisent le caractère de remplacement, sans faire échouer la page.

## Persistance

Écrire un JSON sérialisable dans un fichier temporaire unique du même répertoire,
puis renommer. Les erreurs sont propagées et seuls les temporaires possédés
sont nettoyés. Un défaut de sérialisation ou rename conserve l'ancien fichier.
Ce mécanisme ne sérialise pas des builds concurrents ; dernière écriture réussie.

## Vérification

Reproductions avant fix, fixtures de vrais fichiers et tests de comportements
OG avec cache/timeouts/repli. Mesures de complexité/couverture réelles, puis
tests/build/browser et CI native de la PR. Pas de seuil global artificiel.
