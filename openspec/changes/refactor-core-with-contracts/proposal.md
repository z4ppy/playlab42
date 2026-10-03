## Pourquoi

Le socle tests-first de la PR #147 est livré sur main `611a29b`.
Sa CI verte ne couvre pas toute la dette de conception : reset Mastermind
dépendant de l'heure, APIs moteur divergentes, RNG Triomino dupliqué,
responsabilités mêlées dans le portail, lecteur, stockage et moteurs.
Les diagnostics de dépendances et la couverture du moteur pédagogique
restent à traiter explicitement.

## Autorisation

La demande utilisateur « Fais toutes les corrections par ordre de priorite,
applique toi et sois elegant » autorise cette implémentation en fleet.
Elle ne constitue pas une autorisation de fusion, déploiement ou archivage.

## Changements

1. Reproduire puis corriger le reset Mastermind et protéger les contrats
   communs de six moteurs réels, sans uniformiser leurs états JSON.
2. Clarifier le portail et le lecteur avec leurs comportements de concurrence,
   clavier, focus et progression conservés.
3. Refactorer stockage, moteur pédagogique et responsabilités métier ;
   mutualiser uniquement le RNG et les mécanismes réellement communs.
4. Actualiser les cinq dépendances signalées après vérification des usages
   et du rendu navigateur ; trier les diagnostics consultatifs sans les masquer.
5. Étendre la collecte aux modules extraits et au moteur pédagogique,
   mesurer puis protéger les acquis, avec preuves locales et natives distinctes.

## Impact

Moteurs et APIs, portail, bibliothèques partagées, outils utilisant Three/lil-gui,
tests, fabrication et documentation. Frontend statique, outils et frameworks
existants conservés. Pas de migration générale des formats sauvegardés,
de RNG, de règles métier ni d'architecture applicative.
