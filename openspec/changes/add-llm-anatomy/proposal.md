# Anatomie d'un LLM — Suivez ce token

## Why

Rendre le fonctionnement d'un Transformer observable dans un parcours autonome,
en français, accessible à un public technique non spécialiste.
L'utilisateur a explicitement autorisé l'implémentation du plan le 12 octobre
2026. Cette autorisation ne vaut ni revue, ni merge, ni déploiement.
Le même jour, l'utilisateur a demandé plusieurs vrais tokeniseurs et une vue
3D. Il a choisi la comparaison des découpages avec les seuls embeddings
de Luciole, plutôt que le chargement des poids de plusieurs modèles.
Après le plan multi-axes, il a autorisé son application en fleet le même jour :
quatre tokenizers (Luciole, GPT-2, BERT, T5), deux modèles de génération
(Luciole et GPT-2), choix transparents et progression accessible aux novices.
MLP doit être défini dès la première étape ; Q/K/V, attention et cache doivent
être expliqués avant les formules et reliés à des manipulations.

## What Changes

- Vingt-deux étapes pédagogiques, sources, glossaire et fiche d'animation.
- Visualisations natives, calculs inspectables et défis formatifs.
- Mini-Transformer entraîné localement sur un corpus pédagogique publié :
  inférence Luciole réelle sans réseau ni API ; GPT-2 reste un choix lourd explicite.
- Thèmes, navigation et progression du viewer existant conservés.
- Tokeniseurs GPT-2 (BPE), BERT (WordPiece) et T5 (Unigram) locaux,
  indépendants du vocabulaire de Luciole ; comparaison d'un même texte.
- Atlas 3D de trois coordonnées sélectionnables parmi celles de Luciole,
  orientation et zoom, comparaison inchangée dans l'espace complet.

## Capabilities

### New Capabilities

- `llm-anatomy`: parcours et laboratoire numérique explicite et reproductible.

### Modified Capabilities

Aucune modification du contrat du viewer.

## Impact

Nouveau dossier `parcours/epics/anatomie-llm/`, scripts de préparation et tests.
Pas de nouveau framework dans les slides, ni backend applicatif. Le fork
Transformer Explainer conserve sa propre chaîne de fabrication isolée.
Moteur Tokenizers.js épinglé,
préparé par le build vendor existant, et vocabulaires publics locaux avec
révisions, empreintes et licences. Les poids de BERT et T5 ne sont pas intégrés.
Le mini-modèle conserve une distribution
minuscule, inspectable et réellement hors connexion. Il ne représente pas les
capacités linguistiques d'un LLM de production. Les variantes modernes sont
des simulations distinctes et identifiées.

La relecture demandée couvre tout le parcours : cinq étapes intermédiaires
supplémentaires, vocabulaire contextuel, explications progressives dans la
carte d'architecture et fiche de Luciole avec son corpus et son entraînement.

L'utilisateur a ensuite choisi explicitement `visualization-only` : agrandir
modestement Luciole, enrichir son corpus et visualiser le préentraînement
effectué avant publication. Pas d'entraînement dans le navigateur ni de
poids personnels. Deux tâches synthétiques disposent de combinaisons réservées,
avec séparation apprentissage/validation/test et publication des échecs.

Il a également demandé un petit corpus multilingue ouvert, français compris,
et une explication du tokenizer. Le corpus conserve les exercices contrôlés
et ajoute un échantillon Tatoeba CC0 dont les textes et sources sont publiés.
Enfin, le choix explicite `original-gpt2` rétablit le final initialement
envisagé : un véritable fork de Transformer Explainer, interface française,
charte Playlab42 et GPT-2 chargé à la demande, distinct de Luciole.

Le 14 octobre 2026, après revue du problème CORS, l'utilisateur a autorisé
la résolution proposée (« Vas y c'est parti ») : préparation des poids GPT-2
statiques dans la CI, refus des paquets incomplets et test d'inférence réelle
sur l'artefact. HTTPS/localhost reste requis. Aucun backend n'est ajouté.

La demande suivante étend la relecture à l'UX, à la présentation et au contenu,
avec autorisation de corriger les ambiguïtés et manques pour une lecture débutante.
Le modèle sélectionné devient propre à l'expérience afin de préserver le
parcours lors des changements de chapitre. Les textes, repères de génération
et accès aux explications sont clarifiés.

Le 14 octobre 2026, l'utilisateur demande une nouvelle relecture slide par
slide : explications avant expérimentations, clarification et simplification,
références scientifiques vérifiées, schémas Q/K/V et KV cache, et lecture du
code Luciole avec extraits. Il autorise la recherche documentaire par des
sous-agents GPT-6.1 Sol. La mise à jour conserve les mécanismes numériques et
les poids existants ; les variantes modernes sont explicitement attribuées.

L'utilisateur autorise ensuite le remplacement de Luciole dans l'expérience
de tirage par trois distributions pédagogiques contrôlées, et demande les
améliorations utiles ailleurs. Les vues de génération séparent désormais
probabilités initiales et choix après réglage ; la logit lens commence avec
un contexte moins concentré. Les poids appris restent inchangés.
