## Priorités et indépendance

Le déterminisme Mastermind et la conformité moteur sont prioritaires.
Portail, lecteur, stockage, moteur pédagogique et dépendances sont indépendants
sur fichiers distincts : ils peuvent être caractérisés en parallèle.
L'extraction RNG puis la décomposition des moteurs partent des contrats
corrigés ; le triage final part du code réellement intégré.

Chaque domaine possède son worktree. Les configurations centrales, guides,
parcours et preuves intégrées sont coordonnés par l'intégrateur. Une extraction
ne justifie ni fichier fourre-tout ni super-classe de moteur.

## Compatibilité

Conserver méthodes et formats utilisés par les interfaces ; privilégier des
accesseurs ou alias additifs pour harmoniser le contrat public. Les états
spécifiques ne doivent pas être forcés dans BaseGameState.
Pour Mastermind, la seed de nouvelle partie vient explicitement de l'appelant :
le moteur ne consulte pas l'heure. Les refus sont explicites et testés.

Les séquences RNG, états de replay, ordre des actions et scores servent
de références avant extraction. Ne pas remplacer des copies ciblées par
un clonage universel ni mélanger les géométries des jeux.
Les imports ESM doivent fonctionner dans Jest, Node et le site fabriqué.

Le lecteur doit tester ses composants réels avant suppression des chemins
de rendu de compatibilité. Les préférences, refus de stockage, formats futurs,
focus, messages et fermetures différées conservent leurs garanties.

## Preuves et limites

Tests avant corrections/refactorings, avec reproductions rouges conservées
pour les défauts confirmés. Mesurer la complexité des fonctions, pas seulement
la longueur des fichiers. Ne pas abaisser les seuils existants.
La collecte couvre les modules extraits et le moteur pédagogique ; la
couverture des subprocessus et E2E reste une preuve différente.

Tout runtime passe par Docker. Les dépendances sont mises à jour sans peers
forcés ; Three et lil-gui sont vérifiés avec leurs vraies distributions dans
Chromium, pas uniquement via les mocks Jest.
Un warning heuristique n'est pas une vulnérabilité confirmée : documenter
les classes restantes et corriger les problèmes concrets du périmètre.

Validation intégrée : lint, sécurité, types, audit, OpenSpec, tests complets,
deux builds hors réseau, intégrité/reprise et Chromium sur archive préparée.
La CI de la dernière tête et son artefact sont vérifiés séparément.
