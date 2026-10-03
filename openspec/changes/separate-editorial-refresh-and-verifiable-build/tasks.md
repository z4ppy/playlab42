- [x] 1. Lire les builders/CI et mesurer la SBOM native npm.
- [x] 2. Séparer le refresh éditorial et vérifier le build sans réseau OG.
- [x] 3. Produire et vérifier inventaire, SBOM et provenance non signée.
- [x] 4. Comparer deux builds réels et exercer corruption/restauration.
- [ ] 5. Actualiser documentation, parcours et skills ; vérifier tous les gates.
- [ ] 6. Ouvrir la PR et constater ses contrôles natifs.
- [ ] 7. Livraison/synchronisation/archivage sur décision distincte.

Preuves avant ouverture : Docker, réseau désactivé (`--network none`), deux
builds normaux et manifestes identiques, puis vraie archive tar/corruption/refus/
restauration vérifiés. Snapshot 128 URL, 117 récupérations/11 échecs facultatifs
diagnostiqués lors du refresh initial, aucune URL avec identifiants.
98 suites / 2 033 tests ; helpers/snapshot 100 %, inventaire lignes/statements/
fonctions 100 % et branches 86,66 % (gate 85 %). Lint JS/HTML/TS, sécurité,
types, audit sans CVE connue et 28 validations OpenSpec strictes réussis.
Les preuves sur le commit final et les checks natifs seront consignées séparément.
