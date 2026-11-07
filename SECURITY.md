# Politique de sécurité

## Versions concernées

Playlab42 est un site statique publié en continu depuis la branche `main` ([version en ligne](https://z4ppy.github.io/playlab42/)). Seule cette version reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

**Merci de ne pas ouvrir d’issue publique pour une faille de sécurité.**

1. Utilisez le [signalement privé de vulnérabilité GitHub](https://github.com/z4ppy/playlab42/security/advisories/new) (onglet *Security* → *Report a vulnerability*). Seuls les mainteneurs voient votre rapport.
2. À défaut, écrivez à **z4ppy.bbc@gmail.com** en précisant « Playlab42 – sécurité » dans l’objet.
3. Joignez : une description, les étapes pour reproduire, l’impact estimé et, si possible, une piste de correction.

Vous recevrez un accusé de réception, puis des nouvelles de l’analyse. Le projet est maintenu par une petite équipe : comptez quelques jours ouvrés plutôt que quelques heures.

## Périmètre

Sont concernés : le portail, les outils, les jeux et les parcours publiés, les scripts de build et les workflows GitHub Actions du dépôt.

Ne sont pas concernés : les sites externes référencés dans les bookmarks, et les vulnérabilités qui n’existent que dans un fork modifié.

Le site n’a ni compte utilisateur ni serveur applicatif ; les préférences, scores et progressions restent dans le `localStorage` du navigateur.

## Ce qui est déjà surveillé

Les dépendances, l’image Docker et les secrets sont contrôlés automatiquement (audit npm, Trivy, détection de secrets, Dependabot). Le détail est dans [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md), [docs/SECURITY_SETUP.md](docs/SECURITY_SETUP.md) et [.github/docs/PIPELINES.md](.github/docs/PIPELINES.md).

## Divulgation

Nous préférons une divulgation coordonnée : merci de laisser un délai raisonnable pour corriger avant toute publication. Les personnes qui signalent une faille de bonne foi seront remerciées, si elles le souhaitent, dans le [changelog](CHANGELOG.md).
