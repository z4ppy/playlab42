# Proposal: add-diese-et-mat

## Résumé

Ajout d'un mini-jeu pédagogique complet d'apprentissage musical : lecture de notes, rythme, intervalles et accords, avec audio synthétisé et progression sauvegardée.

## Pourquoi ?

### Contexte

La lecture musicale est une compétence fondamentale mais son apprentissage est souvent fastidieux. Les outils existants sont soit trop simples (flashcards basiques), soit trop complexes (applications professionnelles). Playlab42 peut offrir un juste milieu : un outil pédagogique progressif, ludique et bien conçu.

### Problème

- Les apps d'apprentissage musical sont lourdes ou nécessitent un compte
- Peu d'outils francophones avec nomenclature Do/Ré/Mi
- Manque de feedback audio immédiat dans les outils web simples
- Pas de suivi de progression granulaire

### Bénéfices attendus

1. **Pédagogique** : Apprentissage progressif multi-compétences (notes, rythme, intervalles, accords)
2. **Ludique** : Audio synthétisé en temps réel, feedback immédiat
3. **Technique** : Démonstration de Web Audio API, VexFlow, architecture modulaire
4. **Support de cours** : Code exemplaire et bien documenté

## Quoi ?

### Description

"Diese & Mat" (jeu de mots sur "échec et mat" et les dièses musicaux) est une application d'apprentissage musical complète :

- **Lecture de notes** : Identifier les notes sur une portée (clé de sol et fa)
- **Rythme** : Taper un rythme affiché ou entendu
- **Intervalles** : Identifier la distance entre deux notes
- **Accords** : Reconnaître les accords (majeur, mineur, etc.)
- **Ear training** : Identifier des notes/intervalles à l'oreille

### Périmètre complet

| Feature | Description |
|---------|-------------|
| **Notation** | Rendu SVG de partitions via VexFlow (CDN) |
| **Audio** | Synthèse temps réel via Tone.js (CDN) |
| **Clés** | Sol et Fa, avec lignes supplémentaires |
| **Altérations** | Dièses, bémols, bécarres |
| **Rythme** | Rondes → doubles croches, silences |
| **Intervalles** | Unisson → octave, mélodiques et harmoniques |
| **Accords** | Majeurs, mineurs, diminués, augmentés |
| **Modes** | Visuel→nom, visuel→jeu, audio→nom, audio→jeu |
| **Progression** | Niveaux, XP, skills tracés, sauvegarde |
| **Thèmes** | Support clair/sombre via theme.css |

### Architecture

```
games/diese-et-mat/
├── index.html              # Point d'entrée
├── game.json               # Manifest
├── thumb.svg               # Vignette
├── README.md               # Documentation
│
├── src/
│   ├── main.js             # Point d'entrée JS
│   ├── App.js              # Orchestrateur principal
│   │
│   ├── core/               # Modèle musical (logique pure)
│   │   ├── Pitch.js        # Notes (Do4, Ré#5...)
│   │   ├── Duration.js     # Durées (noire, croche...)
│   │   ├── Interval.js     # Intervalles
│   │   ├── Chord.js        # Accords
│   │   ├── Scale.js        # Gammes
│   │   └── index.js        # Exports
│   │
│   ├── engine/             # Moteur d'exercices
│   │   ├── ExerciseEngine.js    # Orchestrateur de session
│   │   ├── QuestionGenerator.js # Génération de questions
│   │   ├── ScoreCalculator.js   # Calcul des points
│   │   └── ProgressTracker.js   # Suivi de progression
│   │
│   ├── audio/              # Moteur audio
│   │   ├── AudioEngine.js  # Wrapper Tone.js
│   │   ├── Metronome.js    # Métronome
│   │   └── Sampler.js      # Lecture d'échantillons (optionnel)
│   │
│   └── renderer/           # Rendu musical
│       ├── ScoreRenderer.js     # Wrapper VexFlow
│       ├── StaffRenderer.js     # Rendu portée simple
│       └── NoteRenderer.js      # Rendu note seule
│
├── ui/                     # Composants UI
│   ├── ExerciseView.js     # Vue exercice principal
│   ├── MenuView.js         # Menu de sélection
│   ├── ProgressView.js     # Vue progression/stats
│   ├── SettingsPanel.js    # Paramètres
│   ├── FeedbackDisplay.js  # Feedback correct/incorrect
│   ├── NoteButtons.js      # Boutons Do-Si
│   └── PianoKeyboard.js    # Clavier virtuel (optionnel)
│
├── data/                   # Données statiques
│   ├── exercises.json      # Définitions des exercices
│   └── levels.json         # Configuration des niveaux
│
└── __tests__/              # Tests unitaires
    ├── Pitch.test.js
    ├── Interval.test.js
    ├── ExerciseEngine.test.js
    └── ScoreCalculator.test.js
```

### Dépendances CDN

```html
<script type="importmap">
  {
    "imports": {
      "tone": "https://unpkg.com/tone@14.7.77/build/Tone.js",
      "vexflow": "https://unpkg.com/vexflow@4.2.3/build/cjs/vexflow.js"
    }
  }
</script>
```

### Modèle musical (core/)

```javascript
// Exemple: Pitch.js
export class Pitch {
  static NOTES_FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  static NOTES_EN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  constructor(pitchClass, octave = 4, accidental = 'natural') {
    this.pitchClass = pitchClass; // 0-6 (Do=0, Si=6)
    this.octave = octave;         // 0-8
    this.accidental = accidental; // 'natural', 'sharp', 'flat'
  }

  /** Convertit en numéro MIDI (60 = Do4) */
  toMidi() {
    const base = [0, 2, 4, 5, 7, 9, 11][this.pitchClass];
    const accidentalOffset = { flat: -1, natural: 0, sharp: 1 }[this.accidental];
    return (this.octave + 1) * 12 + base + accidentalOffset;
  }

  /** Convertit en fréquence Hz */
  toFrequency(a4 = 440) {
    return a4 * Math.pow(2, (this.toMidi() - 69) / 12);
  }

  /** Nom en français */
  toFrench() {
    const base = Pitch.NOTES_FR[this.pitchClass];
    const acc = { flat: '♭', natural: '', sharp: '♯' }[this.accidental];
    return `${base}${acc}${this.octave}`;
  }

  /** Nom en anglais (pour VexFlow) */
  toVexFlow() {
    const base = Pitch.NOTES_EN[this.pitchClass].toLowerCase();
    const acc = { flat: 'b', natural: '', sharp: '#' }[this.accidental];
    return `${base}${acc}/${this.octave}`;
  }

  /** Position sur la portée (0 = Sol2 en clé de sol) */
  getStaffPosition(clef = 'treble') {
    const lineOffset = clef === 'treble' ? 28 : 16; // Sol2 vs Fa3
    return (this.octave * 7 + this.pitchClass) - lineOffset;
  }
}
```

### Système d'exercices

```javascript
// Exemple: ExerciseEngine.js
export class ExerciseEngine {
  constructor(exercise, config = {}) {
    this.exercise = exercise;
    this.config = { ...defaultConfig, ...config };
    this.session = null;
  }

  startSession() {
    this.session = {
      exerciseId: this.exercise.id,
      startedAt: Date.now(),
      questions: this.generateQuestions(),
      currentIndex: 0,
      results: [],
      score: { correct: 0, total: 0, points: 0, streak: 0 }
    };
    return this.getCurrentQuestion();
  }

  submitAnswer(answer) {
    const question = this.getCurrentQuestion();
    const result = this.evaluate(question, answer);

    this.session.results.push(result);
    this.updateScore(result);

    return {
      ...result,
      nextQuestion: this.nextQuestion()
    };
  }

  // ... autres méthodes
}
```

### Types d'exercices

| Type | Mode | Description |
|------|------|-------------|
| `note-reading` | `visual-to-name` | Voir note → dire le nom |
| `note-reading` | `visual-to-play` | Voir note → jouer au clavier |
| `note-reading` | `audio-to-name` | Entendre → dire le nom |
| `rhythm` | `tap` | Voir rythme → taper |
| `rhythm` | `listen-tap` | Entendre → taper |
| `interval` | `visual-identify` | Voir intervalle → nommer |
| `interval` | `audio-identify` | Entendre → nommer |
| `chord` | `identify` | Entendre accord → type |
| `chord` | `build` | Construire un accord |

### Système de progression

```javascript
// Structure de progression (sauvée via GameKit.saveProgress)
const progressData = {
  level: 3,
  xp: 1250,
  skills: {
    'treble-clef': { level: 4, accuracy: 0.92 },
    'bass-clef': { level: 2, accuracy: 0.78 },
    'accidentals': { level: 1, accuracy: 0.65 },
    'intervals': { level: 2, accuracy: 0.81 },
    // ...
  },
  history: [
    { date: '2024-01-15', exerciseId: 'note-treble-1', score: 18, max: 20 },
    // ...
  ],
  achievements: ['first-perfect', 'streak-10', ...]
};
```

## Impact

### Specs affectées

| Spec | Impact |
|------|--------|
| [manifests](../../specs/manifests/spec.md) | Aucun - format game.json existant |
| [gamekit](../../specs/gamekit/spec.md) | Utilisation standard |
| [catalogue](../../specs/catalogue/spec.md) | Aucun - ajout automatique |

### Nouvelle spec

Création de `openspec/specs/diese-et-mat/spec.md` documentant :
- Le modèle musical (Pitch, Duration, Interval, Chord)
- Le système d'exercices
- Le format des données de progression
- L'intégration audio/rendu

### Fichiers créés

```
games/diese-et-mat/          # Nouveau jeu complet
├── index.html
├── game.json
├── thumb.svg
├── README.md
├── src/
│   ├── main.js
│   ├── App.js
│   ├── core/                # 6 fichiers
│   ├── engine/              # 4 fichiers
│   ├── audio/               # 3 fichiers
│   └── renderer/            # 3 fichiers
├── ui/                      # 7 fichiers
├── data/                    # 2 fichiers JSON
└── __tests__/               # 4+ fichiers

openspec/specs/diese-et-mat/ # Nouvelle spec
└── spec.md
```

### Limitations de l'API Playlab identifiées

Le projet Diese & Mat révèle quelques manques potentiels dans l'écosystème Playlab :

| Manque | Description | Contournement actuel |
|--------|-------------|---------------------|
| **Progression par skill** | GameKit gère scores globaux, pas par compétence | Sérialiser dans `saveProgress()` |
| **Achievements système** | Pas de système de badges natif | Gérer localement, afficher dans l'UI |
| **Leaderboards multi-critères** | `saveScore()` = 1 nombre | Sérialiser métadonnées dans progress |
| **Audio manager partagé** | Chaque jeu gère son audio | OK pour ce cas, mais pourrait être mutualisé |

> **Note** : Ces manques ne bloquent pas l'implémentation. On peut proposer des évolutions de GameKit dans une future proposal si le besoin se confirme.

### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| VexFlow lourd (~500KB) | Temps chargement | Lazy loading, fallback SVG simple |
| Tone.js lourd (~200KB) | Temps chargement | Import dynamique au premier son |
| Web Audio blocages navigateur | Pas de son | Bouton "Activer le son" explicite |
| Complexité du modèle musical | Maintenance | Tests unitaires exhaustifs |

## Critères d'acceptation

### Fonctionnels

- [ ] Le jeu s'ouvre en standalone (file://)
- [ ] Le jeu s'intègre au portail (iframe)
- [ ] Les notes s'affichent sur une portée (clé de sol)
- [ ] Les notes s'affichent sur une portée (clé de fa)
- [ ] Les altérations sont supportées (♯, ♭)
- [ ] Le son des notes est synthétisé (Tone.js)
- [ ] Le feedback est immédiat (visuel + audio)
- [ ] La progression est sauvegardée (GameKit)
- [ ] Le thème clair/sombre fonctionne

### Techniques

- [ ] L'architecture modulaire est respectée
- [ ] Les tests unitaires passent (`make test`)
- [ ] Le lint passe (`make lint`)
- [ ] Le jeu apparaît dans le catalogue (`make build-catalogue`)
- [ ] La documentation est complète (README, JSDoc)

### Pédagogiques

- [ ] Le code est bien commenté en français
- [ ] Les concepts musicaux sont correctement implémentés
- [ ] Le jeu peut servir de support de cours

## Références

- [Tone.js](https://tonejs.github.io/) - Audio synthesis
- [VexFlow](https://www.vexflow.com/) - Music notation rendering
- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/) - Alternative à VexFlow
- [Relativity Lab](../../../tools/relativity-lab/) - Exemple d'architecture modulaire dans Playlab42
