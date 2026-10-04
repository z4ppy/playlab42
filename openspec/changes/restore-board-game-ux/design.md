# Décisions

Le moteur conserve le double-passe automatique par défaut, y compris ses états
JSON et trajectoires caractérisés. `manualScoring: true` active un état de revue
sérialisable avec `scoring` et les indices `deadStones`. La page l'utilise toujours.
Les commandes de jeu sont suspendues pendant la revue ; trois méthodes explicites
du moteur basculent un groupe connexe entier, confirment ou reprennent la partie.

Le score chinois est calculé sur une copie où les pierres marquées sont retirées,
sans transformer ces retraits en captures ni muter le plateau joué. Le marquage
reste visible sur le plateau final. La reprise efface le marquage et les passes,
conserve le joueur suivant, le komi et les captures. Aucun groupe n'est déclaré
mort automatiquement : les groupes non marqués restent vivants et le joueur peut
reprendre la partie si la position est disputée. En solo, la revue est contrôlée
par l'humain même si le joueur suivant est le bot ; le bot ne joue pas pendant
cette phase. Il ne s'agit pas d'une double approbation automatique fictive.

Le morpion réutilise `--color-text-muted` pour les interstices existants.
Dimensions et interactions ne changent pas. La référence CSS originale reçoit
uniquement cette correction explicite lors de sa capture ; toutes les propriétés
restent comparées exactement et une régression mesure un contraste d'au moins 3:1.

Les deux corrections sont indépendantes ; les preuves finales utilisent le
vrai build et les budgets/floors existants, sans les relâcher.
