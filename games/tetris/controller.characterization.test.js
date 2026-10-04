/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { TetrisController } from './controller.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const $ = id => document.getElementById(id);

describe('TetrisController : contrôles et rendu', () => {
  let controller;
  let kit;
  let audio;
  let renderer;
  let frames;

  beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    frames = new Map();
    let sequence = 0;
    window.requestAnimationFrame = jest.fn(callback => { frames.set(++sequence, callback); return sequence; });
    window.cancelAnimationFrame = jest.fn(id => frames.delete(id));
    kit = {
      init: jest.fn(), loadProgress: jest.fn(() => null), saveProgress: jest.fn(() => true),
      saveScore: jest.fn(() => true), isSoundEnabled: jest.fn(() => true), quit: jest.fn(),
    };
    audio = { enabled: false, play: jest.fn(), dispose: jest.fn(), setEnabled: jest.fn(value => { audio.enabled = value; return value; }) };
    renderer = { draw: jest.fn() };
    controller = new TetrisController({ document, window, kit, renderer, audio });
  });
  afterEach(() => controller.dispose());

  function press(code, { target = $('board'), repeat = false, ...modifiers } = {}) {
    const event = new KeyboardEvent('keydown', { code, repeat, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    return event;
  }
  function attached(tag) {
    const element = document.createElement(tag);
    document.body.append(element);
    return element;
  }

  describe('clavier', () => {
    const ACTIONS = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop', ArrowUp: 'rotateCW',
      KeyX: 'rotateCW', KeyZ: 'rotateCCW', KeyC: 'hold', Space: 'hardDrop',
    };

    it('associe chaque touche à son action, empêche le défaut et enregistre la source', () => {
      controller.start(17);
      const spy = jest.spyOn(controller, 'press');
      for (const [code, action] of Object.entries(ACTIONS)) {
        const event = press(code);
        expect(event.defaultPrevented).toBe(true);
        expect(spy).toHaveBeenLastCalledWith(`key:${code}`, action);
      }
      expect(spy).toHaveBeenCalledTimes(8);
    });

    it('ne répète que les déplacements : 150 ms latéral, 35 ms descente douce', () => {
      controller.start(17);
      press('ArrowLeft');
      press('ArrowDown');
      press('KeyZ');
      press('KeyC');
      expect([...controller.held]).toEqual([
        ['key:ArrowLeft', { action: 'left', untilRepeat: 150 }],
        ['key:ArrowDown', { action: 'softDrop', untilRepeat: 35 }],
      ]);
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
      expect([...controller.held.keys()]).toEqual(['key:ArrowLeft']);
    });

    it('la répétition du système bloque le défaut mais n\'applique rien', () => {
      controller.start(17);
      const spy = jest.spyOn(controller, 'press');
      const event = press('ArrowLeft', { repeat: true });
      expect(event.defaultPrevented).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('ignore tout raccourci avec Ctrl, Méta ou Alt mais accepte Maj', () => {
      controller.start(17);
      const spy = jest.spyOn(controller, 'press');
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        expect(press('ArrowLeft', { [modifier]: true }).defaultPrevented).toBe(false);
        expect(press('KeyP', { [modifier]: true }).defaultPrevented).toBe(false);
      }
      expect(spy).not.toHaveBeenCalled();
      expect(controller.running).toBe(true);
      expect(press('ArrowLeft', { shiftKey: true }).defaultPrevented).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('ignore une touche inconnue sans l\'empêcher', () => {
      controller.start(17);
      const event = press('KeyQ');
      expect(event.defaultPrevented).toBe(false);
      expect(controller.held.size).toBe(0);
    });

    it('n\'agit pas tant que la partie n\'est pas lancée ou est en pause', () => {
      const spy = jest.spyOn(controller, 'press');
      expect(press('ArrowLeft').defaultPrevented).toBe(false);
      expect(press('KeyP').defaultPrevented).toBe(false);
      expect(press('Escape').defaultPrevented).toBe(false);
      expect(controller.running).toBe(false);
      controller.start(17);
      controller.pause();
      expect(press('ArrowLeft').defaultPrevented).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('P et Échap basculent pause et reprise, sans basculer sur une répétition système', () => {
      controller.start(17);
      expect(press('KeyP').defaultPrevented).toBe(true);
      expect(controller.running).toBe(false);
      expect(press('Escape', { repeat: true }).defaultPrevented).toBe(true);
      expect(controller.running).toBe(false);
      expect(press('Escape').defaultPrevented).toBe(true);
      expect(controller.running).toBe(true);
      press('Escape');
      expect(controller.running).toBe(false);
      press('KeyP');
      expect(controller.running).toBe(true);
    });

    it('P fonctionne depuis un bouton mais pas depuis un champ de formulaire', () => {
      controller.start(17);
      const button = attached('button');
      expect(press('KeyP', { target: button }).defaultPrevented).toBe(true);
      expect(controller.running).toBe(false);
      for (const tag of ['input', 'select', 'textarea']) {
        const field = attached(tag);
        expect(press('KeyP', { target: field }).defaultPrevented).toBe(false);
        expect(controller.running).toBe(false);
      }
      controller.resume();
      for (const tag of ['input', 'select', 'textarea']) {
        expect(press('Escape', { target: attached(tag) }).defaultPrevented).toBe(false);
        expect(controller.running).toBe(true);
      }
    });

    it('les actions de jeu sont ignorées depuis les contrôles natifs', () => {
      controller.start(17);
      const spy = jest.spyOn(controller, 'press');
      for (const tag of ['input', 'select', 'textarea', 'button', 'a', 'summary']) {
        expect(press('Space', { target: attached(tag) }).defaultPrevented).toBe(false);
      }
      const inside = attached('button');
      inside.append(document.createElement('span'));
      expect(press('ArrowLeft', { target: inside.firstChild }).defaultPrevented).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('accepte les événements dont la cible n\'a pas closest, comme document', () => {
      controller.start(17);
      const spy = jest.spyOn(controller, 'press');
      expect(press('ArrowRight', { target: document }).defaultPrevented).toBe(true);
      expect(spy).toHaveBeenCalledWith('key:ArrowRight', 'right');
      expect(press('KeyP', { target: document }).defaultPrevented).toBe(true);
      expect(controller.running).toBe(false);
    });

    it('une pièce posée qui termine la partie ne laisse aucune répétition active', () => {
      controller.start(17);
      for (let i = 0; i < 100 && controller.running; i++) { press('Space'); }
      expect(controller.running).toBe(false);
      expect(controller.held.size).toBe(0);
    });
  });

  describe('pointeurs, portail et dépendances', () => {
    function pointer(type, id, init = {}) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
      Object.defineProperty(event, 'pointerId', { value: id });
      return event;
    }
    const left = () => document.querySelector('[data-action="left"]');

    it('un appui principal capture le pointeur ; un autre bouton ou une partie arrêtée est ignoré', () => {
      left().setPointerCapture = jest.fn();
      expect(left().dispatchEvent(pointer('pointerdown', 1))).toBe(true);
      expect(controller.held.size).toBe(0);
      controller.start(17);
      expect(left().dispatchEvent(pointer('pointerdown', 2, { button: 2 }))).toBe(true);
      expect(controller.held.size).toBe(0);
      expect(left().dispatchEvent(pointer('pointerdown', 3))).toBe(false);
      expect(left().setPointerCapture).toHaveBeenCalledWith(3);
      expect([...controller.held.keys()]).toEqual(['pointer:3']);
    });

    it('relâche le pointeur sur pointerup et lostpointercapture, avec ou sans capture disponible', () => {
      controller.start(17);
      for (const type of ['pointerup', 'lostpointercapture', 'pointercancel']) {
        left().dispatchEvent(pointer('pointerdown', 4));
        expect(controller.held.has('pointer:4')).toBe(true);
        left().dispatchEvent(pointer(type, 4));
        expect(controller.held.size).toBe(0);
      }
    });

    it('accepte un appui sans propriété button et sans capture de pointeur disponible', () => {
      controller.start(17);
      const event = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'pointerId', { value: 8 });
      expect(left().dispatchEvent(event)).toBe(false);
      expect(controller.held.has('pointer:8')).toBe(true);
    });

    it('un clic sans détail pointeur active l\'action, un vrai clic souris est déjà traité', () => {
      controller.start(17);
      const x = controller.state.active.x;
      left().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      expect(controller.state.active.x).toBe(x);
      left().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      expect(controller.state.active.x).toBe(x - 1);
    });

    it('le bouton quitter ne délègue au portail que dans un iframe', () => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      $('quit').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(kit.quit).not.toHaveBeenCalled();
      const parent = Object.getOwnPropertyDescriptor(window, 'parent');
      Object.defineProperty(window, 'parent', { configurable: true, value: {} });
      try {
        const framed = new MouseEvent('click', { bubbles: true, cancelable: true });
        $('quit').dispatchEvent(framed);
        expect(framed.defaultPrevented).toBe(true);
        expect(kit.quit).toHaveBeenCalledTimes(1);
      } finally {
        if (parent) { Object.defineProperty(window, 'parent', parent); } else { delete window.parent; }
      }
    });

    it('signale une synthèse audio indisponible lors de l\'activation du son', () => {
      audio.setEnabled.mockReturnValue(false);
      audio.enabled = false;
      $('sound').click();
      expect($('storage-notice').textContent).toBe('La synthèse audio est indisponible dans ce navigateur.');
      expect($('storage-notice').hidden).toBe(false);
    });

    it('dessine avec le renderer réel quand aucun n\'est injecté', () => {
      const context = new Proxy({}, { get: () => () => {}, set: () => true });
      const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
      try {
        const real = new TetrisController({ document, window, kit, audio });
        expect(real.renderer.constructor.name).toBe('TetrisRenderer');
        expect(getContext).toHaveBeenCalled();
        real.dispose();
      } finally {
        getContext.mockRestore();
      }
    });

    it('un changement de mode radio réaffiche le record, un autre champ est ignoré', () => {
      const show = jest.spyOn(controller, 'showRecord');
      const sprint = document.querySelector('input[name="mode"][value="sprint"]');
      sprint.checked = true;
      sprint.dispatchEvent(new Event('change', { bubbles: true }));
      expect(show).toHaveBeenCalledWith('sprint');
      show.mockClear();
      $('goal').dispatchEvent(new Event('change', { bubbles: true }));
      expect(show).not.toHaveBeenCalled();
    });

    it('met en pause quand la page devient cachée, pas quand elle est visible', () => {
      const pause = jest.spyOn(controller, 'pause');
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(pause).not.toHaveBeenCalled();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      try {
        document.dispatchEvent(new Event('visibilitychange'));
        expect(pause).toHaveBeenCalledTimes(1);
      } finally {
        delete document.hidden;
      }
    });

    it('fabrique son moteur et son audio par défaut lorsqu\'ils ne sont pas injectés', () => {
      const bare = new TetrisController({ document, window, kit, renderer });
      expect(bare.engine.constructor.name).toBe('TetrisEngine');
      expect(bare.audio.constructor.name).toBe('TetrisAudio');
      bare.dispose();
    });

    it('un élément d\'interface manquant interrompt la construction avec son identifiant', () => {
      $('goal').remove();
      expect(() => new TetrisController({ document, window, kit, renderer, audio })).toThrow('Élément UI manquant : goal');
    });
  });
});

describe('TetrisController.act et render avec moteur simulé', () => {
  let controller;
  let audio;
  let renderer;
  let engine;
  let kit;

  const base = () => ({
    mode: 'marathon', board: [], hold: null, queue: [], score: 0, lines: 0, level: 1, elapsed: 0,
    gameOver: false, canHold: true, active: { type: 'T', x: 3, y: 0, rotation: 0 },
    piecesPlaced: 0, combo: -1, lastClear: { lines: 0, label: 'None', points: 0 },
  });

  beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    window.requestAnimationFrame = jest.fn(() => 1);
    window.cancelAnimationFrame = jest.fn();
    kit = {
      init: jest.fn(), loadProgress: jest.fn(() => null), saveProgress: jest.fn(() => true),
      saveScore: jest.fn(() => true), isSoundEnabled: jest.fn(() => true), quit: jest.fn(),
    };
    audio = { enabled: true, play: jest.fn(), dispose: jest.fn(), setEnabled: jest.fn() };
    renderer = { draw: jest.fn() };
    engine = {
      init: jest.fn(() => base()),
      isValidAction: jest.fn(() => true),
      applyAction: jest.fn((state, action) => ({ ...state, applied: action })),
    };
    controller = new TetrisController({ document, window, kit, engine, renderer, audio });
    controller.running = true;
    controller.started = true;
    renderer.draw.mockClear();
  });
  afterEach(() => controller.dispose());

  const applyNext = patch => engine.applyAction.mockImplementation(state => ({ ...state, ...patch }));
  const played = () => audio.play.mock.calls.map(([name]) => name);

  describe('act', () => {
    it('ne fait rien hors partie active', () => {
      controller.running = false;
      controller.act('left');
      expect(engine.isValidAction).not.toHaveBeenCalled();
    });

    it('refuse sans effet une action invalide pour le joueur humain', () => {
      engine.isValidAction.mockReturnValue(false);
      controller.act('hold');
      expect(engine.isValidAction).toHaveBeenCalledWith(expect.anything(), { type: 'hold' }, 'human');
      expect(engine.applyAction).not.toHaveBeenCalled();
      expect(renderer.draw).not.toHaveBeenCalled();
      expect(played()).toEqual([]);
    });

    it('un tick transmet son delta, reste muet et ne redessine pas', () => {
      applyNext({ elapsed: 8 });
      controller.act('tick', 8.5);
      expect(engine.applyAction).toHaveBeenCalledWith(expect.anything(), { type: 'tick', delta: 8.5 }, 'human');
      expect(controller.state.elapsed).toBe(8);
      expect(renderer.draw).not.toHaveBeenCalled();
      expect(played()).toEqual([]);
    });

    it.each([
      ['hardDrop', {}, ['drop']],
      ['hold', {}, ['hold']],
      ['left', { active: { type: 'T', x: 2, y: 0, rotation: 0 } }, ['move']],
      ['right', { active: { type: 'T', x: 4, y: 0, rotation: 0 } }, ['move']],
      ['softDrop', { active: { type: 'T', x: 3, y: 1, rotation: 0 } }, ['move']],
      ['rotateCW', { active: { type: 'T', x: 3, y: 0, rotation: 1 } }, ['rotate']],
      ['rotateCCW', { active: { type: 'T', x: 3, y: 0, rotation: 3 } }, ['rotate']],
      ['left', {}, []],
      ['rotateCW', {}, []],
      ['softDrop', {}, []],
    ])('%s produit le son attendu et un rendu', (type, patch, sounds) => {
      applyNext(patch);
      controller.act(type);
      expect(played()).toEqual(sounds);
      expect(renderer.draw).toHaveBeenCalledTimes(1);
    });

    it('compare la pièce active par valeur et non par référence', () => {
      applyNext({ active: { ...base().active } });
      controller.act('left');
      expect(played()).toEqual([]);
    });

    it('annonce un clear avec son libellé français, ses points et le combo à partir de 1', () => {
      applyNext({ piecesPlaced: 1, combo: 2, lastClear: { lines: 2, label: 'Double', points: 300 } });
      controller.act('hardDrop');
      expect($('announcement').textContent).toBe('Double · +300 points · Combo 2');
      expect(played()).toEqual(['drop', 'clear']);
      expect($('clear-effect').classList.contains('flash')).toBe(true);
    });

    it('n\'annonce pas de combo à zéro et relance l\'animation à chaque clear', () => {
      applyNext({ piecesPlaced: 1, combo: 0, lastClear: { lines: 4, label: 'Tetris', points: 800 } });
      controller.act('hardDrop');
      expect($('announcement').textContent).toBe('Quatre lignes · +800 points');
      $('clear-effect').classList.remove('flash');
      applyNext({ piecesPlaced: 2, combo: 0, lastClear: { lines: 1, label: 'Single', points: 100 } });
      controller.act('hardDrop');
      expect($('announcement').textContent).toBe('Ligne simple · +100 points');
      expect($('clear-effect').classList.contains('flash')).toBe(true);
    });

    it('ne réannonce pas un ancien clear sans nouvelle pièce posée ni sans points', () => {
      const before = $('announcement').textContent;
      controller.state = { ...controller.state, lastClear: { lines: 1, label: 'Single', points: 100 } };
      applyNext({});
      controller.act('left');
      expect($('announcement').textContent).toBe(before);
      applyNext({ piecesPlaced: 1, lastClear: { lines: 0, label: 'None', points: 0 } });
      controller.act('hardDrop');
      expect($('announcement').textContent).toBe(before);
      applyNext({ piecesPlaced: 2, lastClear: undefined });
      controller.act('hardDrop');
      expect($('announcement').textContent).toBe(before);
      expect(played()).toEqual(['drop', 'drop']);
    });

    it('une fin de partie sur un tick présente le bilan sans redessiner deux fois', () => {
      applyNext({ gameOver: true, mode: 'ultra', elapsed: 120000, score: 4200 });
      controller.act('tick', 8);
      expect(controller.running).toBe(false);
      expect($('overlay').hidden).toBe(false);
      expect(played()).toEqual(['end']);
      expect(renderer.draw).toHaveBeenCalledTimes(1);
      expect(kit.saveScore).toHaveBeenCalledWith(4200);
    });

    it('une fin de partie sur une action redessine une fois après le bilan', () => {
      applyNext({ gameOver: true });
      controller.act('hardDrop');
      expect(played()).toEqual(['drop', 'end']);
      expect(renderer.draw).toHaveBeenCalledTimes(2);
    });
  });

  describe('render', () => {
    function show(patch, { running = true, started = true } = {}) {
      controller.state = { ...base(), ...patch };
      controller.running = running;
      controller.started = started;
      controller.render();
    }
    const progress = () => ({
      max: $('progress').getAttribute('aria-valuemax'), now: $('progress').getAttribute('aria-valuenow'),
      text: $('progress').getAttribute('aria-valuetext'), width: $('progress-fill').style.width, goal: $('goal').textContent,
    });

    it('formate score, lignes, niveau et nom du mode', () => {
      show({ score: 42, lines: 5, level: 3 });
      expect([$('score').textContent, $('lines').textContent, $('level').textContent, $('mode-label').textContent])
        .toEqual(['000042', '05', '03', 'MARATHON']);
      expect(renderer.draw).toHaveBeenCalledWith(controller.state);
    });

    it('Marathon : progression sur dix lignes, repartant de zéro à chaque niveau', () => {
      show({ lines: 7 });
      expect(progress()).toEqual({ max: '10', now: '7', text: '3 lignes avant le niveau suivant', width: '70%', goal: '3 lignes avant le niveau suivant' });
      show({ lines: 10 });
      expect(progress()).toEqual({ max: '10', now: '0', text: '10 lignes avant le niveau suivant', width: '0%', goal: '10 lignes avant le niveau suivant' });
      show({ lines: 23 });
      expect(progress().now).toBe('3');
    });

    it('Sprint : compte à rebours des 40 lignes sans valeur négative ni dépassement', () => {
      show({ mode: 'sprint', lines: 12, elapsed: 65432 });
      expect(progress()).toEqual({ max: '40', now: '12', text: '28 lignes à compléter', width: '30%', goal: '28 lignes à compléter' });
      expect($('time').textContent).toBe('01:05.43');
      expect($('mode-label').textContent).toBe('SPRINT');
      show({ mode: 'sprint', lines: 45 });
      expect(progress()).toEqual({ max: '40', now: '40', text: '0 lignes à compléter', width: '100%', goal: '0 lignes à compléter' });
    });

    it('Ultra : chronomètre décroissant plafonné à 120 secondes', () => {
      show({ mode: 'ultra', elapsed: 30000 });
      expect(progress()).toEqual({ max: '120000', now: '30000', text: '120 secondes. Chaque point compte.', width: '25%', goal: '120 secondes. Chaque point compte.' });
      expect($('time').textContent).toBe('01:30.00');
      show({ mode: 'ultra', elapsed: 130000 });
      expect(progress().now).toBe('120000');
      expect(progress().width).toBe('100%');
      expect($('time').textContent).toBe('00:00.00');
    });

    it('décrit l\'état de jeu : terminé, en cours, en pause, prêt', () => {
      const states = [
        [{ gameOver: true }, { running: false, started: true }, 'TERMINÉ'],
        [{ gameOver: true }, { running: true, started: true }, 'TERMINÉ'],
        [{}, { running: true, started: true }, 'DANS LE FLOW'],
        [{}, { running: false, started: true }, 'EN PAUSE'],
        [{}, { running: false, started: false }, 'PRÊT À JOUER'],
      ];
      for (const [patch, flags, label] of states) {
        show(patch, flags);
        expect($('play-state').textContent).toBe(label);
      }
    });

    it('annonce la disponibilité de la réserve', () => {
      show({ canHold: true });
      expect($('hold-status').textContent).toBe('Une seconde chance.');
      show({ canHold: false });
      expect($('hold-status').textContent).toBe('Disponible après la pose.');
    });

    it('désactive les boutons tactiles hors partie et la réserve quand elle est indisponible', () => {
      const buttons = Object.fromEntries([...document.querySelectorAll('[data-action]')].map(button => [button.dataset.action, button]));
      show({ canHold: true }, { running: true });
      expect(Object.values(buttons).every(button => !button.disabled)).toBe(true);
      show({ canHold: false }, { running: true });
      expect(Object.entries(buttons).filter(([, button]) => button.disabled).map(([action]) => action)).toEqual(['hold']);
      show({ canHold: true }, { running: false });
      expect(Object.values(buttons).every(button => button.disabled)).toBe(true);
    });

    it('affiche le record du mode joué en partie et celui du mode sélectionné dans le menu', () => {
      controller.records.data = { version: 1, marathon: 12345, sprint: 61230, ultra: null };
      document.querySelector('[value="sprint"]').checked = true;
      $('overlay').hidden = true;
      show({ mode: 'marathon' });
      expect([$('record').textContent, $('record-mode').textContent]).toEqual([(12345).toLocaleString('fr-FR'), 'Marathon · meilleur score']);
      $('overlay').hidden = false;
      controller.render();
      expect([$('record').textContent, $('record-mode').textContent]).toEqual(['01:01.23', 'Sprint · meilleur temps']);
      document.querySelector('[value="ultra"]').checked = true;
      controller.render();
      expect([$('record').textContent, $('record-mode').textContent]).toEqual(['—', 'Ultra · meilleur score']);
    });

    it('ne réécrit pas un texte inchangé afin de ne pas réannoncer les régions live', () => {
      show({ score: 10, lines: 1 });
      const observer = new MutationObserver(() => {});
      for (const id of ['score', 'goal', 'play-state', 'hold-status']) { observer.observe($(id), { childList: true, characterData: true, subtree: true }); }
      controller.render();
      expect(observer.takeRecords()).toHaveLength(0);
      show({ score: 11, lines: 1 });
      expect(observer.takeRecords()).toHaveLength(1);
      observer.disconnect();
    });
  });
});
