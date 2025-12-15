# Proposal: add-coding-agents-epic

## Résumé

Ajouter une epic pédagogique sur les Coding Agents en 2025 : un guide technique complet pour développeurs couvrant l'écosystème, l'architecture interne, les capacités/limitations et les perspectives 2026.

## Motivation

### Contexte

Les coding agents représentent l'évolution la plus significative des outils de développement depuis l'introduction des IDE modernes. En décembre 2025, le marché a atteint une maturité remarquable avec Claude 4.5 Sonnet atteignant 77,2% sur SWE-bench Verified et 85% des développeurs utilisant régulièrement des outils IA (JetBrains).

### Objectifs

- Fournir un **panorama complet** de l'écosystème des coding agents
- Expliquer l'**architecture technique** sous-jacente (ReAct, tool use, RAG, etc.)
- Présenter un **état des lieux réaliste** des capacités et limitations
- Anticiper les **évolutions 2026** (MCP, autonomie, gouvernance)

### Cas d'usage

1. **Développeur débutant IA** : Comprendre le paysage des outils disponibles
2. **Développeur expérimenté** : Approfondir les mécanismes internes
3. **Architecte/Lead** : Évaluer les capacités réelles et les risques

## Changements proposés

### Structure de l'Epic

L'article sera découpé en **6 sections**, chacune correspondant à une slide :

```
parcours/epics/coding-agents-2025/
├── epic.json
├── thumbnail.svg
└── slides/
    ├── 01-introduction/
    │   ├── slide.json
    │   └── index.html
    ├── 02-panorama/
    │   ├── slide.json
    │   └── index.html
    ├── 03-agents-autonomes/
    │   ├── slide.json
    │   └── index.html
    ├── 04-architecture/
    │   ├── slide.json
    │   └── index.html
    ├── 05-capacites-limitations/
    │   ├── slide.json
    │   └── index.html
    └── 06-perspectives-2026/
        ├── slide.json
        └── index.html
```

### Contenu des slides

| Slide | Titre | Contenu |
|-------|-------|---------|
| 01 | Introduction | Contexte 2025, stats clés (77,2% SWE-bench, 85% adoption) |
| 02 | Panorama | IDE AI-native, CLI, extensions open source, enterprise |
| 03 | Agents autonomes | Devin, SWE-agent, OpenHands, écosystème émergent |
| 04 | Architecture interne | ReAct, boucle agent, tool use, contexte, mémoire, sandboxing, multi-agents |
| 05 | Capacités et limitations | Benchmarks, forces, faiblesses (hallucinations, multi-fichiers) |
| 06 | Perspectives 2026 | MCP, autonomie, gouvernance, évolution du métier |

### Manifest de l'Epic (`epic.json`)

```json
{
  "id": "coding-agents-2025",
  "title": "Coding Agents en 2025",
  "description": "Guide technique complet sur les coding agents : écosystème, architecture, capacités et perspectives.",
  "hierarchy": ["playlab42"],
  "tags": ["ia", "dev", "avance"],
  "metadata": {
    "author": "cyrille",
    "created": "2025-12-13",
    "duration": "45 min",
    "difficulty": "intermediate"
  },
  "icon": "🤖",
  "content": [
    { "id": "01-introduction" },
    { "id": "02-panorama" },
    { "id": "03-agents-autonomes" },
    { "id": "04-architecture" },
    { "id": "05-capacites-limitations" },
    { "id": "06-perspectives-2026" }
  ]
}
```

### Mise à jour taxonomie

Ajouter les tags manquants dans `parcours/index.json` :

```json
"tagLabels": {
  ...
  "agent": "Agents IA",
  "coding": "Coding"
}
```

## Impact

| Fichier | Changement |
|---------|------------|
| `parcours/epics/coding-agents-2025/` | Nouveau dossier avec epic + 6 slides |
| `parcours/index.json` | Ajout tags (optionnel) |
| `data/parcours.json` | Mis à jour par build |

## Specs impactées

Aucune spec à modifier. L'epic suit le format existant défini dans `openspec/specs/parcours/spec.md`.

## Risques

- **Faible** : Ajout pur, pas de breaking changes
- Contenu dense à formater correctement en HTML

## Statut

- [ ] Proposal validée
- [ ] Implémentation en cours

---

## Annexe : Contenu source de l'article

# Les coding agents en 2025 : guide technique complet pour développeurs

Les coding agents représentent l'évolution la plus significative des outils de développement depuis l'introduction des IDE modernes. Ces systèmes autonomes combinent des LLM avec des capacités d'action concrètes (lecture/écriture de fichiers, exécution de commandes, navigation dans le code) pour accomplir des tâches de développement complexes. En décembre 2025, le marché a atteint une maturité remarquable avec **Claude 4.5 Sonnet atteignant 77,2% sur SWE-bench Verified** — contre moins de 2% il y a deux ans — et **85% des développeurs utilisant régulièrement des outils IA** selon JetBrains. Ce chapitre explore l'écosystème actuel, l'architecture technique sous-jacente, les capacités et limitations réelles, ainsi que les évolutions attendues pour 2026.

---

## Panorama des coding agents : un écosystème en consolidation rapide

L'écosystème des coding agents se structure autour de trois catégories distinctes : les outils intégrés aux IDE, les assistants CLI, et les agents autonomes. Chaque approche répond à des besoins différents en termes d'autonomie, de contrôle et d'intégration dans les workflows existants.

### Les IDE AI-native dominent le marché grand public

**Cursor** s'est imposé comme l'IDE de référence pour le développement assisté par IA. Construit sur VS Code, il propose un **Agent Mode par défaut** qui combine chat, édition et exécution de commandes terminales. Son architecture repose sur un système d'embeddings pour l'autocontext et des checkpoints permettant le retour à n'importe quelle version précédente. Cursor supporte les modèles d'OpenAI, Anthropic, Google et xAI via un système de routage intelligent. Le pricing s'échelonne de gratuit (2000 completions/mois) à **$200/mois pour Ultra** avec 5000 requêtes agents rapides.

**Windsurf** (Codeium), acquis par Cognition Labs en juillet 2025, propose une approche différente avec son moteur **Cascade**. Celui-ci construit un graphe de dépendances via analyse statique pour comprendre les relations entre fichiers, permettant des éditions multi-fichiers plus cohérentes. Le context engine supporte jusqu'à **32k tokens** pour les opérations complexes. Son positionnement tarifaire plus agressif ($15/mois) et son interface plus guidée en font une alternative populaire à Cursor, particulièrement pour les équipes.

**GitHub Copilot** a évolué d'un simple outil d'autocomplétion vers un véritable agent. L'**Agent Mode** (GA avril 2025) itère sur son propre code, détecte et corrige les erreurs automatiquement, et exécute des commandes terminal. Il atteint **56% sur SWE-bench Verified avec Claude 3.7**. L'intégration native avec GitHub (PRs, Issues, Actions) et le support multi-IDE (VS Code, JetBrains, Eclipse, Xcode) constituent ses principaux avantages. Le **Code Review Agent**, utilisé par plus d'un million de développeurs, automatise la revue des pull requests.

### Les outils CLI offrent flexibilité et automatisation

**Claude Code** d'Anthropic représente l'approche CLI la plus aboutie. Initialement projet de recherche interne, il offre un accès proche du modèle brut sans workflows imposés. Ses fonctionnalités incluent la recherche agentique automatique dans le codebase, l'exécution terminal, les subagents pour workflows parallèles, et les **hooks** pour automatisation (tests après changements, lint avant commits). Une version web asynchrone permet depuis novembre 2025 de déléguer des tâches longues. Claude Code fonctionne comme client ET serveur **MCP** (Model Context Protocol), facilitant l'extension de ses capacités.

**Aider**, développé par Paul Gauthier, excelle dans l'intégration Git. L'outil écrit actuellement **70% du nouveau code de chaque release** de lui-même. Son architecture **Repo Map** cartographie le codebase entier pour optimiser le contexte, tandis que le **mode Architect** sépare raisonnement (modèle puissant) et application d'édits (modèle rapide). Le support de modèles multiples (Claude, GPT, DeepSeek, modèles locaux via Ollama) et l'interface vocale en font un outil particulièrement flexible. Sur le benchmark Polyglot, Aider atteint **84,9% avec o3-pro**.

**OpenAI Codex CLI** est un agent actif développé en Rust, distinct de l'ancien modèle Codex déprécié. Les releases fréquentes (dernière : 13 décembre 2025) ont introduit **GPT-5.1-Codex-Max**, optimisé pour les tâches agentiques longues (24h+) avec gestion automatique du contexte via compaction. L'intégration native ChatGPT et les SDK disponibles (TypeScript, GitHub Actions) facilitent l'adoption en entreprise.

### Les extensions open source démocratisent l'accès

**Cline** (ex-Claude Dev), avec **2,4 millions d'installations** VS Code, est l'extension agentique la plus populaire. Son approche **human-in-the-loop** requiert l'approbation pour chaque action, offrant un contrôle granulaire. Le support de providers multiples (Anthropic, OpenAI, Google, AWS Bedrock, modèles locaux) et le suivi des coûts en temps réel répondent aux besoins de privacy et de contrôle budgétaire. **Cline Enterprise** ajoute SSO, audit trails et déploiement VPC.

**Continue.dev** adopte une architecture modulaire en trois couches (Core, Extension, GUI) permettant une personnalisation totale. Le support des modèles locaux via Ollama ou LM Studio garantit un fonctionnement **100% local sans fuite de données**. Le nouveau **CLI (`cn`)** permet une utilisation headless pour l'intégration CI/CD.

### Les solutions enterprise se différencient sur la compliance

**Amazon Q Developer** (ex-CodeWhisperer) mise sur l'**intégration AWS native** : questions sur les ressources du compte, génération de commandes CLI, troubleshooting CloudWatch et Lambda. Les agents autonomes gèrent l'implémentation de features complètes. La conformité enterprise (SOC 2, ISO 27001, HIPAA, PCI) et l'IP indemnity sur le tier Pro ($19/user/mois) ciblent les grandes organisations.

**Tabnine** se positionne comme le seul outil offrant un déploiement **100% air-gapped** via bundles Dell PowerEdge + NVIDIA GPUs. Le **Privacy by design** (entraînement uniquement sur code sous licence permissive, zero data retention) répond aux besoins des industries régulées (finance, défense, santé). Le support de **600+ langages** et la détection automatique de snippets non-conformes aux licences complètent l'offre.

**Sourcegraph Cody** exploite l'architecture **RAG sur codebase** la plus sophistiquée, avec indexation via le format SCIP (20% plus compact que LSIF) et support de **100k+ repositories**. Note importante : les plans Free et Pro seront discontinués le 23 juillet 2025, avec focus sur **Cody Enterprise** ($59/user/mois) et le nouveau produit **Amp** pour agents autonomes.

---

## Les agents autonomes repoussent les limites de l'automatisation

### Devin a ouvert la voie mais les résultats restent mitigés

**Devin** (Cognition Labs), annoncé en mars 2024 comme premier "AI software engineer", combine des modèles propriétaires avec apprentissage par renforcement dans un environnement sandboxé (Docker avec terminal, éditeur, navigateur). L'interface principale via Slack et les capacités multi-agents permettent de traiter des tâches d'ingénierie complexes. **Devin 2.0** (2025) a introduit un IDE agent-native, le planning interactif et les multi-Devins parallèles, avec une baisse drastique du prix à **$20/mois** contre $500 initialement.

Les tests indépendants révèlent cependant un **taux de succès réel de 15-20%** seulement. La difficulté à prédire quelles tâches réussiront, la tendance à créer des abstractions inutiles, et les cas où l'agent passe des jours sur des solutions impossibles tempèrent l'enthousiasme initial. Les démos Upwork ont été critiquées pour leur manque de représentativité.

### SWE-agent et OpenHands démocratisent la recherche

**SWE-agent** (Princeton University) introduit le concept d'**Agent-Computer Interface (ACI)** — une interface spécialement conçue pour les LLM. L'agent suit un pattern ReAct (Thought → Command → Feedback → Loop) avec détection et correction automatique des erreurs de syntaxe (51,7% des édits contiennent des erreurs corrigées par le linter intégré). Avec **Claude 3.7**, il atteint le state-of-the-art sur SWE-bench Full et Verified. Le **Mini-SWE-Agent** démontre qu'un agent de 100 lignes Python peut atteindre 65% sur SWE-bench Verified.

**OpenHands** (ex-OpenDevin), avec **65k+ étoiles GitHub**, offre une plateforme complète pour agents généralistes. L'environnement Docker isolé permet modification de code, exécution shell, navigation web et interaction avec APIs. Le SDK Python composable et les interfaces multiples (CLI, GUI React, API REST, extension VS Code) facilitent l'expérimentation. Le taux de succès atteint **60%** sur workflows ML structurés mais chute sur tâches ambiguës.

### L'écosystème émergent se structure autour de niches spécifiques

**Factory AI** se spécialise dans les "Droids" — agents dédiés par type de tâche (refactoring, migrations, code review). L'approche **context engineering avancé** et le support multi-interface (IDE, Web, CLI, Slack, Linear) ont convaincu MongoDB, Ernst & Young et Zapier. Performance notable : **58,75% sur Terminal-Bench** (SOTA).

**Augment Code**, financé à hauteur de **$252M** (valorisation $977M), mise sur un context engine propriétaire avec indexation profonde et reinforcement learning depuis les comportements développeurs. Les agents autonomes fonctionnent en local ou cloud, avec support de **100+ outils externes**.

**Poolside** ($626M levés, valorisation $3B) développe le **RLCEF** (Reinforcement Learning from Code Execution Feedback), ciblant le Global 2000 et le secteur public. **Magic.dev** ($465M) travaille sur des fenêtres de contexte de **100 millions de tokens** via son Long-Term Memory Network, avec partenariat Google Cloud pour supercomputers dédiés.

---

## Architecture interne : comprendre les mécanismes fondamentaux

### Le pattern ReAct structure le raisonnement agentique

Le pattern **ReAct** (Reasoning + Acting, Yao et al. 2022) entrelace traces verbales et appels d'outils. Contrairement au Chain-of-Thought qui ne fait que raisonner, ReAct permet l'interaction avec l'environnement externe. La structure typique alterne Thought (analyse), Action (appel d'outil), et Observation (résultat) jusqu'à la réponse finale.

```
Thought 1: Je dois localiser la fonction défaillante
Action 1: Search["error handling getUserById"]
Observation 1: src/users.ts:45 - getUserById function
Thought 2: Je vois le problème - pas de vérification null
Action 2: Edit["src/users.ts", old="return user", new="return user ?? null"]
```

Les **variantes** incluent Plan-and-Execute (planification complète avant exécution) pour tâches multi-étapes, et Tree of Thoughts (exploration de branches de raisonnement) pour problèmes créatifs. Le principal avantage de ReAct réside dans l'interprétabilité des traces et la réduction des hallucinations via ancrage dans les données externes.

### La boucle agent implémente le cycle OODA adapté

L'architecture agent suit un cycle **Observe → Orient → Decide → Act** :

1. **Observe** : Collecte de l'état courant (messages, fichiers, erreurs)
2. **Orient** : Analyse par le LLM du contexte et des options
3. **Decide** : Sélection de l'action (appel d'outil ou réponse finale)
4. **Act** : Exécution et capture du feedback

La **gestion des erreurs** emploie l'exponential backoff pour erreurs transitoires et renvoie les erreurs de validation au LLM pour auto-correction. Un paramètre `max_steps` (typiquement 10-25) prévient les boucles infinies.

### Le tool use constitue l'interface avec le monde réel

Les outils se répartissent en catégories fonctionnelles :

| Catégorie | Outils typiques | Usage |
|-----------|-----------------|-------|
| **File I/O** | read_file, write_file, list_dir | Manipulation du code |
| **Shell** | bash, run_command | Exécution, tests |
| **Search** | grep, ripgrep, semantic_search | Navigation codebase |
| **LSP** | get_definitions, find_references | Intelligence code |
| **Git** | git_diff, git_commit | Version control |

Les formats divergent entre providers : **OpenAI** utilise `functions` avec JSON Schema, **Anthropic** emploie `tools` avec `input_schema`. La réponse indique `stop_reason: "tool_use"` avec l'ID, le nom et les arguments. Les outils built-in Anthropic (bash, text_editor, web_search, code_execution) s'exécutent côté serveur.

La sélection d'outil par l'agent combine analyse sémantique du prompt, matching avec les descriptions d'outils, et raisonnement sur la séquence nécessaire. Le **Tool Search** émergent permet une recherche sémantique sur des milliers d'outils.

### La gestion du contexte reste le défi technique majeur

Les fenêtres de contexte ont explosé — de 8k tokens en 2023 à **10 millions pour Llama 4 Scout** — mais les problèmes persistent. Le phénomène **Lost-in-the-Middle** dégrade les performances pour les informations situées au milieu du contexte. Les tests montrent une **chute de précision à 15,6%** au-delà de 128-256k tokens pour certains modèles.

Le **chunking sémantique** via AST (Abstract Syntax Tree) surpasse le découpage naïf en préservant les unités logiques (fonctions, classes). L'indexation multi-niveau (file summaries → class summaries → function details) optimise le retrieval. Le **Meta-RAG** (2025) introduit les listes Read/Write/New pour identifier précisément quelles unités de code lire, modifier ou créer.

L'architecture RAG typique pour coding agents comprend :
1. **Indexation** : Chunking AST → Embedding → Stockage VectorDB
2. **Retrieval** : Query embedding → Recherche sémantique → Re-ranking
3. **Augmentation** : Construction du prompt avec contexte pertinent
4. **Generation** : Réponse factuelle ancrée dans le code réel

### Les systèmes de mémoire évoluent vers la persistance

La mémoire **court terme** (session) maintient les messages de conversation et l'état de travail via checkpointers (LangGraph avec Redis/MongoDB). La mémoire **long terme** (persistante) stocke les faits appris, les interactions passées, les patterns et les préférences utilisateur.

Les implémentations concrètes incluent **LlamaIndex Memory Blocks** (blocs statiques et extraction dynamique), **LangGraph Stores** (cross-thread avec MongoDB), et **Mem0** (Memory-as-a-Service). La consolidation short-term → long-term s'effectue selon l'importance estimée de l'information.

### Le sandboxing garantit l'exécution sécurisée

Les niveaux d'isolation progressent de **Docker containers** (standard, namespace/cgroups) à **gVisor** (kernel user-space) et **Firecracker** (microVM pour multi-tenant). Les containers Docker constituent le choix dominant avec :
- Network disabled par défaut
- Volumes limités au workspace nécessaire
- Resource limits (CPU, mémoire, timeout)
- Command allowlist

Le **Docker Sandbox CLI** permet de démarrer un environnement isolé (`docker sandbox run claude-code`) avec workspace monté et permissions contrôlées. Les serveurs MCP sandboxés utilisent Testcontainers pour isolation complète.

### L'orchestration multi-agents augmente les capacités

Trois patterns d'orchestration dominent :

**Hub-and-Spoke** : Un orchestrateur central (Planner) dispatche aux agents spécialisés (Navigator, Editor, Executor). L'architecture **HyperAgent** utilise des modèles différents par rôle — GPT-4o pour planning, Mixtral pour navigation (cost-efficient), GPT-3.5 pour exécution rapide — atteignant **31,4% sur SWE-bench Verified**.

**Sequential (Pipeline)** : Les agents s'enchaînent — Planner → Coder → Reviewer → Tester — via LangGraph SequentialAgent.

**Parallel (Fork-Join)** : Plusieurs agents travaillent simultanément (Search, Analyzer, TestGen) avec fusion des résultats par un Coordinator.

La communication inter-agents s'effectue via **handoffs** (OpenAI Agents SDK) ou **shared state** (LangGraph TypedDict). Les frameworks principaux incluent LangGraph (graph-based), AutoGen (conversation), CrewAI (role-based), et MetaGPT (simulation entreprise).

---

## Capacités et limitations : un état des lieux réaliste

### Les benchmarks mesurent des progrès spectaculaires

**SWE-bench** (Princeton, ICLR 2024) évalue les agents sur des issues GitHub réelles : repo + description → patch validé par tests unitaires. Les 2294 tâches Python ont été raffinées en **SWE-bench Verified** (500 tâches validées par humains) et **SWE-bench Lite** (300 tâches simplifiées). Le nouveau **SWE-bench Pro** (Scale AI, 1865 tâches) résiste à la contamination via licences copyleft et codebases propriétaires.

L'évolution des scores illustre l'accélération :
- Initial (2023) : **1,96%**
- SWE-agent + GPT-4 (mars 2024) : **12,47%**
- Janvier 2025 : **45%** (Verified)
- Fin 2025 : **72-77%** (Verified) avec Claude 4.5 Sonnet en tête

**HumanEval** (164 problèmes Python) atteint saturation (>95% pour modèles récents). **HumanEval Pro** et **MBPP Pro** (ACL 2025) évaluent le "self-invoking code generation" — o1-mini chute de 96,2% à 76,2% sur cette variante. **LiveCodeBench** (contamination-free, mis à jour continuellement) révèle que les modèles atteignent **0% sur problèmes "hard"** sans outils externes malgré des scores impressionnants ailleurs.

### Les agents excellent sur certaines tâches

La **génération de code** (fonctions, classes, scaffolding) atteint une maturité significative : **41% du code en 2024 généré par IA** (256 milliards de lignes). GitHub Copilot produit 40% du code Microsoft avec 55% d'accélération des tâches.

Le **refactoring** représente une force particulière de Claude 4 : conversion callbacks → async/await, réduction de complexité cyclomatique, migration vers frameworks modernes. Le **debugging** bénéficie de la compréhension en langage naturel ("Fix this logic error") et de la gestion des scénarios multi-thread.

La **génération de tests** automatise tests unitaires, d'intégration et edge cases avec assertions appropriées. La **documentation** (docstrings, README, API docs) économise 50% du temps selon les études Copilot. La **traduction entre langages** supporte 12+ langages de programmation et 23 langues naturelles (HumanEval-XL).

### Les limitations persistent sur les tâches complexes

Les **hallucinations de packages** constituent un risque sécuritaire majeur : une étude 2025 montre que **20% des 756 000 échantillons** recommandent des packages inexistants, avec 43% des noms hallucinés répétés sur 10 requêtes. Le "Slopsquatting" — création de packages malveillants avec noms hallucinés — représente un vecteur d'attaque actif.

Le **contexte limité** impacte les grandes codebases malgré les fenêtres massives. La performance dépend plus de l'entraînement que de la taille du contexte. Le **raisonnement architectural** reste faible sur abstractions multi-couches et patterns avancés — "les modèles excellent en programmation compétitive mais échouent sur l'ingénierie réelle".

La **sécurité du code généré** pose problème : 40% contient des vulnérabilités (SQL injection, XSS, secrets hardcodés, chiffrement obsolète). Les risques spécifiques aux agents incluent memory poisoning, tool misuse, privilege escalation et prompt injection.

L'**édition multi-fichiers** reste le talon d'Achille : les agents atteignent 97-100% sur fichiers uniques mais chutent à **18-30%** sur éditions coordonnées. Les éléments visuels aggravent le problème avec **73,2% de chute** sur SWE-bench Multimodal.

---

## Perspectives 2026 : évolutions techniques et organisationnelles

### MCP devient le standard universel d'intégration

Le **Model Context Protocol**, lancé par Anthropic en novembre 2024, a été transféré en décembre 2025 à l'**Agentic AI Foundation** sous la Linux Foundation, co-fondée avec Block et OpenAI, soutenue par Google, Microsoft, AWS, Cloudflare et Bloomberg. Ce "port USB-C pour l'IA" standardise la connexion agents ↔ outils via architecture client-serveur et JSON-RPC.

Les trois primitives fondamentales — **Tools** (actions), **Resources** (données), **Prompts** (templates) — permettent l'extension illimitée des capacités. L'adoption massive (Cursor, Replit, Zed, Sourcegraph) et l'intégration OpenAI (mars 2025) confirment le statut de standard de facto. Les préoccupations sécuritaires (prompt injection, permissions excessives, lookalike tools) font l'objet de travaux actifs.

### L'autonomie des agents s'accroît progressivement

AWS re:Invent 2025 a annoncé les **"Frontier Agents"** incluant Kiro pour le coding autonome — agents capables de coder pendant des jours avec mémoire persistante. **Cursor 2.0** permet d'exécuter jusqu'à 8 agents en parallèle. Gartner prévoit que **82% des organisations** intégreront des agents IA pour coding, analyse de données et communication d'ici 2026.

Les caractéristiques émergentes incluent l'autonomie décisionnelle (choix des repos à modifier), la scalabilité (spawning de multiples agents), et l'apprentissage continu. Le garde-fou clé : jamais de commit direct en production, validation humaine obligatoire.

### Les fenêtres de contexte massives transforment les workflows

L'état actuel affiche **Llama 4 Scout à 10M tokens**, Magic.dev à 100M (expérimental), Claude Sonnet 4 et Gemini 2.5 Pro à 1M. L'analyse de codebases entiers (50 000+ lignes) en une passe devient possible, ouvrant le "**vibe coding**" — développement piloté par intent en langage naturel.

Les limitations persistent : le problème Lost-in-the-Middle, la chute de précision au-delà de 128-256k tokens pour certains modèles, et le "Context Rot" (fiabilité décroissante avec la longueur). La **Repository Intelligence** annoncée par GitHub comprendra non seulement le code mais les relations et l'historique entre composants.

### La sécurité et la gouvernance deviennent critiques

Les statistiques 2025 sont préoccupantes : **80%** des organisations ont rencontré des comportements risqués d'agents IA, **97%** des brèches manquaient de contrôles d'accès appropriés, **1/5** des brèches dues au Shadow AI. Les chercheurs ont découvert **30+ failles** dans les outils de coding IA (Cursor, GitHub Copilot, Claude Code), incluant la chaîne d'exploits **IDEsaster** permettant vol de données et RCE.

Le framework McKinsey recommande la mise à jour des frameworks de risques (IAM/TPRM adaptés), les mécanismes de supervision (logging immutable), et les contrôles Zero Trust/Least Privilege. L'**EU AI Act** (effectif 2026) imposera obligations de supervision humaine et documentation pour l'IA "high-risk". La conformité SOC2/HIPAA/PCI-DSS devra couvrir les agents dans les environnements SaaS.

### Le métier de développeur évolue vers l'orchestration

Le shift fondamental s'opère de "écrire du code" vers "diriger l'IA pour écrire du code". Les compétences critiques 2026 incluent l'**orchestration IA** (sélection/combinaison de modèles), l'**architecture** (décisions que l'IA ne peut prendre), la **validation** (review de code IA, détection d'hallucinations), et la **gouvernance** (IP, compliance, sécurité).

Une étude METR 2025 nuance l'optimisme : les développeurs expérimentés estimaient être accélérés de 20% avec l'IA mais **étaient en fait légèrement ralentis** sur leurs propres projets familiers. L'IA bénéficie davantage aux juniors ou en environnements non familiers.

Le paradigme émergeant du **Spec-driven Development** voit l'ingénieur définir le "quoi" en specs précises, l'IA générer le "comment", et l'humain reviewer et orchestrer. La projection marché anticipe une croissance de **20%/an** pour atteindre $61 milliards en 2029.

---

## Conclusion : arbitrages et recommandations

Les coding agents ont atteint en 2025 un niveau de maturité qui les rend incontournables pour tout développeur. Cependant, leur intégration efficace nécessite une compréhension fine des arbitrages techniques et organisationnels.

Pour le **choix d'outil**, les développeurs individuels privilégieront Cursor ou Claude Code CLI pour la flexibilité, les équipes intégrées à GitHub opteront pour Copilot Business, et les organisations avec contraintes de compliance considéreront Tabnine (air-gapped) ou Amazon Q (intégration AWS). Les projets open source bénéficieront de Cline ou Aider avec modèles locaux.

L'**architecture interne** — pattern ReAct, boucle agent, tool use, RAG sur codebase — constitue un savoir fondamental pour exploiter ces outils efficacement et comprendre leurs échecs. La connaissance des mécanismes de contexte et de mémoire permet d'optimiser les prompts et d'anticiper les limitations.

Les **benchmarks** (SWE-bench, LiveCodeBench) fournissent des indicateurs utiles mais imparfaits. La performance réelle varie significativement selon le type de tâche, la familiarité du codebase, et la qualité des specs. L'édition multi-fichiers et le raisonnement architectural restent des défis majeurs.

Pour 2026, trois évolutions structurantes se dessinent : **MCP** comme standard d'intégration universel, l'**autonomie croissante** des agents avec garde-fous humains, et l'**impératif de gouvernance** face aux risques de sécurité avérés. Le développeur de demain sera moins un codeur qu'un architecte-orchestrateur, définissant les intentions et supervisant l'exécution par des systèmes de plus en plus capables.
