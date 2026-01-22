# Changements appliqués - Version simplifiée sans bots

**Date**: 2026-01-22  
**Demande**: Clarifier que l'humain est toujours le décodeur, l'ordinateur toujours le codeur (génération + feedbacks)

## ✅ Modifications effectuées

### 1. proposal.md
- ✅ Objectifs : Retrait mention des bots
- ✅ Scope In : Clarification des rôles (humain=décodeur, ordi=codeur/feedbacks)
- ✅ Scope Out : Ajout des bots IA en "out of scope" (v2+)
- ✅ Rules : Précision "Toujours l'ordinateur" / "Toujours l'humain"
- ✅ Architecture : Retrait dossier `bots/`
- ✅ Dependencies : Ajout "No Dependencies On: Bot interface"
- ✅ Risks : Remplacement du risque bot par risque UX
- ✅ Success Criteria : Retrait des critères liés aux bots
- ✅ Future Enhancements : Bots en tête de liste (v2+)

### 2. tasks.md
- ✅ Retrait Task 1.1 création dossier bots
- ✅ Suppression Phase 3 complète (Bots - 3 tâches)
- ✅ Renommage Phase 4 → Phase 3 (Integration)
- ✅ Renommage Phase 5 → Phase 4 (Documentation)
- ✅ Mise à jour des numéros de tâches (4.x → 3.x, 5.x → 4.x)
- ✅ Dependencies : Simplification (pas de parallélisation)
- ✅ Parallel Work : "None - All sequential"
- ✅ Effort : 7-11h (au lieu de 10-15h)
- ✅ Notes : Ajout clarification "No bots in v1"
- ✅ Total : 12 tâches (au lieu de 15)

### 3. design.md
- ✅ Décision 1 : Clarification rôles fixes + mention v2 pour bots
- ✅ Décision 5 : Transformation "Bot Strategy" → "No Bots in v1" avec futures stratégies
- ✅ Décision 6 : Layout UI avec indication des rôles (🤖 vs 👤)
- ✅ Décision 6 : Interaction - feedbacks automatiques par ordinateur
- ✅ Décision 8 : Testing - retrait tests bots
- ✅ Performance : Clarification que Smart Bot est futur
- ✅ Optimizations : Web Worker pour futurs bots
- ✅ Extensions : Réorganisation avec Bots en premier (v2)

### 4. specs/mastermind/spec.md
- ✅ Overview : Clarification rôles + note "Bots out of scope v1"
- ✅ Related specs : Retrait référence à Bot spec
- ✅ Requirement "Single Player Only" : Ajout scenario "Fixed roles"
- ✅ **Suppression complète** : Requirement "Bot Integration" + 4 scenarios
- ✅ Integration section : Note "No bots in v1"
- ✅ Retrait section "Bot Interface"
- ✅ Future Extensions : Bots en tête
- ✅ References : Bot spec en note "(For future)"
- ✅ **Résultat : 12 requirements, 28 scenarios** (au lieu de 13/31)

### 5. SUMMARY.md
- ✅ Principe : Ajout encadré "Rôles fixes en v1"
- ✅ Section 1 (proposal) : Mise à jour portée
- ✅ Section 2 (tasks) : 12 tâches, 4 phases, séquentiel, 7-11h
- ✅ Section 3 (design) : 8 décisions avec n°5 = No Bots
- ✅ Section 4 (spec) : 12 requirements, 28 scenarios
- ✅ Section 6 (validation) : Métriques mises à jour
- ✅ Points Clés : Retrait Bot Smart, ajout "Rôles Fixes"
- ✅ Prochaines étapes : Retrait mention Phase 3 (Bots)
- ✅ Valeur pédagogique : Bots en extensions futures (v2+)
- ✅ Résumé : Mise à jour des chiffres + note v2

### 6. README.md
- ✅ Summary : Note "Version 1 focuses on human decoder"
- ✅ Key Features : Clarification rôles fixes, "No bots in v1"
- ✅ Files to Create : Retrait dossier `bots/`
- ✅ Dependencies : Ajout "No Dependencies: Bot interface"
- ✅ Educational Value : Bots en "v2+" avec extensions futures

### 7. VALIDATION.md
- ✅ Metrics : 12 requirements, 28 scenarios, note "Bots 0 (v2+)"
- ✅ Requirements Coverage : 8 core + 4 system (retrait Bot Integration)
- ✅ Scenario Quality : Retrait section "Bot Integration"
- ✅ Scenario Quality : Ajout section "Roles Clarity"
- ✅ Dependencies : Retrait "Implements Bot interface"
- ✅ Architecture : Retrait section "Bot Compliance"
- ✅ Code Quality : Retrait "Bot benchmarks"
- ✅ Issues : Mise à jour observations (4 au lieu de 3)
- ✅ Final Verdict : 7 files, 12 req, 28 scenarios, 12 tasks, 7-11h

## 📊 Résumé des changements

| Élément | Avant | Après | Changement |
|---------|-------|-------|------------|
| Requirements | 13 | 12 | -1 (Bot Integration retiré) |
| Scenarios | 31 | 28 | -3 (4 scenarios bots - 1 ajouté "Fixed roles") |
| Tâches | 15 | 12 | -3 (Phase Bots complète) |
| Phases | 5 | 4 | -1 (Phase Bots) |
| Effort estimé | 10-15h | 7-11h | -30% environ |
| Fichiers à créer | 8 | 5 | -3 (bots/) |
| Parallélisation | Oui (Phase 2-3) | Non (séquentiel) | Simplification |

## 🎯 Clarifications apportées

### Rôles fixes (version 1)
- 🤖 **Ordinateur (codeur)** :
  - Génère le code secret au début de chaque partie
  - Calcule automatiquement les feedbacks (pions noirs/blancs)
  - Jamais contrôlé par le joueur

- 👤 **Humain (décodeur)** :
  - Fait les tentatives de 4 couleurs
  - Reçoit les feedbacks automatiques
  - Jamais le codeur

### Ce qui n'est PAS inclus en v1
- ❌ Bots IA (Random, Smart, Expert)
- ❌ Mode inversé (humain code, ordi/bot devine)
- ❌ Mode multijoueur (humain vs humain)
- ❌ Observateur de stratégies IA

### Réservé pour v2+
- ✅ Bots décodeurs (Random, Smart, Expert)
- ✅ Mode "watch bot play"
- ✅ Benchmarks de performance
- ✅ Comparaison humain vs bots

## ✅ Validation finale

- [x] Tous les documents mis à jour de manière cohérente
- [x] Chiffres corrects partout (12 req, 28 scenarios)
- [x] Rôles clairement définis dans chaque fichier
- [x] Bots systématiquement marqués "out of scope v1"
- [x] Architecture simplifiée (pas de dossier bots/)
- [x] Estimation d'effort réduite (7-11h)
- [x] Aucune ambiguïté sur qui fait quoi

## 🚀 Prêt pour implémentation

La version simplifiée est **prête pour review et implémentation** :
- Scope clair et limité
- Delivery plus rapide (~7-11h)
- Focus sur l'expérience humain décodeur
- Base solide pour extensions v2

---

**Tous les fichiers ont été mis à jour de manière cohérente.** ✅
