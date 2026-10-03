# Context

La branche du lot 2 part du commit du lot 1, PR #135. Les worktrees et volumes
Docker sont séparés pour conserver une PR du lot 1 stable.

# Decisions

1. Les références d'actions utilisent un SHA complet avec commentaire de version.
   Les appels réutilisables locaux restent liés au commit du workflow appelant.
2. Les images racines et E2E utilisent un digest d'index multiarche ; Dependabot
   couvre les deux répertoires, sans désactiver les mises à jour.
3. Les binaires Linux des scanners sont téléchargés dans un dossier temporaire,
   versionnés et vérifiés avant extraction/exécution. Les bases CVE restent
   actuelles : reproductibilité de l'outil ne signifie pas figer les vulnérabilités.
4. Le lint de sécurité utilise des plugins exacts et le lockfile avec npm ci,
   pas npm install --no-save en CI. Les diagnostics bruyants et analyses
   consultatives sont explicitement distincts des gates.
5. Aucune exception générale ne masque l'existant. Les diagnostics confirmés
   et liés au changement sont corrigés ; toute dérogation doit être étroite,
   justifiée, datée, limitée et relue.
6. TypeScript 7 est conservé. Le peer typescript-eslint disponible
   `>=4.8.4 <6.1.0` n'autorise pas son installation avec cette stack.
   Ne pas utiliser force/legacy-peer-deps pour simuler un support.
7. La revue des propriétés DOM a confirmé un défaut de rendu des termes
   « voir aussi » du glossaire. Utiliser l'échappement existant, sans modifier
   le rôle, les interactions et le texte des références. Ne pas en déduire
   un attaquant contrôlant les sources du dépôt.
8. Une action explicite du formateur JSON annule l'auto-formatage en attente.
   Ajouter `cancel()` au helper partagé `debounce` en conservant son contrat
   d'appel existant. Une nouvelle saisie redémarre normalement le délai ;
   vérifier avec une horloge contrôlée, pas une attente rendant la race invisible.

# Limits

La collecte OG, les bases de scanners et les registres restent des ressources
distantes. Une référence SHA/digest et un checksum ne constituent ni signature
indépendante ni attestation SLSA. Les warnings Docker et heuristiques bruyantes
doivent rester clairement identifiés tant que non corrigés.
Une CI locale ou la CI de la PR du lot 1 ne prouve pas une CI native du lot 2.
