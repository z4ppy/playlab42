## Implementation

- [x] Tests-first du classement, des empreintes et du refus des preuves invalides.
- [x] Selection et reutilisation conservative avec provenance Git verifiee.
- [x] Cablage des checks requis, de Build, Browser et de l'agregateur.
- [x] Documentation des decisions et des limites.

## Verification and delivery

- [x] Tests, lint, types, qualite et OpenSpec dans Docker.
- [x] CI native complete et scenario documentaire reel.
- [x] Scenario natif de reutilisation a entrees identiques et refus apres changement applicatif de main.
- [x] PR livree sans fusion automatique.
- [x] Revue de Dependabot #139 : tag officiel verifie, mise a jour et contrat des traces integres ; PR remplacee fermee apres CI verte.
- [ ] Fusion, publication et archivage sur decision explicite ulterieure.

## Lecture des preuves

Une decision documentaire doit garder Build, les guides et les smokes executes.
Les controles non applicables ne publient pas de rapports d'analyse fictifs.
Une decision reused cite le run et le commit de l'execution originale ; les
audits evolutifs ne sont jamais reutilises.
