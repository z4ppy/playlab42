# Diese & Mat - Spécification

## Purpose

Diese & Mat est une application pédagogique d'apprentissage de la lecture musicale. Elle couvre la lecture de notes, le rythme, les intervalles et les accords, avec synthèse audio temps réel et suivi de progression.

## Overview

Le jeu propose différents types d'exercices pour développer les compétences musicales :
- **Lecture de notes** : Identifier les notes sur une portée
- **Rythme** : Taper ou identifier des motifs rythmiques
- **Intervalles** : Reconnaître la distance entre deux notes
- **Accords** : Identifier le type d'accord (majeur, mineur, etc.)

L'application utilise VexFlow pour le rendu de partitions et Tone.js pour la synthèse audio.

**Voir aussi** :
- [GameKit Specification](../../../specs/gamekit/spec.md) - SDK pour persistence et communication
- [Manifests Specification](../../../specs/manifests/spec.md) - Format game.json

---

## Requirements

### Requirement: Musical Model

The system SHALL implement a complete musical model.

#### Scenario: Pitch representation
- **GIVEN** a musical pitch (e.g., C#4)
- **WHEN** the pitch is created
- **THEN** it stores pitch class, octave, and accidental
- **AND** it can convert to MIDI number
- **AND** it can convert to frequency (Hz)
- **AND** it can convert to French notation (Do♯4)
- **AND** it can convert to VexFlow notation (c#/4)

#### Scenario: Interval calculation
- **GIVEN** two pitches
- **WHEN** the interval between them is calculated
- **THEN** the correct interval quality and number are returned
- **AND** the interval can be described in French ("tierce majeure")

#### Scenario: Chord construction
- **GIVEN** a root pitch and chord type
- **WHEN** the chord is constructed
- **THEN** all chord tones are correctly calculated
- **AND** inversions are supported

### Requirement: Score Rendering

The system SHALL render musical notation.

#### Scenario: Staff display
- **GIVEN** a clef type (treble or bass)
- **WHEN** the staff is rendered
- **THEN** 5 lines are displayed
- **AND** the appropriate clef symbol is shown
- **AND** ledger lines appear when needed

#### Scenario: Note display
- **GIVEN** a pitch to display
- **WHEN** the note is rendered on the staff
- **THEN** it appears at the correct vertical position
- **AND** accidentals are shown when needed
- **AND** the note can be highlighted (correct/incorrect)

#### Scenario: VexFlow integration
- **GIVEN** VexFlow is loaded from CDN
- **WHEN** a score is rendered
- **THEN** proper musical notation is displayed
- **AND** multiple notes/measures can be shown

### Requirement: Audio Engine

The system SHALL synthesize musical sounds.

#### Scenario: Audio initialization
- **GIVEN** the user has not interacted with the page
- **WHEN** the audio engine is initialized
- **THEN** it waits for a user gesture before starting
- **AND** a "click to enable sound" prompt is shown

#### Scenario: Note playback
- **GIVEN** a pitch and duration
- **WHEN** playNote() is called
- **THEN** the correct frequency is synthesized
- **AND** the note plays for the correct duration

#### Scenario: Chord playback
- **GIVEN** multiple pitches
- **WHEN** playChord() is called
- **THEN** all notes sound simultaneously

#### Scenario: Sound preferences
- **GIVEN** GameKit reports sound should be muted
- **WHEN** the preference changes
- **THEN** the audio engine mutes/unmutes accordingly

### Requirement: Exercise System

The system SHALL manage learning exercises.

#### Scenario: Exercise loading
- **GIVEN** an exercise definition in JSON
- **WHEN** the exercise is loaded
- **THEN** the configuration is applied
- **AND** questions are generated according to constraints

#### Scenario: Question generation
- **GIVEN** exercise constraints (clef, range, accidentals)
- **WHEN** questions are generated
- **THEN** notes are within the specified range
- **AND** consecutive identical notes are avoided
- **AND** difficulty is appropriate

#### Scenario: Answer evaluation
- **GIVEN** a displayed note and user answer
- **WHEN** the answer is submitted
- **THEN** correct/incorrect is determined
- **AND** feedback is shown (visual + audio)
- **AND** score is updated

#### Scenario: Session completion
- **GIVEN** all questions have been answered
- **WHEN** the session ends
- **THEN** a summary is displayed
- **AND** progress is saved via GameKit

### Requirement: Progress Tracking

The system SHALL track user progress.

#### Scenario: Skill tracking
- **GIVEN** exercises target specific skills
- **WHEN** exercises are completed
- **THEN** accuracy per skill is updated
- **AND** skill levels are calculated

#### Scenario: Progress persistence
- **GIVEN** the user has made progress
- **WHEN** they return to the game
- **THEN** previous progress is restored
- **AND** unlocked content remains available

#### Scenario: Achievements
- **GIVEN** achievement criteria are met
- **WHEN** progress is evaluated
- **THEN** achievements are unlocked
- **AND** notifications are shown

### Requirement: User Interface

The system SHALL provide an intuitive interface.

#### Scenario: Exercise selection
- **GIVEN** available exercises
- **WHEN** the menu is displayed
- **THEN** exercises are grouped by category
- **AND** difficulty and progress are shown
- **AND** locked exercises are indicated

#### Scenario: Input methods
- **GIVEN** an exercise is active
- **WHEN** the user provides input
- **THEN** button clicks are accepted
- **AND** keyboard shortcuts work (1-7 for notes)
- **AND** virtual piano is available (optional)

#### Scenario: Theme support
- **GIVEN** the system theme preference
- **WHEN** the game loads
- **THEN** light/dark theme is applied
- **AND** all colors are appropriate

---

## Interface

### Musical Model (core/)

#### Pitch

```javascript
/**
 * Représente une hauteur musicale (note).
 */
class Pitch {
  /** Noms des notes en français */
  static NOTES_FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

  /** Noms des notes en anglais */
  static NOTES_EN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  /** Demi-tons depuis Do pour chaque classe */
  static SEMITONES = [0, 2, 4, 5, 7, 9, 11];

  /**
   * @param {number} pitchClass - Classe de hauteur (0-6, Do=0)
   * @param {number} octave - Octave (0-8)
   * @param {'natural'|'sharp'|'flat'} accidental - Altération
   */
  constructor(pitchClass, octave = 4, accidental = 'natural');

  /** Numéro MIDI (60 = Do4) */
  toMidi(): number;

  /** Fréquence en Hz (A4 = 440Hz par défaut) */
  toFrequency(a4 = 440): number;

  /** Notation française ("Do♯4") */
  toFrench(): string;

  /** Notation anglaise ("C#4") */
  toEnglish(): string;

  /** Notation VexFlow ("c#/4") */
  toVexFlow(): string;

  /** Position sur la portée */
  getStaffPosition(clef: 'treble' | 'bass'): number;

  /** Crée depuis un numéro MIDI */
  static fromMidi(midi: number, preferSharp?: boolean): Pitch;

  /** Parse une chaîne ("Do4", "C#5", "Réb3") */
  static fromString(name: string): Pitch;

  /** Vérifie l'équivalence enharmonique */
  isEnharmonicWith(other: Pitch): boolean;
}
```

#### Duration

```javascript
/**
 * Représente une durée rythmique.
 */
class Duration {
  /** Durées de base en ticks (noire = 480) */
  static TICKS = {
    whole: 1920,      // Ronde
    half: 960,        // Blanche
    quarter: 480,     // Noire
    eighth: 240,      // Croche
    sixteenth: 120,   // Double croche
    'thirty-second': 60
  };

  /**
   * @param {'whole'|'half'|'quarter'|'eighth'|'sixteenth'|'thirty-second'} base
   * @param {0|1|2} dots - Points (0, 1, ou 2)
   * @param {Object} tuplet - Triolet/duolet { actual, normal }
   */
  constructor(base, dots = 0, tuplet = null);

  /** Durée en ticks (noire = 480) */
  toTicks(): number;

  /** Durée en temps */
  toBeats(beatsPerMeasure = 4): number;

  /** Notation VexFlow ("q", "8", "w", etc.) */
  toVexFlow(): string;

  /** Nom français ("noire pointée") */
  toFrench(): string;

  // Factory methods
  static whole(): Duration;
  static half(): Duration;
  static quarter(): Duration;
  static eighth(): Duration;
  static sixteenth(): Duration;
}
```

#### Interval

```javascript
/**
 * Représente un intervalle entre deux notes.
 */
class Interval {
  /** Qualités d'intervalle */
  static QUALITY = {
    diminished: 'dim',
    minor: 'm',
    perfect: 'P',
    major: 'M',
    augmented: 'aug'
  };

  /**
   * @param {'dim'|'m'|'P'|'M'|'aug'} quality - Qualité
   * @param {number} number - Numéro (1 = unisson, 8 = octave)
   */
  constructor(quality, number);

  /** Calcule l'intervalle entre deux notes */
  static between(pitch1: Pitch, pitch2: Pitch): Interval;

  /** Nombre de demi-tons */
  toSemitones(): number;

  /** Nom français ("tierce majeure", "quinte juste") */
  toFrench(): string;

  /** Abréviation ("M3", "P5", "m7") */
  toShorthand(): string;

  /** Applique l'intervalle à une note (transposition) */
  apply(pitch: Pitch): Pitch;

  /** Renverse l'intervalle */
  invert(): Interval;
}
```

#### Chord

```javascript
/**
 * Représente un accord.
 */
class Chord {
  /** Types d'accords et leurs intervalles */
  static TYPES = {
    major: [0, 4, 7],           // Majeur
    minor: [0, 3, 7],           // Mineur
    diminished: [0, 3, 6],      // Diminué
    augmented: [0, 4, 8],       // Augmenté
    'major-7th': [0, 4, 7, 11], // Maj7
    'minor-7th': [0, 3, 7, 10], // m7
    'dominant-7th': [0, 4, 7, 10], // 7
    'diminished-7th': [0, 3, 6, 9], // dim7
    sus2: [0, 2, 7],
    sus4: [0, 5, 7]
  };

  /**
   * @param {Pitch} root - Note fondamentale
   * @param {string} type - Type d'accord
   * @param {number} inversion - Renversement (0, 1, 2...)
   */
  constructor(root, type = 'major', inversion = 0);

  /** Notes de l'accord */
  getPitches(): Pitch[];

  /** Nom français ("Do majeur", "La mineur 7") */
  toFrench(): string;

  /** Symbole d'accord ("Cmaj7", "Am", "Gdim") */
  toSymbol(): string;
}
```

### Audio Engine (audio/)

```javascript
/**
 * Moteur audio basé sur Tone.js.
 */
class AudioEngine {
  /** État de l'audio (bloqué par défaut) */
  isReady: boolean;

  /** Volume principal (0-1) */
  volume: number;

  /** Initialise Tone.js (nécessite user gesture) */
  async init(): Promise<void>;

  /** Joue une note */
  playNote(pitch: Pitch, duration: Duration, velocity?: number): void;

  /** Joue un accord */
  playChord(pitches: Pitch[], duration: Duration, velocity?: number): void;

  /** Joue une séquence de notes */
  playSequence(notes: Array<{pitch: Pitch, duration: Duration}>, tempo: number): void;

  /** Arrête tous les sons */
  stop(): void;

  /** Active/désactive le son */
  setMuted(muted: boolean): void;

  /** Nettoie les ressources */
  dispose(): void;
}
```

### Score Renderer (renderer/)

```javascript
/**
 * Rendu de partition via VexFlow.
 */
class ScoreRenderer {
  /**
   * @param {HTMLElement} container - Élément DOM conteneur
   */
  constructor(container: HTMLElement);

  /** Configure la clé */
  setClef(clef: 'treble' | 'bass'): void;

  /** Configure la signature de mesure */
  setTimeSignature(numerator: number, denominator: number): void;

  /** Configure l'armure */
  setKeySignature(key: string): void;

  /** Affiche une note seule */
  renderNote(pitch: Pitch): void;

  /** Affiche plusieurs notes */
  renderNotes(pitches: Pitch[]): void;

  /** Highlight une note (correct/incorrect) */
  highlightNote(index: number, state: 'correct' | 'incorrect' | 'hint'): void;

  /** Efface le highlight */
  clearHighlight(): void;

  /** Nettoie et redessine */
  clear(): void;

  /** Libère les ressources */
  dispose(): void;
}
```

### Exercise Engine (engine/)

```javascript
/**
 * Configuration d'un exercice.
 */
interface ExerciseConfig {
  id: string;
  category: 'note-reading' | 'rhythm' | 'interval' | 'chord';
  mode: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  skills: string[];
  config: {
    clef?: 'treble' | 'bass';
    range?: { low: string, high: string };
    accidentals?: boolean;
    questionsCount?: number;
    timing?: 'untimed' | 'per-question' | 'total';
    // ... autres options selon le type
  };
}

/**
 * Session d'exercice en cours.
 */
interface ExerciseSession {
  exerciseId: string;
  startedAt: number;
  questions: Question[];
  currentIndex: number;
  results: QuestionResult[];
  score: {
    correct: number;
    total: number;
    points: number;
    streak: number;
    bestStreak: number;
  };
}

/**
 * Moteur de gestion des exercices.
 */
class ExerciseEngine {
  constructor(exerciseConfig: ExerciseConfig);

  /** Démarre une nouvelle session */
  startSession(): ExerciseSession;

  /** Question courante */
  getCurrentQuestion(): Question;

  /** Soumet une réponse */
  submitAnswer(answer: any): QuestionResult;

  /** Passe à la question suivante */
  nextQuestion(): Question | null;

  /** Termine la session */
  endSession(): SessionSummary;

  // Événements
  on(event: 'answer' | 'complete' | 'streak', callback: Function): void;
}
```

### Progress Tracker (engine/)

```javascript
/**
 * Données de progression utilisateur.
 */
interface ProgressData {
  level: number;
  xp: number;
  skills: Record<string, SkillProgress>;
  history: SessionRecord[];
  achievements: string[];
  settings: UserSettings;
}

interface SkillProgress {
  level: number;        // 0-10
  accuracy: number;     // 0-1
  attempts: number;
  lastPracticed: string; // ISO date
}

interface SessionRecord {
  date: string;
  exerciseId: string;
  score: number;
  maxScore: number;
  duration: number;     // ms
}

/**
 * Gestionnaire de progression.
 */
class ProgressTracker {
  /** Charge la progression depuis GameKit */
  load(): ProgressData;

  /** Sauvegarde la progression */
  save(): void;

  /** Met à jour après une session */
  recordSession(session: ExerciseSession): void;

  /** Calcule le niveau global */
  calculateLevel(): number;

  /** Vérifie et débloque les achievements */
  checkAchievements(): string[];

  /** Vérifie si un exercice est débloqué */
  isExerciseUnlocked(exerciseId: string): boolean;
}
```

---

## Data Formats

### exercises.json

```json
{
  "categories": [
    {
      "id": "note-reading",
      "name": "Lecture de notes",
      "icon": "🎼",
      "exercises": [
        {
          "id": "note-treble-natural",
          "mode": "visual-to-name",
          "title": "Clé de sol - Notes naturelles",
          "description": "Identifier les notes Do à Si en clé de sol",
          "difficulty": 1,
          "skills": ["treble-clef"],
          "prerequisites": [],
          "config": {
            "clef": "treble",
            "range": { "low": "C4", "high": "G5" },
            "accidentals": false,
            "questionsCount": 20
          }
        },
        {
          "id": "note-treble-sharps",
          "mode": "visual-to-name",
          "title": "Clé de sol - Avec dièses",
          "difficulty": 2,
          "skills": ["treble-clef", "accidentals"],
          "prerequisites": ["note-treble-natural"],
          "config": {
            "clef": "treble",
            "range": { "low": "C4", "high": "G5" },
            "accidentals": "sharps",
            "questionsCount": 20
          }
        }
      ]
    },
    {
      "id": "intervals",
      "name": "Intervalles",
      "icon": "↕️",
      "exercises": [
        {
          "id": "interval-visual-small",
          "mode": "visual-identify",
          "title": "Petits intervalles",
          "description": "Identifier secondes et tierces",
          "difficulty": 2,
          "skills": ["intervals"],
          "config": {
            "intervals": ["m2", "M2", "m3", "M3"],
            "direction": "ascending",
            "harmonic": false
          }
        }
      ]
    }
  ]
}
```

### levels.json

```json
{
  "levels": [
    { "level": 1, "xpRequired": 0, "title": "Débutant" },
    { "level": 2, "xpRequired": 100, "title": "Apprenti" },
    { "level": 3, "xpRequired": 300, "title": "Initié" },
    { "level": 4, "xpRequired": 600, "title": "Confirmé" },
    { "level": 5, "xpRequired": 1000, "title": "Expert" }
  ],
  "xpPerCorrect": 10,
  "xpBonusStreak3": 5,
  "xpBonusStreak5": 10,
  "xpBonusStreak10": 25,
  "achievements": [
    {
      "id": "first-perfect",
      "name": "Parfait !",
      "description": "Terminer un exercice sans erreur",
      "condition": "session.score.correct === session.score.total"
    },
    {
      "id": "streak-10",
      "name": "En série",
      "description": "10 bonnes réponses d'affilée",
      "condition": "session.score.bestStreak >= 10"
    }
  ]
}
```

---

## UI Components

### Layout principal

```
┌─────────────────────────────────────────────────────────────┐
│  🎼 Diese & Mat                     ⚙️ Settings    Niveau 3 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │               Zone de portée                        │   │
│  │          (ScoreRenderer / VexFlow)                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Feedback (correct/incorrect)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  │  Do  │ │  Ré  │ │  Mi  │ │  Fa  │ │ Sol  │ │  La  │ │  Si  │
│  │  (1) │ │  (2) │ │  (3) │ │  (4) │ │  (5) │ │  (6) │ │  (7) │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Score: 15/20    Points: 180    Streak: 🔥 5         │   │
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `1` - `7` | Répondre Do à Si |
| `8` - `0` | Altérations (si activé) |
| `Espace` | Passer (après feedback) |
| `Échap` | Menu / Quitter |
| `P` | Rejouer le son |
| `H` | Indice |

---

## Color Scheme

```css
/* Variables cohérentes avec theme.css */
:root {
  /* Notes et portée */
  --staff-line: var(--color-text);
  --note-fill: var(--color-text);
  --note-stroke: var(--color-text);

  /* Feedback */
  --feedback-correct: var(--color-success);
  --feedback-incorrect: var(--color-error);
  --feedback-hint: var(--color-warning);

  /* Altérations */
  --sharp-color: #e94560;
  --flat-color: #4a90d9;
}
```

---

## Tests

### Tests unitaires requis

1. **Pitch.test.js**
   - Construction et propriétés
   - Conversions (MIDI, fréquence, notation)
   - Parsing de chaînes
   - Équivalence enharmonique

2. **Interval.test.js**
   - Calcul entre deux notes
   - Conversion en demi-tons
   - Nommage français
   - Application (transposition)

3. **Chord.test.js**
   - Construction par type
   - Notes générées
   - Renversements
   - Nommage

4. **ExerciseEngine.test.js**
   - Génération de questions
   - Évaluation des réponses
   - Calcul de score
   - Gestion de session

5. **ScoreCalculator.test.js**
   - Points de base
   - Bonus de streak
   - XP par skill

---

## Future Enhancements

### Version 2.0 - MIDI Input
- Support clavier MIDI USB
- Détection automatique des périphériques
- Latence minimale

### Version 3.0 - Ear Training avancé
- Dictée musicale
- Reconnaissance de progressions d'accords
- Détection de hauteur via micro

### Version 4.0 - Multi-instruments
- Tablature guitare
- Notation percussion
- Transposition automatique

### Version 5.0 - Social
- Leaderboards par exercice
- Défis quotidiens
- Mode multijoueur

---

## Dependencies

| Librairie | Version | Usage | Taille |
|-----------|---------|-------|--------|
| VexFlow | 4.2.3 | Rendu de partitions | ~500KB |
| Tone.js | 14.7.77 | Synthèse audio | ~200KB |

Chargées via CDN (unpkg), avec lazy loading pour minimiser l'impact sur le chargement initial.
