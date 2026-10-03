- [x] 1. Lire les builders/CI et mesurer la SBOM native npm.
- [x] 2. Séparer le refresh éditorial et vérifier le build sans réseau OG.
- [x] 3. Produire et vérifier inventaire, SBOM et provenance non signée.
- [x] 4. Comparer deux builds réels et exercer corruption/restauration.
- [x] 5. Actualiser documentation, parcours et skills ; vérifier tous les gates.
- [x] 6. Ouvrir la PR et constater ses contrôles natifs.
- [ ] 7. Livraison/synchronisation/archivage sur décision distincte.

Preuves avant ouverture : Docker, réseau désactivé (`--network none`), deux
builds normaux et manifestes identiques, puis vraie archive tar/corruption/refus/
restauration vérifiés. Snapshot 128 URL, 117 récupérations/11 échecs facultatifs
diagnostiqués lors du refresh initial, aucune URL avec identifiants.
98 suites / 2 033 tests ; helpers/snapshot 100 %, inventaire lignes/statements/
fonctions 100 % et branches 86,66 % (gate 85 %). Lint JS/HTML/TS, sécurité,
types, audit sans CVE connue et 28 validations OpenSpec strictes réussis.
Les preuves sur le commit final et les checks natifs seront consignées séparément.
Commit propre 72e8cd7 : deux builds dans Docker sans réseau, manifestes égaux,
1 069 fichiers vérifiés et reprise tar réussie. SBOM npm : 511 composants de
fabrication sur la plateforme locale. 64 Chromium sur ce site inchangé ;
hash du manifeste et inventaire complet revérifiés après navigateur.

Limite découverte après cette première preuve : le build local incluait 96
images du cache ignorées par Git ; l'archive native n'avait que 973 fichiers.
Les hashes et Chromium seuls n'ont pas détecté les références d'images absentes.
Cette preuve initiale ne suffit donc pas à clôturer le lot.
Correction : snapshot avec trois images locales revues et 98 références HTTP(S),
pas de repli implicite sur le cache au build, copie des seules images locales
référencées et contrôle de ces références dans l'archive vérifiée.
Correctif propre b18b891 : 98 suites / 2 043 tests, lint JS/HTML/TS et sécurité,
types, audit sans CVE connue et 28 validations OpenSpec strictes réussis.
Deux vrais builds Docker sans réseau : 972 fichiers et manifestes identiques.
Un troisième build depuis les seuls fichiers Git, sans cache OG et avec les
mêmes dépendances physiques installées, produit exactement le même manifeste.
Reprise tar réussie dans les deux contextes. Trois images locales référencées
livrées ; aucun téléchargement ignoré publié. SBOM locale : 511 composants.
64 Chromium, manifeste inchangé et inventaire/references revérifiés ensuite.

PR #143 : CI 37140120440 et sécurité 37140120209 réussies sur b18b891.
Les logs natifs confirment les deux builds, comparaison et reprise à 972
fichiers ; Chromium valide l'archive extraite (64 scénarios). Le SHA natif
de l'artefact est celui du merge de PR eabd9d3, pas celui de la branche.
La livraison et l'archivage restent soumis à une décision distincte (tâche 7).
