## Decisions

Le workflow se lance toujours. Un job Impact lit le diff entre la base de PR
et le commit de merge effectivement checkout. Les suppressions et renommages
sont traites comme chemins modifies. Un chemin inconnu ou un diff indisponible
impose le parcours complet avec explication.

Les jobs requis ne sont pas ignores au niveau du job. Leurs etapes rendent
un resultat explicite : execution, documentation, non-applicabilite ou
reutilisation. Build refuse toujours un amont echoue, annule ou ignore.
Un agregateur dans le check Browser requis refuse egalement tout resultat
manquant, non reussi ou contraire au plan. L'ecriture et l'archivage des preuves
font partie de ce check, apres les tests et smokes, pas d'un job facultatif.

Le parcours documentaire execute les contrats des guides, skills et parcours,
la fabrication reproductible, la verification de l'archive, les interactions
des guides et les smokes multi-moteurs. Les slides HTML restent du code.
Les sources partagees, dependances et changements de fabrication imposent
une validation complete. Les autres selections restent conservatives :
pas de decoupage des floors Jest par jeu dans ce lot.

La reutilisation ne vient pas d'un cache librement inscriptible. Une preuve
JSON est publiee par l'agregateur, puis recherchee parmi les runs CI reussis
de la meme PR et du meme depot. Son commit est recupere et ses empreintes
recalculees depuis Git ; le workflow et les scripts de selection en font partie.
Seules les executions originales sont reutilisables, jamais une chaine de
reutilisations. Les erreurs d'API, preuves absentes, expirees ou invalides
declenchent une nouvelle execution avec avertissement.

Les empreintes Jest comprennent toute la documentation, car des tests la
lisent. L'empreinte navigateur applicative exclut seulement les Markdown
documentaires connus ; les guides, la nouvelle archive et les smokes restent
testes. Node exact et image de runner sont compares ; une divergence dans
un job invalide sa reutilisation et son eligibilite comme preuve originale.

Les audits npm, Trivy et Gitleaks ne sont pas reutilises : leurs bases et
leurs entrees historiques evoluent. Les publications et executions manuelles
restent completes. Les anciens runs PR sont annulables ; les publications en
cours ne sont pas interrompues.

## Limits

Les premiers runs et les forks sans acces aux artefacts executent les controles.
Une empreinte egale n'est ni une attestation signee, ni une garantie d'absence
de bugs. Aucun gain de duree n'est annonce sans mesure native.
