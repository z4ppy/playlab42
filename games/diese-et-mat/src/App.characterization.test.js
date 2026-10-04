/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { deserialize, serialize } from 'node:v8';
import { App } from './App.js';
import GameKit from '../../../lib/gamekit.js';

/**
 * Caractérise la vraie classe App : DOM jsdom, localStorage jsdom, moteur
 * d'exercice, renderers et contrôleurs réels. Seuls fetch, la fenêtre de
 * confirmation et le moteur audio (via SynthManager) sont remplacés.
 */
const EXERCISES = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));
// jsdom ne fournit pas encore structuredClone, contrairement aux navigateurs cibles.
globalThis.structuredClone = value => deserialize(serialize(value));

const VIEW_IDS = ['menu-view', 'exercise-view', 'progress-view', 'settings-view'];
const BUTTON_IDS = [
  'btn-progress', 'btn-settings', 'btn-memo', 'memo-close', 'btn-piano', 'piano-close', 'btn-synth',
  'synth-close', 'synth-test-btn', 'btn-metronome', 'metronome-close', 'btn-tuner', 'tuner-close',
];
const OVERLAY_IDS = ['memo-overlay', 'piano-overlay', 'synth-overlay', 'metronome-overlay', 'tuner-overlay'];

const buildDom = () => {
  document.body.innerHTML = [
    '<div id="loading"></div><div id="audio-banner"></div><span id="level-badge"></span>',
    ...BUTTON_IDS.map((id) => `<button id="${id}"></button>`),
    ...OVERLAY_IDS.map((id) => `<div id="${id}"></div>`),
    ...VIEW_IDS.map((id) => `<div id="${id}"></div>`),
  ].join('');
};

const mockFetch = (payload = EXERCISES, ok = true) => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(payload),
  }));
};

const correctAnswerFor = (question) => {
  if (question.type === 'note') {return question.pitch.pitchClass;}
  if (question.type === 'interval') {return question.interval.toSemitones();}
  return question.expectedType;
};

const click = (target) => target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('App - caractérisation', () => {
  let app;
  let errorSpy;
  let warnSpy;
  let saveProgress;

  const stubAudio = () => {
    app.synthManager.ensureAudioReady = jest.fn().mockResolvedValue(undefined);
    app.synthManager.playNote = jest.fn().mockResolvedValue(undefined);
    app.audioStub = { playPianoNote: jest.fn(), playPianoChord: jest.fn() };
    jest.spyOn(app.synthManager, 'audioEngine', 'get').mockReturnValue(app.audioStub);
  };

  beforeEach(() => {
    localStorage.clear();
    buildDom();
    mockFetch();
    saveProgress = jest.spyOn(GameKit, 'saveProgress').mockReturnValue(true);
    jest.spyOn(GameKit, 'loadProgress').mockReturnValue(null);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    app = new App();
  });

  afterEach(() => {
    jest.useRealTimers();
    app.dispose();
    jest.restoreAllMocks();
    delete window.onGamePause;
    delete window.onGameResume;
    delete window.onGameDispose;
    delete window.onSoundChange;
  });

  describe('construction et initialisation', () => {
    test('expose un état initial vide et dix exercices', () => {
      expect(app.currentView).toBe('menu');
      expect(app.audioReady).toBe(false);
      expect(app.engine).toBeNull();
      expect(app.metronome).toBeNull();
      expect(app.audioEngine).toBeNull();
      expect(app.exercisesList).toHaveLength(10);
      expect(app.progress).toEqual(app.dataManager.progress);
      expect(app.settings).toEqual(app.dataManager.settings);
    });

    test('init met les éléments en cache, masque le chargement et affiche le menu', () => {
      app.init();
      expect(app.elements.menuView).toBe(document.getElementById('menu-view'));
      expect(document.getElementById('loading').style.display).toBe('none');
      expect(document.getElementById('menu-view').classList.contains('active')).toBe(true);
      expect(document.getElementById('level-badge').textContent).toBe('Niveau 1');
      expect(app.menuController).not.toBeNull();
      expect(app.metronome).toBe(app.metronomeController.metronome);
    });

    test('init tolère une page sans éléments optionnels', () => {
      document.body.innerHTML = '';
      expect(() => app.init()).not.toThrow();
      expect(app.currentView).toBe('menu');
    });

    test('les hooks GameKit sont installés et onGameDispose libère l’application', () => {
      app.init();
      expect(() => { window.onGamePause(); window.onGameResume(); window.onSoundChange(); }).not.toThrow();
      window.onGameDispose();
      expect(app.menuController).toBeNull();
    });

    test('sélectionner un exercice du menu le démarre', () => {
      app.init();
      const start = jest.spyOn(app, 'startExercise').mockResolvedValue();
      app.menuController.emit('exercise-selected', { exerciseId: 'note-treble-natural' });
      expect(start).toHaveBeenCalledWith('note-treble-natural');
    });
  });

  describe('navigation', () => {
    beforeEach(() => app.init());

    test('showView active une seule vue et rend son contenu', () => {
      app.showView('progress');
      expect(app.currentView).toBe('progress');
      expect(document.getElementById('progress-view').classList.contains('active')).toBe(true);
      expect(document.getElementById('menu-view').classList.contains('active')).toBe(false);
      expect(document.getElementById('progress-view').textContent).toContain('Ma progression');
      app.showView('settings');
      expect(document.getElementById('progress-view').classList.contains('active')).toBe(false);
      expect(document.getElementById('settings-view').textContent).toContain('Paramètres');
    });

    test('showView ignore une vue inconnue : la vue courante est conservée mais masquée', () => {
      app.showView('inconnue');
      expect(app.currentView).toBe('menu');
      expect(document.getElementById('menu-view').classList.contains('active')).toBe(false);
    });

    test('showView exercise ne rend aucun contenu automatique', () => {
      app.showView('exercise');
      expect(app.currentView).toBe('exercise');
      expect(document.getElementById('exercise-view').innerHTML).toBe('');
    });

    test('les boutons du header ouvrent progression et paramètres', () => {
      click(document.getElementById('btn-progress'));
      expect(app.currentView).toBe('progress');
      click(document.getElementById('btn-settings'));
      expect(app.currentView).toBe('settings');
    });

    test('les boutons Retour reviennent au menu', () => {
      app.showView('progress');
      click(document.getElementById('btn-back-progress'));
      expect(app.currentView).toBe('menu');
      app.showView('settings');
      click(document.getElementById('btn-back-settings'));
      expect(app.currentView).toBe('menu');
    });
  });

  describe('panneaux et surcouches', () => {
    beforeEach(() => app.init());

    test('le mémo s’ouvre, se ferme par son bouton et par un clic sur le fond seulement', () => {
      const overlay = document.getElementById('memo-overlay');
      click(document.getElementById('btn-memo'));
      expect(overlay.classList.contains('visible')).toBe(true);
      overlay.appendChild(document.createElement('p')).click();
      expect(overlay.classList.contains('visible')).toBe(true);
      click(overlay);
      expect(overlay.classList.contains('visible')).toBe(false);
      app.showMemo();
      click(document.getElementById('memo-close'));
      expect(overlay.classList.contains('visible')).toBe(false);
    });

    test.each([
      ['piano', 'pianoController', 'btn-piano', 'piano-close', 'piano-overlay'],
      ['synth', 'synthController', 'btn-synth', 'synth-close', 'synth-overlay'],
      ['metronome', 'metronomeController', 'btn-metronome', 'metronome-close', 'metronome-overlay'],
      ['tuner', 'tunerController', 'btn-tuner', 'tuner-close', 'tuner-overlay'],
    ])('le panneau %s est piloté par son contrôleur', (_name, key, openId, closeId, overlayId) => {
      const controller = app[key];
      const show = jest.spyOn(controller, 'show').mockImplementation(() => {});
      const hide = jest.spyOn(controller, 'hide').mockImplementation(() => {});
      click(document.getElementById(openId));
      expect(show).toHaveBeenCalledTimes(1);
      click(document.getElementById(closeId));
      expect(hide).toHaveBeenCalledTimes(1);
      const overlay = document.getElementById(overlayId);
      overlay.appendChild(document.createElement('span')).click();
      expect(hide).toHaveBeenCalledTimes(1);
      click(overlay);
      expect(hide).toHaveBeenCalledTimes(2);
    });

    test('showPiano/hidePiano/showSynth/hideSynth délèguent sans contrôleur sans échouer', () => {
      app.pianoController = null;
      app.synthController = null;
      expect(() => { app.showPiano(); app.hidePiano(); app.showSynth(); app.hideSynth(); }).not.toThrow();
    });

    test('le bouton de test du synthé joue un Do4 de 0,5 s', async () => {
      stubAudio();
      click(document.getElementById('synth-test-btn'));
      await Promise.resolve();
      expect(app.synthManager.playNote).toHaveBeenCalledWith('C4', 0.5);
    });

    test('showMemo/hideMemo sont sans effet sans overlay', () => {
      app.elements.memoOverlay = null;
      expect(() => { app.showMemo(); app.hideMemo(); }).not.toThrow();
    });

    test('keyup relâche une touche du piano visible et ignore les autres', () => {
      const piano = app.pianoController;
      const handleKeyUp = jest.spyOn(piano, 'handleKeyUp').mockImplementation(() => {});
      const visible = jest.spyOn(piano, 'isVisible').mockReturnValue(true);
      jest.spyOn(piano, 'keyMap', 'get').mockReturnValue({ q: 'C4' });
      const key = 'q';
      app.handleKeyup({ key: key.toUpperCase() });
      app.handleKeyup({ key: '#' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleKeyUp).toHaveBeenCalledWith(key);
      visible.mockReturnValue(false);
      app.handleKeyup({ key });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
    });

    test('le clavier global est relié à handleKeydown et handleKeyup', () => {
      const down = jest.spyOn(app, 'handleKeydown').mockImplementation(() => {});
      const up = jest.spyOn(app, 'handleKeyup').mockImplementation(() => {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
      expect(down).toHaveBeenCalledTimes(1);
      expect(up).toHaveBeenCalledTimes(1);
    });
  });

  describe('audio', () => {
    beforeEach(() => {
      app.init();
      stubAudio();
    });

    test('initAudio prépare l’audio une fois et masque la bannière', async () => {
      await app.initAudio();
      await app.initAudio();
      expect(app.audioReady).toBe(true);
      expect(app.synthManager.ensureAudioReady).toHaveBeenCalledTimes(1);
      expect(document.getElementById('audio-banner').classList.contains('hidden')).toBe(true);
    });

    test('initAudio journalise un échec sans marquer l’audio prêt', async () => {
      app.synthManager.ensureAudioReady.mockRejectedValue(new Error('refusé'));
      await app.initAudio();
      expect(app.audioReady).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      expect(document.getElementById('audio-banner').classList.contains('hidden')).toBe(false);
    });

    test('un clic sur la bannière initialise l’audio', async () => {
      click(document.getElementById('audio-banner'));
      await Promise.resolve();
      await Promise.resolve();
      expect(app.audioReady).toBe(true);
    });

    test('le premier geste utilisateur initialise l’audio puis retire ses écouteurs', async () => {
      const init = jest.spyOn(app, 'initAudio').mockResolvedValue();
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      await Promise.resolve();
      expect(init).toHaveBeenCalledTimes(1);
    });

    test('un échec du premier geste affiche la bannière audio', async () => {
      document.getElementById('audio-banner').classList.add('hidden');
      jest.spyOn(app, 'initAudio').mockRejectedValue(new Error('bloqué'));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(document.getElementById('audio-banner').classList.contains('hidden')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });

    test('playNoteAudio joue la note via le synthé partagé', async () => {
      await app.playNoteAudio('C4');
      expect(app.audioStub.playPianoNote).toHaveBeenCalledWith('C4', 0.8);
      expect(app.audioReady).toBe(true);
    });

    test('playChordAudio joue l’accord via le synthé partagé', async () => {
      await app.playChordAudio(['C4', 'E4']);
      expect(app.audioStub.playPianoChord).toHaveBeenCalledWith(['C4', 'E4'], 1);
    });

    test.each([['playNoteAudio', 'C4', 'playPianoNote'], ['playChordAudio', ['C4'], 'playPianoChord']])(
      '%s n’émet aucun son si l’audio refuse de démarrer',
      async (method, arg, engineMethod) => {
        app.synthManager.ensureAudioReady.mockRejectedValue(new Error('refusé'));
        await app[method](arg);
        expect(app.audioStub[engineMethod]).not.toHaveBeenCalled();
        expect(app.audioReady).toBe(false);
      },
    );

    test('la lecture est sans effet sans moteur audio', async () => {
      app.synthManager.audioEngine; // accès au getter simulé
      jest.spyOn(app.synthManager, 'audioEngine', 'get').mockReturnValue(null);
      await expect(app.playNoteAudio('C4')).resolves.toBeUndefined();
    });
  });

  describe('exercice', () => {
    const start = async (id) => {
      await app.startExercise(id);
      return app.engine.currentQuestion;
    };

    beforeEach(() => {
      app.init();
      stubAudio();
    });

    test('startExercise charge les données une seule fois et affiche la première question', async () => {
      await start('note-treble-natural');
      await app.startExercise('note-treble-natural');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('./data/exercises.json');
      expect(app.currentView).toBe('exercise');
      expect(app.currentExercise.id).toBe('note-treble-natural');
      expect(document.getElementById('question-num').textContent).toBe('1');
      expect(document.getElementById('progress-bar').style.width).toBe('0%');
      expect(document.querySelectorAll('.note-btn')).toHaveLength(7);
      expect(app._startingExercise).toBe(false);
    });

    test('un double démarrage concurrent n’est exécuté qu’une fois', async () => {
      await Promise.all([app.startExercise('note-treble-natural'), app.startExercise('note-treble-natural')]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('une erreur HTTP affiche une alerte dans le menu et libère le verrou', async () => {
      mockFetch({}, false);
      await app.startExercise('note-treble-natural');
      const alert = document.querySelector('#menu-view [role="alert"]');
      expect(alert.textContent).toContain('Impossible de charger les exercices');
      expect(app._startingExercise).toBe(false);
      expect(app.engine).toBeNull();
      expect(app.currentView).toBe('menu');
    });

    test('une exception réseau est présentée de la même façon', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('hors ligne'));
      await app.startExercise('note-treble-natural');
      expect(document.querySelector('.error-message')).not.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    test('un exercice inconnu est journalisé sans changer de vue', async () => {
      await app.startExercise('absent');
      expect(app.currentView).toBe('menu');
      expect(app.engine).toBeNull();
      expect(app._startingExercise).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    test('le message d’erreur disparaît après cinq secondes', () => {
      jest.useFakeTimers();
      app._showErrorMessage('<b>x</b>');
      const alert = document.querySelector('.error-message');
      expect(alert.textContent).toBe('<b>x</b>');
      expect(alert.getAttribute('aria-live')).toBe('assertive');
      jest.advanceTimersByTime(5000);
      expect(document.querySelector('.error-message')).toBeNull();
    });

    test('le message d’erreur est ignoré sans vue menu', () => {
      app.elements.menuView = null;
      document.getElementById('menu-view').remove();
      expect(() => app._showErrorMessage('x')).not.toThrow();
    });

    test('_escapeHtml neutralise le balisage', () => {
      expect(app._escapeHtml('<img src=x onerror=1>&')).toBe('&lt;img src=x onerror=1&gt;&amp;');
    });

    test.each([
      ['interval-basic', 7, 'repeat(7, 1fr)'],
      ['chord-major-minor', 4, 'repeat(4, 1fr)'],
    ])('les boutons de %s ont %i choix', async (id, count, columns) => {
      await start(id);
      expect(document.querySelectorAll('.note-btn')).toHaveLength(count);
      expect(document.getElementById('note-buttons').style.gridTemplateColumns).toBe(columns);
    });

    test('le mode rythme masque les boutons classiques et délègue au RhythmController', async () => {
      const show = jest.spyOn(app.rhythmController, 'show').mockImplementation(() => {});
      await start('rhythm-basic');
      expect(document.getElementById('note-buttons').style.display).toBe('none');
      expect(show).toHaveBeenCalledWith(app.engine.currentQuestion, document.getElementById('staff-container'));
    });

    test('renderExerciseUI et renderAnswerButtons sont sans effet sans conteneur', () => {
      app.elements.exerciseView = null;
      expect(() => app.renderExerciseUI(EXERCISES.exercises[0])).not.toThrow();
      document.body.innerHTML = '';
      expect(() => app.renderAnswerButtons('chord')).not.toThrow();
    });

    test('showQuestion ignore une question vide', () => {
      expect(() => app.showQuestion(null)).not.toThrow();
    });

    test('showQuestion note affiche la portée en lecture et masque la portée en écoute', async () => {
      await start('note-treble-natural');
      const render = jest.spyOn(app.questionRenderer, 'renderNoteQuestion');
      const ear = jest.spyOn(app.questionRenderer, 'renderEarTrainingQuestion');
      app.showQuestion(app.engine.currentQuestion);
      expect(render).toHaveBeenCalledTimes(1);
      expect(ear).not.toHaveBeenCalled();
      app.currentExercise = { ...app.currentExercise, mode: 'audio-to-name' };
      app.showQuestion(app.engine.currentQuestion);
      expect(ear).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['interval-basic', 'renderIntervalQuestion'],
      ['chord-major-minor', 'renderChordQuestion'],
    ])('showQuestion de %s utilise %s', async (id, method) => {
      await start(id);
      const render = jest.spyOn(app.questionRenderer, method);
      app.showQuestion(app.engine.currentQuestion);
      expect(render).toHaveBeenCalledTimes(1);
    });

    test('showQuestion réinitialise feedback et boutons', async () => {
      await start('note-treble-natural');
      document.getElementById('feedback-container').textContent = 'ancien';
      app.setButtonsEnabled(false);
      app.showQuestion(app.engine.currentQuestion);
      expect(document.getElementById('feedback-container').innerHTML).toBe('');
      expect(document.querySelector('.note-btn').disabled).toBe(false);
    });

    test('showQuestion ignore un type de question inconnu', async () => {
      await start('note-treble-natural');
      expect(() => app.showQuestion({ type: 'autre' })).not.toThrow();
    });

    test('une bonne réponse met à jour score et feedback puis passe à la question suivante', async () => {
      jest.useFakeTimers();
      const question = await start('note-treble-natural');
      const highlight = jest.spyOn(app.staffRenderer, 'highlightCorrect');
      app.submitAnswer(correctAnswerFor(question));
      expect(highlight).toHaveBeenCalledTimes(1);
      expect(document.getElementById('feedback-container').textContent).toContain('Correct');
      expect(document.getElementById('score-display').textContent).toMatch(/^\d+ pts$/);
      expect([...document.querySelectorAll('.note-btn')].every((btn) => btn.disabled)).toBe(true);
      jest.advanceTimersByTime(1500);
      expect(document.getElementById('question-num').textContent).toBe('2');
      expect(document.querySelector('.note-btn').disabled).toBe(false);
    });

    test('une série affiche son compteur', async () => {
      jest.useFakeTimers();
      await start('note-treble-natural');
      for (let i = 0; i < 2; i++) {
        app.submitAnswer(correctAnswerFor(app.engine.currentQuestion));
        if (i === 0) {jest.advanceTimersByTime(1500);}
      }
      expect(document.getElementById('feedback-container').textContent).toContain('Série de 2');
    });

    test('une mauvaise réponse montre la bonne note et la colore sur le clavier', async () => {
      jest.useFakeTimers();
      const question = await start('note-treble-natural');
      const wrong = (correctAnswerFor(question) + 1) % 7;
      const highlight = jest.spyOn(app.staffRenderer, 'highlightError');
      app.submitAnswer(wrong);
      expect(highlight).toHaveBeenCalledTimes(1);
      expect(document.getElementById('feedback-container').textContent).toContain('La réponse était');
      const good = document.querySelector(`.note-btn[data-note="${correctAnswerFor(question)}"]`);
      expect(good.style.background).toBe('var(--color-success)');
    });

    test('submitAnswer est ignoré sans session active', () => {
      expect(() => app.submitAnswer(1)).not.toThrow();
      expect(document.getElementById('feedback-container')).toBeNull();
    });

    test('les réponses d’intervalle sont soumises par les boutons', async () => {
      const question = await start('interval-basic');
      const submit = jest.spyOn(app, 'submitAnswer').mockImplementation(() => {});
      const semitones = question.interval.toSemitones();
      const button = document.querySelector(`.note-btn[data-semitones="${semitones}"]`);
      if (button) {click(button);} else {click(document.querySelector('.note-btn'));}
      expect(submit).toHaveBeenCalledTimes(1);
    });

    test('les boutons d’accord et de note soumettent leur valeur', async () => {
      await start('chord-major-minor');
      const submit = jest.spyOn(app, 'submitAnswer').mockImplementation(() => {});
      click(document.querySelector('.note-btn[data-chord="minor"]'));
      expect(submit).toHaveBeenCalledWith('minor');
      await start('note-treble-natural');
      click(document.querySelector('.note-btn[data-note="3"]'));
      expect(submit).toHaveBeenLastCalledWith(3);
    });

    test('passer une question compte comme une réponse -1', async () => {
      await start('note-treble-natural');
      const submit = jest.spyOn(app, 'submitAnswer').mockImplementation(() => {});
      click(document.getElementById('btn-skip'));
      expect(submit).toHaveBeenCalledWith(-1);
    });

    test('l’indice est affiché dans le feedback', async () => {
      await start('note-treble-natural');
      click(document.getElementById('btn-hint'));
      expect(document.getElementById('feedback-container').textContent).toContain('💡');
    });

    test('showHint est sans effet sans moteur', () => {
      expect(() => app.showHint()).not.toThrow();
    });

    test('la dernière réponse affiche les résultats et sauvegarde la progression', async () => {
      jest.useFakeTimers();
      await start('rhythm-basic');
      app.engine.totalQuestions = 1;
      app.engine.currentIndex = 1;
      app.submitAnswer('correct');
      jest.advanceTimersByTime(1500);
      expect(document.getElementById('exercise-view').textContent).toContain('Exercice terminé');
      expect(app.dataManager.progress.history.length).toBe(1);
      expect(app.dataManager.xp).toBeGreaterThan(0);
      expect(document.getElementById('level-badge').textContent).toMatch(/^Niveau \d+$/);
    });

    test('showResults propose de rejouer ou de revenir au menu', async () => {
      await start('note-treble-natural');
      app.showResults();
      const restart = jest.spyOn(app, 'startExercise').mockResolvedValue();
      click(document.getElementById('btn-replay'));
      expect(restart).toHaveBeenCalledWith('note-treble-natural');
      click(document.getElementById('btn-back-menu'));
      expect(app.currentView).toBe('menu');
      expect(document.getElementById('exercise-view').textContent).toContain('0%');
    });

    test.each([
      [10, 10, '🏆'],
      [5, 10, '👍'],
      [1, 10, '💪'],
    ])('showResults choisit l’emoji selon %i/%i bonnes réponses', async (correct, total, emoji) => {
      await start('note-treble-natural');
      jest.spyOn(app.engine, 'endSession').mockReturnValue({
        exerciseId: 'x', totalScore: 10, correctCount: correct, totalCount: total, maxStreak: 2,
      });
      app.showResults();
      expect(document.getElementById('exercise-view').textContent).toContain(emoji);
    });

    test('updateProgressFromSession pondère la précision de la compétence', () => {
      const { progress } = app.dataManager;
      progress.skills['treble-clef'] = { accuracy: 0.5, attempts: 1 };
      app.updateProgressFromSession({ exerciseId: 'x', skill: 'treble-clef', totalScore: 30, correctCount: 10, totalCount: 10 });
      expect(app.dataManager.progress.skills['treble-clef']).toEqual(expect.objectContaining({ accuracy: 0.75, attempts: 2 }));
      expect(app.dataManager.xp).toBe(30);
    });

    test('updateProgressFromSession gère session vide, première tentative et compétence inconnue', () => {
      const { progress } = app.dataManager;
      progress.skills['intervals'] = { accuracy: 0, attempts: 0 };
      app.updateProgressFromSession({ exerciseId: 'x', skill: 'intervals', totalScore: 0, correctCount: 0, totalCount: 0 });
      app.updateProgressFromSession({ exerciseId: 'y', skill: 'inconnue', totalScore: 0, correctCount: 1, totalCount: 2 });
      expect(app.dataManager.progress.skills['intervals'].attempts).toBe(1);
      expect(app.dataManager.progress.history).toHaveLength(2);
    });

    test('endExercise annule la session, libère la portée et retourne au menu', async () => {
      await start('note-treble-natural');
      const staff = app.staffRenderer;
      const dispose = jest.spyOn(staff, 'dispose');
      app.endExercise();
      expect(app.engine).toBeNull();
      expect(app.staffRenderer).toBeNull();
      expect(dispose).toHaveBeenCalled();
      expect(app.currentView).toBe('menu');
      app.endExercise();
      expect(app.currentView).toBe('menu');
    });

    test('le bouton quitter termine l’exercice', async () => {
      await start('note-treble-natural');
      click(document.getElementById('btn-quit'));
      expect(app.engine).toBeNull();
    });

    test('la fin du rythme soumet au moteur, affiche le feedback puis enchaîne', async () => {
      jest.useFakeTimers();
      jest.spyOn(app.rhythmController, 'show').mockImplementation(() => {});
      const feedback = jest.spyOn(app.rhythmController, 'showEndFeedback').mockImplementation(() => {});
      await start('rhythm-basic');
      app.rhythmController.emit('rhythm-ended', { hits: 3, total: 4, accuracy: 0.75, isCorrect: true });
      expect(feedback).toHaveBeenCalledWith(true, 0.75, 3, 4);
      expect(app.engine.getProgress().stats.correctCount).toBe(1);
      jest.advanceTimersByTime(1500);
      expect(app.engine.getProgress().current).toBe(2);
    });

    test('la fin du rythme sur la dernière question affiche les résultats', async () => {
      jest.useFakeTimers();
      jest.spyOn(app.rhythmController, 'show').mockImplementation(() => {});
      jest.spyOn(app.rhythmController, 'showEndFeedback').mockImplementation(() => {});
      await start('rhythm-basic');
      app.engine.currentIndex = app.engine.totalQuestions;
      app.rhythmController.emit('rhythm-ended', { hits: 0, total: 4, accuracy: 0, isCorrect: false });
      jest.advanceTimersByTime(1500);
      expect(document.getElementById('exercise-view').textContent).toContain('Exercice terminé');
    });

    test('la fin du rythme sans moteur ne soumet rien et ne plante pas', () => {
      jest.useFakeTimers();
      const feedback = jest.spyOn(app.rhythmController, 'showEndFeedback').mockImplementation(() => {});
      app.rhythmController.emit('rhythm-ended', { hits: 0, total: 1, accuracy: 0, isCorrect: false });
      expect(feedback).toHaveBeenCalled();
      expect(() => jest.advanceTimersByTime(1500)).not.toThrow();
    });
  });

  describe('son de la question', () => {
    beforeEach(() => {
      app.init();
      stubAudio();
    });

    test('est silencieux sans question', async () => {
      await app.playCurrentQuestionSound();
      expect(app.audioStub.playPianoNote).not.toHaveBeenCalled();
    });

    test('joue une note', async () => {
      app.engine = { currentQuestion: { type: 'note', pitch: 'C4' } };
      await app.playCurrentQuestionSound();
      expect(app.audioStub.playPianoNote).toHaveBeenCalledWith('C4', 0.8);
    });

    test('joue un intervalle en deux temps espacés de 500 ms', async () => {
      jest.useFakeTimers();
      app.engine = { currentQuestion: { type: 'interval', pitch1: 'C4', pitch2: 'E4' } };
      await app.playCurrentQuestionSound();
      expect(app.audioStub.playPianoNote).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
      expect(app.audioStub.playPianoNote).toHaveBeenLastCalledWith('E4', 0.8);
    });

    test('joue un accord et ignore note sans hauteur ou rythme', async () => {
      app.engine = { currentQuestion: { type: 'chord', chord: { getPitches: () => ['C4', 'E4', 'G4'] } } };
      await app.playCurrentQuestionSound();
      expect(app.audioStub.playPianoChord).toHaveBeenCalledWith(['C4', 'E4', 'G4'], 1);
      app.audioStub.playPianoNote.mockClear();
      app.engine = { currentQuestion: { type: 'note' } };
      await app.playCurrentQuestionSound();
      app.engine = { currentQuestion: { type: 'rhythm' } };
      await app.playCurrentQuestionSound();
      expect(app.audioStub.playPianoNote).not.toHaveBeenCalled();
    });
  });

  describe('progression et paramètres', () => {
    beforeEach(() => app.init());

    test('renderProgress affiche niveau, XP et quatre compétences en pourcentage', () => {
      app.dataManager.progress.skills['treble-clef'] = { accuracy: 0.756, attempts: 3 };
      app.dataManager.progress.level = 4;
      app.dataManager.progress.xp = 120;
      app.renderProgress();
      const view = document.getElementById('progress-view');
      expect(view.textContent).toContain('120 XP');
      expect(view.querySelector('[aria-label="Niveau 4"]')).not.toBeNull();
      const bars = view.querySelectorAll('[role="progressbar"]');
      expect([...bars].map((bar) => bar.getAttribute('aria-valuenow'))).toEqual(['76', '0', '0', '0']);
    });

    test('renderSkillBar produit un identifiant stable et un pourcentage arrondi', () => {
      const html = app.renderSkillBar('Clé de sol', 0.333);
      expect(html).toContain('id="skill-clé-de-sol"');
      expect(html).toContain('33%');
    });

    test('renderProgress et renderSettings sont sans effet sans conteneur', () => {
      app.elements.progressView = null;
      app.elements.settingsView = null;
      expect(() => { app.renderProgress(); app.renderSettings(); }).not.toThrow();
    });

    test('renderSettings marque la notation active', () => {
      app.renderSettings();
      const active = document.querySelector('.notation-btn.active');
      expect(active.dataset.notation).toBe('french');
      expect(active.getAttribute('aria-checked')).toBe('true');
    });

    test('choisir la notation anglaise la sauvegarde et re-rend la vue', () => {
      app.renderSettings();
      click(document.querySelector('.notation-btn[data-notation="english"]'));
      expect(app.settings.notation).toBe('english');
      expect(document.querySelector('.notation-btn.active').dataset.notation).toBe('english');
    });

    test('réinitialiser demande confirmation', () => {
      app.dataManager.progress.xp = 50;
      app.renderSettings();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      click(document.getElementById('btn-reset-progress'));
      expect(confirmSpy).toHaveBeenCalled();
      expect(app.dataManager.xp).toBe(50);
      confirmSpy.mockReturnValue(true);
      click(document.getElementById('btn-reset-progress'));
      expect(app.dataManager.xp).toBe(0);
      expect(app.currentView).toBe('menu');
      expect(document.getElementById('level-badge').textContent).toBe('Niveau 1');
    });

    test('updateLevelBadge est sans effet sans badge', () => {
      app.elements.levelBadge = null;
      expect(() => app.updateLevelBadge()).not.toThrow();
    });
  });

  describe('exercices débloqués', () => {
    test('tout est débloqué en développement local', () => {
      app.init();
      expect(app.isDevMode()).toBe(true);
      expect(app.isExerciseUnlocked('interval-all')).toBe(true);
    });
  });

  describe('dispose', () => {
    test('libère contrôleurs, renderers et écouteurs globaux et sauvegarde la progression', async () => {
      app.init();
      app.dataManager.progress.xp = 77;
      await app.startExercise('note-treble-natural');
      const controllers = ['tunerController', 'metronomeController', 'synthController', 'pianoController', 'menuController', 'rhythmController'];
      const spies = controllers.map((name) => jest.spyOn(app[name], 'dispose'));
      const synthDispose = jest.spyOn(app.synthManager, 'dispose');
      const questionDispose = jest.spyOn(app.questionRenderer, 'dispose');
      const staffDispose = jest.spyOn(app.staffRenderer, 'dispose');
      const down = jest.spyOn(app, 'handleKeydown').mockImplementation(() => {});
      app.dispose();
      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      expect(synthDispose).toHaveBeenCalled();
      expect(questionDispose).toHaveBeenCalled();
      expect(staffDispose).toHaveBeenCalled();
      controllers.forEach((name) => expect(app[name]).toBeNull());
      expect(app.synthManager).toBeNull();
      expect(app.questionRenderer).toBeNull();
      expect(app.staffRenderer).toBeNull();
      expect(app._keydownHandler).toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      expect(down).not.toHaveBeenCalled();
      expect(saveProgress).toHaveBeenCalledWith(expect.objectContaining({ xp: 77 }));
    });

    test('est idempotent et utilisable avant init', () => {
      expect(() => { app.dispose(); app.dispose(); }).not.toThrow();
    });
  });
});
