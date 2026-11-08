/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { GolfController, localDate, parseSeed } from './controller.js';
import { dailySeed } from './engine.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const $ = id => document.getElementById(id);

// jsdom ne gère pas les dialogues modaux : ouverture et fermeture minimales.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
}

describe('Golf orbital : parcours utilisateur', () => {
  let controller;
  let kit;
  let sound;
  let renderer;
  let frames;
  let clock;
  let media;

  function create(options = {}) {
    controller = new GolfController({ document, window, kit, renderer, sound, now: () => new Date(2026, 0, 2, 9), ...options });
    return controller;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    frames = [];
    clock = 0;
    media = {};
    window.matchMedia = jest.fn(query => ({ matches: Boolean(media[query]) }));
    window.requestAnimationFrame = jest.fn(callback => frames.push(callback));
    window.cancelAnimationFrame = jest.fn();
    kit = {
      init: jest.fn(), loadProgress: jest.fn(() => null), saveProgress: jest.fn(() => true),
      isSoundEnabled: jest.fn(() => true), quit: jest.fn(),
    };
    sound = {
      enabled: false, play: jest.fn(), dispose: jest.fn(),
      setEnabled: jest.fn(value => { sound.enabled = value; return value; }),
    };
    renderer = { draw: jest.fn(), resize: jest.fn(() => true), refreshPalette: jest.fn() };
    create();
  });

  afterEach(() => {
    controller.dispose();
    jest.useRealTimers();
    delete window.matchMedia;
  });

  /** Exécute les frames planifiées jusqu'à la fin de l'animation (16 ms chacune). */
  function animate(limit = 5000) {
    for (let count = 0; count < limit && frames.length > 0; count++) {
      clock += 16;
      frames.shift()(clock);
    }
  }

  /** Génération d'un trou : l'image du bandeau est peinte, puis le calcul suit. */
  function generate() {
    animate();
    jest.runOnlyPendingTimers();
  }

  function key(name, { target = $('field'), shift = false } = {}) {
    const event = new KeyboardEvent('keydown', { key: name, shiftKey: shift, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  function pointer(type, x, y) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: 7 });
    $('field').dispatchEvent(event);
  }

  function startCourse() {
    $('btn-start').click();
    jest.runOnlyPendingTimers();
  }

  /** Visée directe, sans passer par le glissé. */
  function aimAt(angle, power) {
    controller.setAim({ angle, power }, false);
  }

  function play(angle, power) {
    aimAt(angle, power);
    $('btn-shoot').click();
    animate();
  }

  test('affiche le menu, initialise GameKit et laisse les records vides', () => {
    expect(kit.init).toHaveBeenCalledWith('orbital-golf');
    expect($('panel-menu').hidden).toBe(false);
    expect($('app').dataset.phase).toBe('menu');
    expect($('confirm-shot').checked).toBe(false);
    expect([...$('records').querySelectorAll('dd')].map(item => item.textContent)).toEqual(['—', '—', '—']);
    expect(renderer.draw).toHaveBeenCalled();
  });

  test('crée par défaut son rendu Canvas et son audio, et prévient si les records sont illisibles', () => {
    controller.dispose();
    const context = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    kit.loadProgress.mockReturnValue({ version: 99 });
    controller = new GolfController({ document, window, kit });
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(controller.sound.enabled).toBe(false);
    expect($('storage-notice').hidden).toBe(false);
    expect($('storage-notice').textContent).toContain('conservés tels quels');
    window.onGameDispose();
    expect(controller.disposed).toBe(true);
    getContext.mockRestore();
  });

  test('refuse une page incomplète avec un message explicite', () => {
    controller.dispose();
    $('btn-shoot').remove();
    expect(() => create()).toThrow('Golf orbital : l’élément #btn-shoot est absent de la page.');
    document.documentElement.innerHTML = html.replace(/<!doctype html>/i, '');
    create();
  });

  test('démarre l’initiation : bandeau, description du terrain et focus', () => {
    startCourse();
    expect(controller.phase).toBe('aiming');
    expect($('hud-hole').textContent).toBe('Trou 1/9');
    expect($('hud-par').textContent).toBe('Par 2');
    expect($('readout').textContent).toBe('Angle 0,0° · 40 %');
    expect($('field').getAttribute('aria-label')).toBe('Premier putt : balle dans le vide, trou à 700 unités, direction 0,0°. 0 corps céleste.');
    expect(document.activeElement).toBe($('field'));
    expect($('btn-restart').disabled).toBe(true);
    expect($('btn-pause').disabled).toBe(false);
  });

  test('vise au clavier, tire, anime le vol puis présente le bilan du trou', () => {
    startCourse();
    for (let count = 0; count < 26; count++) { key('ArrowUp'); }
    key('ArrowRight');
    key('ArrowLeft');
    expect($('status').textContent).toBe('Angle 0,0° · 66 %');
    key('Enter');
    expect(controller.phase).toBe('flying');
    expect(sound.play).toHaveBeenCalledWith('shoot');
    animate(1);
    expect(renderer.draw.mock.calls.at(-1)[0].aim).toBeUndefined();
    animate();
    expect(controller.phase).toBe('holed');
    expect($('result-title').textContent).toBe('Trou en un');
    expect($('result-detail').textContent).toBe('1 coup · par 2 · total −1');
    expect(document.activeElement).toBe($('btn-next'));
    expect(sound.play).toHaveBeenCalledWith('holed');
    expect(controller.burst.alive).toBe(false);
    $('btn-next').click();
    jest.runOnlyPendingTimers();
    expect($('hud-hole').textContent).toBe('Trou 2/9');
    expect($('card').querySelectorAll('tr')[2].textContent).toBe('Coups1––––––––');
  });

  test('balle perdue : message bref, coup compté, puis recommencer sur confirmation', () => {
    startCourse();
    play(1800, 100);
    expect(controller.phase).toBe('aiming');
    expect($('toast').hidden).toBe(false);
    expect($('toast').textContent).toContain('Hors limites');
    jest.advanceTimersByTime(1200);
    expect($('toast').hidden).toBe(true);
    expect($('hud-strokes').textContent).toBe('Coups 1');
    expect($('btn-restart').disabled).toBe(false);
    key('r');
    expect($('restart-dialog').open).toBe(true);
    $('btn-restart-cancel').click();
    expect($('restart-dialog').open).toBe(false);
    $('btn-restart').click();
    $('btn-restart-confirm').click();
    expect(controller.state.restarts).toBe(1);
    expect($('hud-strokes').textContent).toBe('Coups 0');
    key('R');
    expect($('restart-dialog').open).toBe(false);
    expect($('status').textContent).toBe('Aucun coup à effacer sur ce trou.');
  });

  test('ramasse le trou au huitième coup manqué', () => {
    startCourse();
    for (let count = 0; count < 8; count++) { play(1800, 100); }
    expect($('result-title').textContent).toBe('Ramassé');
    expect(controller.state.strokes[0]).toBe(9);
  });

  test('la pause fige le vol ; la reprise est volontaire', () => {
    startCourse();
    aimAt(0, 66);
    key(' ');
    animate(3);
    const index = controller.flight.index;
    key('p');
    expect($('panel-pause').hidden).toBe(false);
    expect($('app').dataset.phase).toBe('paused');
    expect(document.activeElement).toBe($('btn-resume'));
    animate(50);
    expect(controller.flight.index).toBe(index);
    window.onGameResume();
    expect(controller.paused).toBe(true);
    key('P', { target: $('btn-resume') });
    expect(controller.paused).toBe(false);
    animate();
    expect(controller.phase).toBe('holed');
  });

  test('perte de focus, onglet masqué et portail mettent en pause', () => {
    startCourse();
    window.dispatchEvent(new Event('blur'));
    expect(controller.paused).toBe(true);
    $('btn-resume').click();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.paused).toBe(true);
    delete document.hidden;
    $('btn-resume').click();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.paused).toBe(false);
    window.onGamePause();
    expect(controller.paused).toBe(true);
    controller.pause();
    expect(controller.paused).toBe(true);
  });

  test('pendant un vol, une pression ou Espace accélère l’animation', () => {
    startCourse();
    play(0, 10);
    aimAt(0, 50);
    $('btn-shoot').click();
    expect(controller.flight.speed).toBe(2);
    pointer('pointerdown', 10, 10);
    expect(controller.flight.speed).toBe(4);
    animate();
  });

  test('glisser sur le terrain vise ; relâcher tire, sauf si le tir doit être confirmé', () => {
    startCourse();
    Object.defineProperty($('field'), 'clientWidth', { value: 344, configurable: true });
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 100, 200);
    expect(controller.aim.angle).toBe(0);
    pointer('pointermove', 195, 200);
    expect(controller.aim.angle).toBe(0);
    pointer('pointerup', 100, 200);
    expect(controller.phase).toBe('flying');
    animate();
    $('btn-next').click();
    jest.runOnlyPendingTimers();
    $('confirm-shot').checked = true;
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 260, 260);
    pointer('pointerup', 260, 260);
    expect(controller.phase).toBe('aiming');
    expect(controller.aim.angle).toBe(2250);
    pointer('pointerdown', 200, 200);
    pointer('pointerup', 201, 200);
    expect($('status').textContent).toBe('Tir annulé.');
    pointer('pointerdown', 200, 200);
    key('Escape');
    expect($('status').textContent).toBe('Tir annulé.');
  });

  test('les boutons de réglage fin ajustent angle et puissance', () => {
    startCourse();
    document.querySelector('[data-nudge="angle"][data-step="5"]').click();
    document.querySelector('[data-nudge="power"][data-step="-1"]').click();
    expect(controller.aim).toEqual({ angle: 5, power: 39 });
    expect($('status').textContent).toBe('Angle 0,5° · 39 %');
    controller.pause();
    document.querySelector('[data-nudge="power"][data-step="1"]').click();
    expect(controller.aim.power).toBe(39);
  });

  test('un tir vers l’intérieur d’une planète est refusé et signalé', () => {
    startCourse();
    controller.state = { ...controller.state, holeIndex: 1, ball: { x: 500, y: 452, on: 0 } };
    aimAt(900, 30);
    expect($('readout').textContent).toBe('Angle 90,0° · 30 % · vers la surface');
    $('btn-shoot').click();
    expect(controller.phase).toBe('aiming');
    expect($('status').textContent).toBe('Ce tir partirait dans la planète : vise vers l’extérieur.');
  });

  test('l’indice montre la référence avant le premier coup et retire le droit au record', () => {
    key('h');
    expect($('status').textContent).toContain('avant le premier coup');
    startCourse();
    key('?');
    expect($('help-dialog').open).toBe(true);
    key('ArrowUp');
    expect(controller.aim.power).toBe(40);
    $('btn-hint').click();
    expect($('help-dialog').open).toBe(false);
    expect(controller.aim).toEqual({ angle: 0, power: 66 });
    expect(renderer.draw.mock.calls.at(-1)[0].hint).toEqual({ angle: 0, power: 66 });
    expect(controller.assisted).toBe(true);
    $('btn-help').click();
    $('btn-help-close').click();
    expect($('help-dialog').open).toBe(false);
  });

  test('fin de parcours : carte finale, record enregistré, rejouer et menu', () => {
    startCourse();
    const last = controller.state.course[8];
    controller.state = { ...controller.state, holeIndex: 8, ball: { x: last.hole.x - 20, y: last.hole.y, on: null } };
    play(0, 1);
    expect(controller.phase).toBe('finished');
    expect($('final-title').textContent).toBe('Nouveau record !');
    expect($('final-detail').textContent).toBe('Initiation : 1 coups, −25. Meilleur total : 1 coups.');
    expect($('final-card').querySelectorAll('td')).toHaveLength(27);
    expect(kit.saveProgress).toHaveBeenCalled();
    expect($('btn-pause').disabled).toBe(true);
    expect([...$('records').querySelectorAll('dd')][0].textContent).toBe('1 coups');
    $('btn-final-menu').click();
    expect($('panel-menu').hidden).toBe(false);
    expect($('btn-continue').hidden).toBe(true);
    $('btn-replay').click();
    jest.runOnlyPendingTimers();
    expect(controller.state.holeIndex).toBe(0);
  });

  test('une partie aidée finit sans record', () => {
    startCourse();
    controller.assisted = true;
    const last = controller.state.course[8];
    controller.state = { ...controller.state, holeIndex: 8, ball: { x: last.hole.x - 20, y: last.hole.y, on: null } };
    play(0, 1);
    expect($('final-title').textContent).toBe('Parcours terminé');
    expect($('final-detail').textContent).toContain('Partie aidée ou recommencée : pas de record.');
  });

  test('parcours libre : graine saisie ou tirée puis affichée ; trou suivant généré à la demande', () => {
    document.querySelector('[value="free"]').checked = true;
    $('seed-input').value = ' 12345 ';
    $('btn-start').click();
    expect($('status').textContent).toBe('Préparation du trou…');
    // Non-régression : bandeau visible et calcul repoussé après une image peinte.
    expect($('busy').hidden).toBe(false);
    expect($('busy').textContent).toBe('Préparation du trou…');
    expect($('app').dataset.phase).toBe('loading');
    jest.runOnlyPendingTimers();
    expect(controller.state.mode).toBe('course');
    generate();
    expect($('busy').hidden).toBe(true);
    expect($('app').dataset.phase).toBe('aiming');
    expect(controller.state).toMatchObject({ mode: 'free', seed: 12345 });
    expect($('seed-input').value).toBe('12345');
    controller.state = { ...controller.state, status: 'holed' };
    controller.nextHole();
    expect($('busy').textContent).toBe('Préparation du trou suivant…');
    generate();
    expect(controller.state.course).toHaveLength(2);
    $('seed-input').value = 'abc';
    controller.start('free');
    controller.start('free');
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    generate();
    expect(String(controller.state.seed)).toBe($('seed-input').value);
  }, 20000);

  test('trou du jour : date locale fournie par le client', () => {
    document.querySelector('[value="daily"]').checked = true;
    $('btn-start').click();
    generate();
    expect(controller.state).toMatchObject({ mode: 'daily', date: '2026-01-02', seed: dailySeed('2026-01-02') });
    expect($('hud-hole').textContent).toBe('Trou 1/1');
  }, 20000);

  test('le menu en cours de partie met en pause et permet de continuer, y compris au bilan', () => {
    startCourse();
    $('btn-menu').click();
    expect(controller.paused).toBe(true);
    expect($('btn-continue').hidden).toBe(false);
    $('btn-continue').click();
    expect(controller.paused).toBe(false);
    play(0, 66);
    $('btn-menu').click();
    $('btn-continue').click();
    expect($('panel-result').hidden).toBe(false);
  });

  test('data-phase suit la reprise et le menu ; la boucle s’arrête tant que le vol est figé', () => {
    startCourse();
    key('p');
    key('p');
    expect($('app').dataset.phase).toBe('aiming');
    aimAt(0, 66);
    key('Enter');
    animate(3);
    key('p');
    expect($('app').dataset.phase).toBe('paused');
    animate(1);
    expect(frames).toHaveLength(0);
    $('btn-resume').click();
    expect($('app').dataset.phase).toBe('flying');
    expect(frames).toHaveLength(1);
    $('btn-menu').click();
    expect($('app').dataset.phase).toBe('menu');
    animate(1);
    expect(frames).toHaveLength(0);
    $('btn-continue').click();
    expect($('app').dataset.phase).toBe('flying');
    animate();
    expect(controller.phase).toBe('holed');
  });

  test('un dialogue ouvert pendant le vol fige la boucle ; sa fermeture la relance', () => {
    startCourse();
    aimAt(0, 66);
    key('Enter');
    animate(3);
    $('btn-help').click();
    animate(1);
    expect(frames).toHaveLength(0);
    $('btn-help-close').click();
    $('help-dialog').dispatchEvent(new Event('close'));
    expect(frames).toHaveLength(1);
    animate();
    expect(controller.phase).toBe('holed');
  });

  test('P est ignorée sous un dialogue et ne ferme pas le menu', () => {
    startCourse();
    $('btn-help').click();
    key('p');
    expect(controller.paused).toBe(false);
    expect($('panel-pause').hidden).toBe(true);
    $('btn-help-close').click();
    $('btn-menu').click();
    key('p');
    expect($('panel-menu').hidden).toBe(false);
    expect(controller.paused).toBe(true);
  });

  test('les réglages fins ne sont actifs qu’en visée', () => {
    const nudges = () => [...document.querySelectorAll('[data-nudge]')].map(button => button.disabled);
    expect(nudges()).toEqual([true, true, true, true]);
    startCourse();
    expect(nudges()).toEqual([false, false, false, false]);
    aimAt(0, 66);
    key('Enter');
    expect(nudges()).toEqual([true, true, true, true]);
  });

  test('pagehide vers le cache avant/arrière met en pause sans démonter', () => {
    startCourse();
    const event = new Event('pagehide');
    Object.defineProperty(event, 'persisted', { value: true });
    window.dispatchEvent(event);
    expect(controller.disposed).toBeFalsy();
    expect(controller.paused).toBe(true);
    $('btn-resume').click();
    $('btn-menu').click();
    expect($('panel-menu').hidden).toBe(false);
  });

  test('le son suit le choix du joueur et la préférence du portail', () => {
    $('btn-sound').click();
    expect($('btn-sound').getAttribute('aria-pressed')).toBe('true');
    expect($('btn-sound').getAttribute('aria-label')).toBe('Couper le son');
    window.onSoundChange(true);
    expect(sound.enabled).toBe(true);
    window.onSoundChange(false);
    expect($('btn-sound').getAttribute('aria-pressed')).toBe('false');
    kit.isSoundEnabled.mockReturnValue(false);
    key('s');
    expect(sound.enabled).toBe(false);
  });

  test('les champs de formulaire gardent leurs touches ; Échap et P restent globaux', () => {
    startCourse();
    const radio = document.querySelector('[value="daily"]');
    key('ArrowUp', { target: radio });
    key('Enter', { target: radio });
    expect(controller.aim.power).toBe(40);
    expect(controller.phase).toBe('aiming');
    key('ArrowUp', { shift: true });
    expect(controller.aim.power).toBe(50);
    key('x');
    expect(controller.phase).toBe('aiming');
  });

  test('mouvement réduit et pointeur grossier : vol accéléré, sans traînée ni gerbe ; tir à confirmer', () => {
    controller.dispose();
    media = { '(prefers-reduced-motion: reduce)': true, '(pointer: coarse)': true };
    create();
    expect($('confirm-shot').checked).toBe(true);
    expect($('app').dataset.motion).toBe('reduced');
    startCourse();
    aimAt(0, 66);
    $('btn-shoot').click();
    expect(controller.flight.speed).toBe(4);
    animate(10);
    expect(renderer.draw.mock.calls.at(-1)[0].drift).toEqual({ x: 0, y: 0 });
    animate();
    expect(controller.trail.points).toEqual([]);
    expect(controller.burst.alive).toBe(false);
  });

  test('la gerbe d’arrivée s’anime puis s’éteint', () => {
    startCourse();
    play(0, 66);
    expect(frames).toEqual([]);
    expect(renderer.draw.mock.calls.some(([frame]) => frame.trail.length > 0)).toBe(true);
  });

  test('thème, taille et quitter le portail', () => {
    window.dispatchEvent(new Event('themechange'));
    expect(renderer.refreshPalette).toHaveBeenCalled();
    renderer.resize.mockReturnValue(false);
    const draws = renderer.draw.mock.calls.length;
    window.dispatchEvent(new Event('resize'));
    expect(renderer.draw.mock.calls.length).toBe(draws);
    const standalone = new MouseEvent('click', { bubbles: true, cancelable: true });
    $('quit').dispatchEvent(standalone);
    expect(kit.quit).not.toHaveBeenCalled();
    Object.defineProperty(window, 'parent', { value: {}, configurable: true });
    const framed = new MouseEvent('click', { bubbles: true, cancelable: true });
    $('quit').dispatchEvent(framed);
    expect(framed.defaultPrevented).toBe(true);
    expect(kit.quit).toHaveBeenCalled();
    delete window.parent;
  });

  test('observe la taille du canvas quand ResizeObserver existe', () => {
    controller.dispose();
    const observe = jest.fn();
    const disconnect = jest.fn();
    let notify;
    window.ResizeObserver = class { constructor(callback) { notify = callback; } observe(target) { observe(target); } disconnect() { disconnect(); } };
    create();
    expect(observe).toHaveBeenCalledWith($('field'));
    notify();
    expect(renderer.resize).toHaveBeenCalled();
    controller.dispose();
    expect(disconnect).toHaveBeenCalled();
    delete window.ResizeObserver;
  });

  test('le démontage annule frame et minuteurs, libère l’audio et restaure les points d’accroche', () => {
    controller.dispose();
    window.onGamePause = 'avant';
    create();
    sound.dispose.mockClear();
    startCourse();
    aimAt(1800, 100);
    $('btn-shoot').click();
    window.dispatchEvent(new Event('pagehide'));
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(sound.dispose).toHaveBeenCalledTimes(1);
    expect(window.onGamePause).toBe('avant');
    controller.dispose();
    expect(sound.dispose).toHaveBeenCalledTimes(1);
    $('btn-shoot').click();
    delete window.onGamePause;
  });
});

describe('Outils du client', () => {
  test('date locale sur deux chiffres', () => {
    expect(localDate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05');
  });

  test('graine saisie : entier 32 bits non signé, sinon tirage au hasard', () => {
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed(' 4294967295 ')).toBe(4294967295);
    expect(parseSeed('4294967296')).toBeNull();
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('-3')).toBeNull();
  });
});
