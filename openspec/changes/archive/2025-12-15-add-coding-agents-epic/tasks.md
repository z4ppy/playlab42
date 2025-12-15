# Tasks: add-coding-agents-epic

## Phase 1: Structure de base

- [x] Créer `parcours/epics/coding-agents-2025/`
- [x] Créer `epic.json` avec manifest complet
- [x] Créer `thumbnail.svg` (icône robot/agent)

## Phase 2: Slides

### Slide 01 - Introduction

- [x] Créer `slides/01-introduction/slide.json`
- [x] Créer `slides/01-introduction/index.html`
  - Contexte 2025 : évolution depuis IDE modernes
  - Stats clés : 77,2% SWE-bench, 85% adoption JetBrains
  - Structure du guide (6 sections)

### Slide 02 - Panorama

- [x] Créer `slides/02-panorama/slide.json`
- [x] Créer `slides/02-panorama/index.html`
  - IDE AI-native : Cursor, Windsurf, GitHub Copilot
  - CLI : Claude Code, Aider, OpenAI Codex CLI
  - Extensions open source : Cline, Continue.dev
  - Solutions enterprise : Amazon Q, Tabnine, Sourcegraph Cody

### Slide 03 - Agents autonomes

- [x] Créer `slides/03-agents-autonomes/slide.json`
- [x] Créer `slides/03-agents-autonomes/index.html`
  - Devin : pionnier mais résultats mitigés (15-20% succès)
  - SWE-agent : Agent-Computer Interface, pattern ReAct
  - OpenHands : plateforme généraliste (65k+ stars)
  - Écosystème émergent : Factory AI, Augment Code, Poolside, Magic.dev

### Slide 04 - Architecture interne

- [x] Créer `slides/04-architecture/slide.json`
- [x] Créer `slides/04-architecture/index.html`
  - Pattern ReAct : Thought → Action → Observation
  - Boucle agent : OODA (Observe, Orient, Decide, Act)
  - Tool use : catégories (File I/O, Shell, Search, LSP, Git)
  - Gestion du contexte : chunking AST, RAG, Lost-in-the-Middle
  - Systèmes de mémoire : court terme vs long terme
  - Sandboxing : Docker, gVisor, Firecracker
  - Orchestration multi-agents : Hub-and-Spoke, Sequential, Parallel

### Slide 05 - Capacités et limitations

- [x] Créer `slides/05-capacites-limitations/slide.json`
- [x] Créer `slides/05-capacites-limitations/index.html`
  - Benchmarks : SWE-bench (1,96% → 77%), HumanEval, LiveCodeBench
  - Forces : génération code, refactoring, debugging, tests, documentation
  - Limitations : hallucinations packages (20%), contexte, raisonnement architectural
  - Sécurité : 40% vulnérabilités, risques agents
  - Édition multi-fichiers : chute à 18-30%

### Slide 06 - Perspectives 2026

- [x] Créer `slides/06-perspectives-2026/slide.json`
- [x] Créer `slides/06-perspectives-2026/index.html`
  - MCP : standard universel (Linux Foundation)
  - Agents autonomes : 82% organisations d'ici 2026 (Gartner)
  - Fenêtres de contexte massives : 10M tokens (Llama 4 Scout)
  - Sécurité et gouvernance : 80% comportements risqués, EU AI Act
  - Évolution métier : orchestration IA, Spec-driven Development

## Phase 3: Taxonomie (optionnel)

- [x] Ajouter tags dans `parcours/index.json` si nécessaire
  - Tags `ia`, `dev`, `avance`, `agent` utilisés (déjà présents dans index.json)

## Phase 4: Validation

- [x] Exécuter `make build-parcours`
- [ ] Vérifier le rendu dans le portail
- [ ] Tester la navigation entre slides
- [ ] Vérifier le responsive mobile

## Phase 5: Finalisation

- [ ] Commit des changements
- [ ] Archiver la proposal
