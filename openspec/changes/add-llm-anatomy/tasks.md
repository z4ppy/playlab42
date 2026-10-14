## 1. Contrats et modèle
- [x] 1.1 Décrire le périmètre autorisé et les compromis.
- [x] 1.2 Implémenter et vérifier les opérations numériques et leurs gradients.
- [x] 1.3 Entraîner et fournir le mini-modèle, le corpus et sa provenance dans le worktree.

## 2. Parcours
- [x] 2.1 Rédiger les seize étapes, le glossaire et les sources.
- [x] 2.2 Réaliser l'identité visuelle et les expériences accessibles.
- [x] 2.3 Intégrer le laboratoire, les erreurs et les réinitialisations.

## 3. Réception
- [x] 3.1 Vérifier les tests numériques et les manifests.
- [x] 3.2 Vérifier navigateur, viewer, mobile, thèmes et réseau coupé.
- [x] 3.3 Vérifier lint, build et validation OpenSpec.
- [x] 3.4 Documenter fonctionnement, reproduction et animation.

## Vérifications réalisées

- 23 tests ciblés : gradients par différences finies, causalité, distributions,
  provenance, prédictions apprises, formules, contrat éditorial et activation
  au clavier des dix termes marqués avec le vrai composant de glossaire.
- 8 scénarios Playwright dans Chromium : toutes les expériences, manipulations,
  saisies refusées, erreur de chargement puis nouvelle tentative, clavier,
  mobile, thèmes, texte sans JavaScript et navigation du viewer.
- Navigation et inférence vérifiées dans l'archive sous le préfixe `/site/`.
- Poids réentraînés puis comparés octet par octet : identiques.
- Lint global, typecheck, build local et vérification d'artefact réussis.
- OpenSpec : 40 éléments validés, dont ce change.
- Suite globale : 181 suites réussies ; les cinq suites initialement bloquées
  par l'absence de Git/Bash dans l'image ont réussi après installation de ces
  outils (172 tests). L'exécution initiale mono-processus avait épuisé le tas ;
  la reprise utilise deux workers recyclés à 256 Mo.

Pas de push, merge, déploiement ou archivage effectué.

## 4. Enrichissement demandé après relecture
- [x] 4.1 Clarifier vecteurs et blocs, token inspecté, signes et valeurs.
- [x] 4.2 Ajouter les définitions originales de trois tokeniseurs, leurs licences et leur provenance.
- [x] 4.3 Étendre les comparaisons à un atlas 3D de coordonnées sélectionnables.
- [x] 4.4 Ajouter cinq étapes : Luciole, cas concrets, nombres, tête, scores.
- [x] 4.5 Relire les termes, expliciter la carte d'architecture et fournir des définitions pour chaque étape.
- [x] 4.6 Vérifier l'ensemble enrichi dans le navigateur, contrôler les captures et actualiser la prévisualisation.

Réception de l'enrichissement : 45 tests ciblés (epic et pipeline vendor),
18 scénarios navigateur exercés, avec reprise ciblée après correction du
décodage vide. Glisser, rotation, zoom, axes distincts, vocabulaire,
reconstruction, erreur réseau et réessai vérifiés avec les vrais composants.
Captures relues : fiche Luciole, tokeniseurs, nombres, atlas bureau/mobile,
architecture, tête et scores. Typecheck, lint, OpenSpec et artefact
(1 158 fichiers) validés. Prévisualisation reconstruite, sans déploiement.

## 5. Luciole enrichi, préentraînement visualisé
- [x] 5.1 Construire un corpus déterministe avec combinaisons réservées et entraîner un modèle légèrement plus grand.
- [x] 5.2 Publier les mesures apprentissage/validation/test, sans entraîner sur les lots réservés.
- [x] 5.3 Ajouter une lecture interactive de l'historique et des prédictions sur la fiche Luciole.
- [x] 5.4 Aligner les dimensions, explications et exemples du parcours.
- [x] 5.5 Vérifier les calculs, les vues et la prévisualisation actualisée.
- [x] 5.6 Ajouter l'échantillon multilingue Tatoeba CC0, ses sources et le détail du tokenizer réel.

## 6. Final Transformer Explainer demandé
- [x] 6.1 Adapter le véritable projet upstream, conserver sa licence et sa provenance.
- [x] 6.2 Traduire et intégrer la vue finale, avec GPT-2 chargé à la demande.
- [x] 6.3 Vérifier le fonctionnement réel et documenter les contraintes de chargement.

La version de démonstration initiale restait volontairement à 21 étapes et deux
annexes avant intégration du fork. Le final est maintenant la vingt-deuxième
étape, avec chargement facultatif et contrainte HTTPS/localhost explicite.
Luciole : 36 tests unitaires, 21 scénarios navigateur exercés (reprise ciblée
du scénario multi-étapes après clarification de son sélecteur), poids reproduits
strictement à l'identique, captures bureau/mobile relues, typecheck et OpenSpec
validés, artefact de 1 163 fichiers vérifié et servi sur la prévisualisation.

## 7. Relecture avant démonstration
- [x] 7.1 Relire les 21 étapes et annexes, corriger les ambiguïtés et préserver la version sans GPT-2.

Relecture : produit scalaire distingué du cosinus, cibles décalées et masque
causal expliqués, coûts estimés plutôt que mesurés, sous-corpus du BPE précisé,
labels français et définitions corpus/vocabulaire/NFC/Adam/nats ajoutés.
Les axes SVG restent sans remplissage, notamment sur le roofline. L'historique
annonce ses limites et démarre sur l'accord simple ; les échecs des boîtes
restent consultables. 36 tests unitaires et visite navigateur des 21 étapes
réussis après relecture. Aucune modification des poids pour la démonstration.

## 8. Plan multi-axes autorisé en fleet

Autorisation explicite : « applique le plan », puis « Applique le plan avec
fleet stp ». Les lots indépendants sont attribués à des fichiers distincts.

- [x] 8.1 Définir MLP dès l'ouverture et réorganiser les prérequis Q/K/V.
- [x] 8.2 Montrer les étapes de l'attention et la réutilisation K/V avec des manipulations accessibles.
- [x] 8.3 Unifier les quatre choix de tokenizer et les deux choix de modèle, avec capacités et limites explicites.
- [x] 8.4 Raccorder le vrai GPT-2 sans téléchargement avant consentement, faux résultat ou multiplication silencieuse de sessions.
- [x] 8.5 Régénérer et valider le parcours intégré, les erreurs, le clavier, les thèmes et le mobile.
- [x] 8.6 Actualiser la prévisualisation et la documentation après validation, sans déploiement de production.

Retest préalable : inférence GPT-2 réelle obtenue sous limite 8 Gio, 63
fragments originaux vérifiés (656 662 664 octets). Pic échantillonné du cgroup
partagé : 4 148 744 192 octets, pas une mesure exclusive du navigateur.
Le téléchargement direct Chromium était bloqué par le proxy/CORS ; le
retest a utilisé les vrais octets via un relais de test. Cette preuve ne
certifie ni le transport direct du site ni les contrôles UI restants.

Réception intégrée : 98 tests unitaires ciblés (dont packaging), 31 scénarios
Chromium, lint ciblé, typecheck et validation OpenSpec réussis. Captures
viewer, Q/K/V, cache et tokenizers mobile relues. Le vrai wrapper GPT-2 est
monté dans le cours sans importer les poids avant consentement ; changement
de modèle, annulation et nettoyage sont vérifiés. Les régressions de
compacité du viewer et de réinitialisation des tokenizers sont corrigées.

Le lot fork a ensuite validé la génération et les contrôles attention,
têtes souris/clavier, blocs, température et top-k/top-p avec les vrais poids
servis statiquement, sans relais. Le transport distant upstream reste non
certifié dans cet environnement. La prévisualisation HTTP distante ne peut
pas exécuter GPT-2 : WebCrypto requiert HTTPS ou localhost. Aucun résultat
simulé ne remplace cette limitation, et aucun poids Luciole n'a été modifié.

Prévisualisation actualisée : 22 étapes et deux annexes, artefact de 1 250
fichiers vérifié. Cinq scénarios ciblés ont aussi passé sur l'archive statique,
puis quatre sur le serveur publié 5242, dont visite de toutes les étapes,
quatre tokenizers, Q/K/V/cache et montage du vrai fork sans chargement des
poids avant consentement. Aucun push, commit ou déploiement de production.

## 9. Résolution du transport CORS autorisée le 14 octobre 2026

- [x] 9.1 Préparer explicitement les poids locaux avant le build CI et le workflow navigateur autonome.
- [x] 9.2 Refuser les poids absents/corrompus et les manifestes divergents au packaging et à la vérification d'archive.
- [x] 9.3 Ajouter un test navigateur du cours jusqu'à la première génération réelle sans requête externe.
- [x] 9.4 Exécuter les contrôles unitaires, build, lint et navigateur sur l'artefact ; consigner les résultats.

Validation CORS : 196 suites Jest (4 303 tests), 11 tests natifs du fork,
31 scénarios du cours et une inférence GPT-2 réelle sur l'archive réussis.
Le scénario réel charge les 63 fragments locaux sans requête externe (20,1 s).
Il utilise les horloges natives et ne trace pas les 657 Mo de poids : le premier
essai avec la fixture d'interface à horloge figée avait dépassé le délai ONNX.
Build, vérification d'archive, lint JS/TS et sécurité, typecheck, budget qualité
et validation OpenSpec réussis. Les tests natifs du fork sont séparés de Jest ;
le code tiers et les bundles sont exclus des linters du code du projet.

## 10. Relecture UX et pédagogique demandée le 14 octobre 2026

- [x] 10.1 Relire le contenu et observer les interfaces bureau/mobile.
- [x] 10.2 Définir les termes dès l'ouverture, aligner les consignes et clarifier les exemples et limites.
- [x] 10.3 Isoler les choix de modèle par expérience et proposer un aller-retour lecture/manipulation.
- [x] 10.4 Surligner les tokens ajoutés et expliquer les probabilités après décodage.
- [x] 10.5 Régénérer, vérifier les interactions et relire les captures finales.

Validation UX : 80 tests ciblés du parcours et 32 scénarios navigateur réussis.
Après les derniers ajustements de compacité, les neuf scénarios de sélection
et d'ergonomie ainsi que l'inférence GPT-2 réelle ont été rejoués avec succès
(63 fragments locaux, 17,8 s). Captures finales bureau 1280×900 et mobile
390×844 relues : résultat visible au premier écran sur bureau, sélecteur de
prompt lisible et continuation surlignée sur mobile. Lint JS/TS, sécurité,
typecheck, budget qualité, build et vérification de l'archive réussis.

## 11. Retrait de GPT-2 des vues qui ne le visualisent pas

Demande explicite : « Enlève la notion de GPT-2 sur les pages où il n'y a pas
de visualisation GPT-2 ».

- [x] 11.1 Retirer le sélecteur, les états indisponibles et les mentions superflues des vues propres à Luciole et des illustrations.
- [x] 11.2 Ignorer les anciens choix GPT-2 sur ces vues, préserver le véritable laboratoire et les comparaisons de tokenisation.
- [x] 11.3 Régénérer les pages, vérifier les tests et actualiser la prévisualisation.

Validation : 80 tests unitaires, 32 scénarios navigateur (29 au premier passage,
puis 3 après correction des assertions), lint JS/TS, build, vérification
d'archive et OpenSpec réussis. Le contrôle d'absence de GPT-2 porte sur le
contenu de chaque étape, en conservant les liens de navigation vers le final.
Deux assertions de relance attendaient encore l'ancien libellé du compteur ;
elles vérifient désormais « Ajouts : 1 ». La prévisualisation sert les fichiers
corrigés, y compris avec une ancienne préférence GPT-2 enregistrée.

## 12. Correction après retour de test utilisateur

- [x] 12.1 Réserver l'accès au laboratoire GPT-2 au final ; retirer aussi le menu, le lien bibliographique et la mention GPT-2 de la première étape.
- [x] 12.2 Reproduire le défaut des fragments protégés par une session, puis conserver les credentials uniquement sur la même origine.
- [x] 12.3 Remplacer le diagnostic CORS générique par l'étape de chargement et le fichier en erreur.
- [x] 12.4 Reconstruire le fork, vérifier une inférence réelle avec accès protégé et actualiser la prévisualisation.

La capture utilisateur confirme le manifeste local, mais ne précise pas la
requête en échec. Son URL en `.ilex.localhost` n'est pas accessible directement
depuis cet environnement. Le test reproduit un accès protégé par cookie :
avant correction, la requête des poids omet ce cookie et échoue (2,4 s) ; après
correction, les 63 fragments sont chargés et une inférence réelle aboutit
(25,9 s), sans accès externe. Cela vérifie le défaut de session identifié,
sans attribuer avec certitude l'erreur de la capture à une requête précise.

Validation : 80 tests du parcours, 12 tests natifs du fork et 33 scénarios
navigateur réussis, dont l'inférence protégée et la visite des 22 étapes.
Build du fork, intégrité des poids, build et vérification des 1 279 fichiers,
lint JS/TS, sécurité, typecheck et OpenSpec réussis. Capture finale du viewer
relue : aucun sélecteur de modèle ni lien GPT-2 dans la première expérience.

## 13. Laboratoire indépendant et informations escamotables

Après confirmation du chargement fonctionnel, l'utilisateur demande explicitement
une ouverture uniquement dans un nouvel onglet et la possibilité de fermer les
informations du haut pour explorer en plein écran.

- [x] 13.1 Remplacer le montage intégré par un lien vers un nouvel onglet, conserver le thème et supprimer le sélecteur de modèle du final.
- [x] 13.2 Permettre de masquer et réafficher les informations après chargement, avec transfert du focus clavier et conservation du modèle et du prompt.
- [x] 13.3 Ajouter les commandes de plein écran natif et réserver la hauteur disponible à la visualisation lorsque les informations sont masquées.
- [x] 13.4 Vérifier l'ouverture depuis le viewer, l'indépendance de l'onglet, le plein écran et une nouvelle génération sans recharger les poids.
- [x] 13.5 Actualiser les consignes, les contrats documentés et la prévisualisation.

Validation : 73 tests unitaires du parcours, 12 tests natifs du fork et 33
scénarios navigateur réussis. Après les derniers ajustements CSS, ouverture
depuis le viewer et scénario GPT-2 réel rejoués avec succès (27,8 s pour ce
dernier), avec fragments protégés par cookie, masquage/réaffichage, plein écran
et seconde génération sans requêtes de poids supplémentaires. Les 12 tests
unitaires affectés par le dernier ajustement JavaScript et les 12 tests natifs
ont également été rejoués. Capture du laboratoire compact relue : pas de
défilement extérieur, contrôles accessibles et visualisation conservée.

Lint JS/TS, sécurité, typecheck, OpenSpec, build du fork et vérification des
1 279 fichiers de l'archive réussis. Aucun commit, push ou déploiement de production.

## 14. Relecture pédagogique slide par slide

Demande explicite du 14 octobre 2026 : explication avant expérimentation,
clarification scientifique et pédagogique, schémas Q/K/V/cache, anecdotes
sourcées et liens vers le code réel de Luciole. Recherche documentaire confiée
à deux sous-agents GPT-6.1 Sol autorisés par l'utilisateur.

- [x] 14.1 Relire les 22 étapes et les annexes ; clarifier les termes, exemples et limites à partir des sources vérifiées.
- [x] 14.2 Placer les explications avant les expériences et les scores avant la logit lens, avec navigation locale accessible.
- [x] 14.3 Illustrer Q/K/V et le cache avec des calculs, des étapes et une distinction explicite token traité/token prédit.
- [x] 14.4 Générer les extraits depuis les sources réelles et offrir leur lecture complète dans Playlab42.
- [x] 14.5 Régénérer, vérifier lecture et interactions sur bureau/mobile, puis actualiser la prévisualisation.

Relecture consignée dans l'ordre pédagogique final :

| Étape | Clarification principale |
|---|---|
| 01 · Un token | Portée autorégressive, boucle illustrée, première définition simplifiée de MLP |
| 01b · Luciole | Accès au code local et rôle des trois fonctions d'entrée |
| 02 · Tokenisation | Construction du BPE distincte de son application ; anecdote sourcée |
| 02b · Cas réels | Signification des marqueurs internes et reconstruction normalisée |
| 03 · Prompt | Appel généré distinct de son exécution par l'application |
| 03b · Nombres | Exemple de somme pondérée et notion de position représentée |
| 04 · Embeddings | Table lexicale, position puis état contextualisé ; code réel |
| 05 · Architecture | Origine en traduction, trajet illustré et opérations dans le code |
| 06b · Têtes | Rôles Q/K/V, paramètres vs résultats, calcul [0,5 ; 1] relié à l'expérience |
| 07 · Attention | Diagonale autorisée et somme par ligne, sans contrainte par colonne |
| 06 · Position | Invariance RoPE à contenu fixe, distincte de celle d'un modèle complet |
| 08 · Experts | Routage par position ; exemple V3 explicitement attribué |
| 09b · Scores | Avant la logit lens ; invariance à un décalage commun et code softmax |
| 09 · Logit lens | Lecture par sonde distincte d'une décision ; tuned lens non implémentée |
| 10 · Tirage | Ordre min-p puis top-p conforme au code ; exemple renormalisé |
| 11 · Effort | Entraînement au raisonnement et calcul à l'inférence, exemple R1 sourcé |
| 12 · Cache | Pourquoi K/V et pas les anciens Q ; frise traité/prédit ; mémoire vérifiée |
| 13 · Performance | Premier token vs intervalle entre tokens ; FlashAttention et limites |
| 14 · Apprentissage | Entrées/cibles décalées ; préfixes du corpus vs générés ; DPO ; code |
| 15 · Laboratoire | Comparaison contrôlée France/Belgique et code des traces réelles |
| 16 · Synthèse | Intervention contrôlée pour tester une interprétation |
| 16b · Final | GPT-2 situé historiquement en 2019 ; onglet indépendant conservé |
| Sources et glossaire | Références complémentaires, code complet local, définitions Q/K/V et prefill |

Sources primaires et documentation consultées par les deux agents ; seconde
relecture des modifications sans erreur scientifique matérielle restante.
Les nombres du schéma Q/K/V correspondent au réglage initial de toyAttention,
et la formule de cache illustrée donne bien 5 120 octets. Aucun poids ni
algorithme numérique de Luciole n'a été modifié.

Validation : 73 tests unitaires du parcours et 33 scénarios navigateur
réussis au total (29 au premier passage, puis reprises ciblées des anciens
libellés et critères d'ordre). Le contrôle de thèmes revient à l'explication
avant l'itération suivante au lieu de conserver le défilement de la manipulation.
Lecture du code sans JavaScript sur mobile, navigation dans le viewer, ordre
visuel des 22 explications et interactions vérifiés. Lint JS/TS et sécurité,
validation stricte des 40 éléments OpenSpec et archive de 1 281 fichiers réussis.

## 15. Distributions pédagogiques pour le tirage

Demande explicite : remplacer Luciole dans le tirage et réaliser les autres
améliorations utiles après examen du parcours.

- [x] 15.1 Introduire trois situations fictives, probabilités avant/après, top-k/top-p/min-p et motifs d'exclusion sans charger de modèle.
- [x] 15.2 Ajouter des tirages unitaires et cumulés reproductibles avec réinitialisation des observations après modification des réglages.
- [x] 15.3 Distinguer les probabilités initiales et le choix forcé dans les vues de génération ; ouvrir la logit lens sur un exemple moins concentré.
- [x] 15.4 Vérifier les calculs, l'accessibilité, le mobile et l'absence de chargement de poids ; régénérer et actualiser la prévisualisation.
- [x] 15.5 Corriger l'initialisation des curseurs décimaux : définir step avant value et afficher la valeur réellement retenue par le navigateur.

Examen des autres expériences : Q/K/V et scores possèdent déjà un premier
mode inventé ; cache, MoE, RoPE, effort et performance sont déjà conceptuels.
Les embeddings et l'attention restent réels : les remplacer fabriquerait des
observations sur Luciole. L'historique conserve les vraies mesures et échecs.
La logit lens garde ses tenseurs réels avec « le chat » en premier exemple
(en sortie : près ≈ 62,7 %, joue ≈ 21,1 %, dort ≈ 14,0 %), comparables à la
capitale de la France, dominée par paris ≈ 97,8 %. Mesures faites sur les poids
publiés, sans les modifier ni amplifier artificiellement les écarts.

Défaut supplémentaire reproduit par le test navigateur du reset : le helper
range définissait value avant step. Pour top-p (min=0,05, max=1), Chromium
arrondissait la valeur demandée 1 à 0,05 avec le pas implicite 1, puis le
libellé affichait tout de même 1. Cette divergence peut expliquer un candidat
unique dans l'ancienne expérience. La correction porte sur le helper partagé ;
le test vérifie la valeur effective et la distribution, au chargement et après
réinitialisation, plutôt que le seul texte de l'étiquette.

Validation : 76 tests unitaires du parcours (12 suites) et 35 scénarios
navigateur réussis après correction du helper partagé. Lint JS/TS et sécurité,
validation stricte des 40 éléments OpenSpec réussis. Contrôle visuel du tirage
sur ordinateur et mobile ; le sélecteur de situation a été élargi pour éviter
les libellés tronqués, puis son scénario navigateur a été rejoué avec succès.
Sources générées synchronisées et prévisualisation actualisée ; archive de
1 282 fichiers vérifiée. Aucun commit, merge ou déploiement en production.
