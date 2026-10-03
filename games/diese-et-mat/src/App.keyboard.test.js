/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { App } from './App.js';

/**
 * Caractérise les raccourcis clavier de la vraie classe App.
 * Seuls les contrôleurs, le moteur et les méthodes de vue sont des doublons :
 * le DOM, les événements et la logique de décision de l'App restent réels.
 */
describe('Raccourcis clavier de App', () => {
  let app;
  let log;
  let onKeydown;
  let onKeyup;

  const controller = (name, visible) => ({
    isVisible: () => visible,
    hide: () => log.push(`${name}.hide`),
  });

  const press = (key, { target = document.body, ...init } = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    const preventDefault = event.preventDefault.bind(event);
    event.preventDefault = () => {
      log.push('preventDefault');
      preventDefault();
    };
    target.dispatchEvent(event);
    return event;
  };

  const pianoFixture = () => ({
    isVisible: () => true,
    keyMap: { q: 'C4', s: 'D4' },
    handleKeyDown: (key) => log.push(`piano.down:${key}`),
    handleKeyUp: (key) => log.push(`piano.up:${key}`),
  });

  const rhythmFixture = () => ({
    state: { running: true },
    handleKeydown: (event) => log.push(`rhythm:${event.key}:${event.defaultPrevented}`),
  });

  const runningExercise = (mode = 'name-to-note') => {
    app.currentView = 'exercise';
    app.engine = { isRunning: () => true };
    app.currentExercise = { mode };
  };

  beforeEach(() => {
    log = [];
    document.body.innerHTML = `
      <div id="memo" class="visible"></div>
      <input id="champ"><select id="choix"></select><textarea id="zone"></textarea>
      <div contenteditable="true" id="editable"><span id="dans-editable"></span></div>
      <button id="bouton"><span id="dans-bouton"></span></button><a href="#" id="lien">lien</a>`;
    app = new App();
    app.elements.memoOverlay = document.getElementById('memo');
    jest.spyOn(app, 'showView').mockImplementation((view) => log.push(`showView:${view}`));
    jest.spyOn(app, 'hideMemo').mockImplementation(() => log.push('hideMemo'));
    jest.spyOn(app, 'hidePiano').mockImplementation(() => log.push('hidePiano'));
    jest.spyOn(app, 'submitAnswer').mockImplementation((n) => log.push(`submit:${n}`));
    onKeydown = (event) => app.handleKeydown(event);
    onKeyup = (event) => app.handleKeyup(event);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup', onKeyup);
  });

  afterEach(() => {
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('keyup', onKeyup);
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Échap', () => {
    test('ferme une seule surcouche dans l’ordre métronome, accordeur, synthé, piano, mémo', () => {
      app.metronomeController = controller('metronome', true);
      app.tunerController = controller('tuner', true);
      app.synthController = controller('synth', true);
      app.pianoController = { ...pianoFixture(), isVisible: () => true };
      const order = [];
      for (let i = 0; i < 5; i++) {
        log = [];
        press('Escape');
        order.push(...log);
        const hidden = log[0];
        if (hidden === 'metronome.hide') { app.metronomeController = controller('metronome', false); }
        if (hidden === 'tuner.hide') { app.tunerController = controller('tuner', false); }
        if (hidden === 'synth.hide') { app.synthController = controller('synth', false); }
        if (hidden === 'hidePiano') { app.pianoController = null; }
        if (hidden === 'hideMemo') { app.elements.memoOverlay.classList.remove('visible'); }
      }
      expect(order).toEqual(['metronome.hide', 'tuner.hide', 'synth.hide', 'hidePiano', 'hideMemo']);
    });

    test.each([
      ['metronome', ['metronome.hide']],
      ['tuner', ['tuner.hide']],
    ])('ignore les surcouches suivantes quand %s est visible', (name, expected) => {
      app.metronomeController = controller('metronome', name === 'metronome');
      app.tunerController = controller('tuner', true);
      app.synthController = controller('synth', true);
      press('Escape');
      expect(log).toEqual(expected);
    });

    test('revient au menu uniquement hors du menu et sans preventDefault', () => {
      app.elements.memoOverlay.classList.remove('visible');
      app.currentView = 'exercise';
      press('Escape');
      app.currentView = 'menu';
      press('Escape');
      expect(log).toEqual(['showView:menu']);
    });

    test('Échap agit même depuis un champ de saisie ou avec des modificateurs', () => {
      app.elements.memoOverlay.classList.remove('visible');
      app.currentView = 'settings';
      press('Escape', { target: document.getElementById('champ'), ctrlKey: true, altKey: true });
      expect(log).toEqual(['showView:menu']);
    });

    test('un événement déjà consommé est ignoré, même pour Échap', () => {
      document.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true });
      app.currentView = 'progress';
      press('Escape');
      expect(log).toEqual(['preventDefault']);
      expect(app.showView).not.toHaveBeenCalled();
    });
  });

  describe('Focus et saisie', () => {
    test.each(['champ', 'choix', 'zone', 'dans-editable'])('ignore les chiffres dans #%s', (id) => {
      runningExercise();
      app.pianoController = pianoFixture();
      press('1', { target: document.getElementById(id) });
      press('q', { target: document.getElementById(id) });
      expect(log).toEqual([]);
    });
  });

  describe('Piano virtuel', () => {
    beforeEach(() => { app.pianoController = pianoFixture(); });

    test('joue la touche mappée en minuscule après preventDefault, sans répétition', () => {
      press('Q');
      press('s', { repeat: true });
      expect(log).toEqual(['preventDefault', 'piano.down:q']);
    });

    test('une touche non mappée tombe sur les autres raccourcis', () => {
      runningExercise();
      press('3');
      expect(log).toEqual(['submit:2']);
    });

    test('le piano a priorité sur le tap rythmique et sur les chiffres', () => {
      app.rhythmController = rhythmFixture();
      app.pianoController.keyMap[' '] = 'C5';
      app.pianoController.keyMap['1'] = 'C6';
      runningExercise();
      press(' ');
      press('1');
      expect(log).toEqual(['preventDefault', 'piano.down: ', 'preventDefault', 'piano.down:1']);
    });

    test('un piano masqué laisse passer les raccourcis', () => {
      app.pianoController.isVisible = () => false;
      runningExercise();
      press('q');
      press('2');
      expect(log).toEqual(['submit:1']);
    });

    test('keyup relâche uniquement les touches mappées du piano visible', () => {
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Q', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', bubbles: true }));
      app.pianoController.isVisible = () => false;
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 's', bubbles: true }));
      expect(log).toEqual(['piano.up:q']);
    });
  });

  describe('Mode rythme', () => {
    beforeEach(() => { app.rhythmController = rhythmFixture(); });

    test('Espace appelle preventDefault avant le contrôleur rythmique', () => {
      press(' ');
      expect(log).toEqual(['preventDefault', 'rhythm: :true']);
    });

    test.each(['bouton', 'dans-bouton', 'lien'])('Espace sur #%s garde l’activation native', (id) => {
      press(' ', { target: document.getElementById(id) });
      expect(log).toEqual([]);
    });

    test('sans état rythmique, Espace est ignoré', () => {
      app.rhythmController.state = null;
      press(' ');
      expect(log).toEqual([]);
    });

    test('Espace n’est pas un chiffre : aucune réponse même en exercice', () => {
      runningExercise('rhythm');
      press(' ');
      expect(log).toEqual(['preventDefault', 'rhythm: :true']);
    });

    test('les chiffres ne répondent pas à un exercice de rythme', () => {
      runningExercise('rhythm');
      press('4');
      expect(log).toEqual([]);
    });
  });

  describe('Touches 1 à 7', () => {
    test.each([['1', 0], ['4', 3], ['7', 6]])('la touche %s répond %i en exercice actif', (key, answer) => {
      runningExercise();
      press(key);
      expect(log).toEqual([`submit:${answer}`]);
    });

    test.each(['0', '8', '9', 'a', 'Enter', '-'])('la touche %s est hors bornes', (key) => {
      runningExercise();
      press(key);
      expect(log).toEqual([]);
    });

    test('ne répond pas hors vue exercice, moteur absent ou arrêté', () => {
      runningExercise();
      app.currentView = 'menu';
      press('1');
      app.currentView = 'exercise';
      app.engine = { isRunning: () => false };
      press('1');
      app.engine = null;
      press('1');
      expect(log).toEqual([]);
    });

    test('un exercice sans mode répond comme un exercice standard', () => {
      runningExercise();
      app.currentExercise = null;
      press('2');
      expect(log).toEqual(['submit:1']);
    });

    test('ne filtre pas les modificateurs, comme avant (comportement conservé)', () => {
      runningExercise();
      press('5', { ctrlKey: true });
      press('6', { altKey: true });
      press('7', { metaKey: true });
      expect(log).toEqual(['submit:4', 'submit:5', 'submit:6']);
    });

    test('un mode d’entraînement sans rythme répond aux chiffres', () => {
      runningExercise('training');
      press('3');
      expect(log).toEqual(['submit:2']);
    });
  });

  test('sans contrôleur ni moteur, aucune touche ne lève d’erreur', () => {
    expect(() => ['Escape', ' ', 'q', '1'].forEach((key) => press(key))).not.toThrow();
  });
});
