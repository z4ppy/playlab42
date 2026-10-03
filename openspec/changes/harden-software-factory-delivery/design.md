# Context

Playlab42 reste une application statique, développée dans Docker. Aucun backend,
orchestrateur externe, moteur de workflow IA ou service de télémétrie n'est ajouté.

# Decisions

1. `ci.yml` répond aux PR, au déclenchement manuel et à `workflow_call`.
   `deploy.yml` est l'unique entrée automatique sur push `main` et appelle cette CI.
   Cela évite deux suites CI identiques sur chaque push de production.
2. Le job build produit `site/` et l'archive `github-pages`. Le job navigateur
   dépend du build, extrait cette archive dans `site/` et lance Playwright en mode
   préconstruit. Le déploiement attend le succès de toute la CI appelée et
   consomme la même archive du même run, sans autre checkout/build.
3. Seuls les fichiers web et sources Markdown nécessaires au lecteur sont
   copiés. Dépendances npm, tests, caches et configuration d'agents ne constituent
   pas le site. Les sources réservées au dépôt sont référencées sur GitHub.
4. `site/build-info.json` contient version et commit CI. Le smoke test compare
   ce commit et vérifie portail, catalogues, guide et premiers modules.
   Il ne prétend pas remplacer les interactions Playwright ou une mesure de disponibilité.
5. Un lancement manuel de publication hors `main` échoue explicitement.
   Un smoke test échoué signale un incident après publication, sans rollback
   automatique. Les réessais bornés sont affichés pour la propagation Pages.
6. Le serveur Playwright préconstruit utilise la configuration `serve.json` du
   dépôt sans copier cette configuration dans le site ; les URL `.html` restent
   intactes. Le lecteur autorise les références dans un nouvel onglet et la
   navigation principale sur activation utilisateur, sans `allow-top-navigation`.
   Le rendu courant et le rendu historique conservent les mêmes permissions.

# Alternatives

`workflow_run` ajouterait une frontière de privilèges et le risque de publier un
autre SHA. Une reconstruction après validation ne prouverait pas l'identité des
fichiers livrés. Une plateforme Kubernetes/Backstage est disproportionnée ici.

# Remaining Limits

Le build de production conserve l'enrichissement Open Graph existant ; il n'est
pas hermétique. Les seuils de couverture, audits, versions d'actions et protections
distantes gardent leur politique actuelle et sont détaillés dans la feuille de route.
La CI native GitHub et la publication ne peuvent être annoncées comme exécutées
avant une PR/autorisation de livraison.
