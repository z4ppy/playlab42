/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { MotorPanel } from '../ui/MotorPanel.js';
import { HUD } from '../ui/HUD.js';
import { makeDraggable } from '../ui/DraggablePanel.js';

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  localStorage.clear();
});

describe('Relativity Lab : commandes du moteur', () => {
  let panel;
  let thrust;
  let windowListeners;
  let documentListeners;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="motor-panel"></div>';
    windowListeners = jest.spyOn(window, 'addEventListener');
    documentListeners = jest.spyOn(document, 'addEventListener');
    thrust = jest.fn();
    panel = new MotorPanel(document.getElementById('motor-panel'), thrust);
  });

  afterEach(() => {
    panel.dispose();
    for (const args of windowListeners.mock.calls.filter(([type]) => type === 'blur')) {
      window.removeEventListener(...args);
    }
    for (const args of documentListeners.mock.calls.filter(([type]) => type === 'visibilitychange')) {
      document.removeEventListener(...args);
    }
  });

  test('associe chaque curseur à son label et transmet une impulsion inchangée', () => {
    for (const input of document.querySelectorAll('input')) {
      expect(input.labels).toHaveLength(1);
    }
    document.getElementById('motor-fire').click();
    expect(thrust).toHaveBeenCalledTimes(1);
    expect(thrust.mock.calls[0][0].x).toBe(1);
    expect(thrust.mock.calls[0][1]).toBe(10);
    expect(document.getElementById('motor-status').textContent).toBe('Impulsion !');
  });

  test.each([' ', 'Enter'])('maintient une poussée avec %s et l’arrête au relâchement', (key) => {
    const forward = document.getElementById('motor-forward');
    forward.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(panel.isBurning).toBe(true);
    expect(forward.getAttribute('aria-pressed')).toBe('true');
    expect(panel.getContinuousThrust().direction.x).toBe(1);
    forward.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
    expect(panel.getContinuousThrust()).toBeNull();
    expect(forward.getAttribute('aria-pressed')).toBe('false');
  });

  test('arrête le freinage quand le focus ou le contact tactile est perdu', () => {
    const backward = document.getElementById('motor-backward');
    backward.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(panel.getContinuousThrust().direction.x).toBe(-1);
    backward.dispatchEvent(new Event('blur'));
    expect(panel.isBurning).toBe(false);
    backward.dispatchEvent(new MouseEvent('pointerdown', { button: 0, cancelable: true }));
    expect(panel.isBurning).toBe(true);
    backward.dispatchEvent(new Event('pointercancel'));
    expect(panel.isBurning).toBe(false);
  });

  test.each([' ', 'Enter'])('arrête la poussée sur window.blur sans attendre le relâchement de %s', (key) => {
    const forward = document.getElementById('motor-forward');
    forward.focus();
    forward.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(panel.isBurning).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(document.activeElement).toBe(forward);
    expect(panel.isBurning).toBe(false);
    expect(panel.burnDirection).toBeNull();
    expect(panel.getContinuousThrust()).toBeNull();
    expect(forward.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('motor-backward').getAttribute('aria-pressed')).toBe('false');
    window.dispatchEvent(new Event('focus'));
    expect(panel.getContinuousThrust()).toBeNull();
  });

  test('arrête le freinage quand la page devient cachée et ne le reprend pas au retour', () => {
    const backward = document.getElementById('motor-backward');
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    backward.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(panel.isBurning).toBe(true);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(panel.isBurning).toBe(false);
    expect(panel.burnDirection).toBeNull();
    expect(panel.getContinuousThrust()).toBeNull();
    expect(backward.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('motor-forward').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('motor-status').textContent).toBe('Prêt');
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(panel.getContinuousThrust()).toBeNull();
  });

  test('le débit continu dépend du temps lab et non de la cadence des frames', () => {
    document.getElementById('motor-forward').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(panel.getContinuousThrust(1 / 30).deltaMass).toBeCloseTo(10 / 30);
    expect(panel.getContinuousThrust(1 / 144).deltaMass).toBeCloseTo(10 / 144);
    panel.config.impulseAmount = 1;
    expect(panel.getContinuousThrust(1 / 60).deltaMass).toBeCloseTo(1 / 60);
    expect(panel.getContinuousThrust(NaN)).toBeNull();
  });

  test('ignore le clic secondaire, arrête sur perte de capture et libère les écouteurs', () => {
    const forward = document.getElementById('motor-forward');
    forward.dispatchEvent(new MouseEvent('pointerdown', { button: 2 }));
    expect(panel.isBurning).toBe(false);
    forward.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    expect(panel.isBurning).toBe(true);
    forward.dispatchEvent(new Event('lostpointercapture'));
    expect(panel.isBurning).toBe(false);
    panel.dispose();
    forward.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    document.getElementById('motor-fire').click();
    expect(panel.isBurning).toBe(false);
    expect(thrust).not.toHaveBeenCalled();
  });

  test('annonce une impulsion refusée au lieu d’un faux succès', () => {
    thrust.mockReturnValue({ success: false });
    document.getElementById('motor-fire').click();
    expect(document.getElementById('motor-status').textContent).toMatch('Impulsion refusée');
  });
});

describe('Relativity Lab : panneaux', () => {
  test('nomme le sélecteur de référentiel et conserve son callback', () => {
    document.body.innerHTML = '<div id="hud"></div>';
    const change = jest.fn();
    new HUD(document.getElementById('hud'), change);
    const select = document.getElementById('hud-ref-select');
    expect(select.labels[0].textContent).toBe('Point de vue');
    select.innerHTML = '<option value="alice">Alice</option>';
    select.dispatchEvent(new Event('change'));
    expect(change).toHaveBeenCalledWith('alice');
  });

  test.each([true, false])('ne déplace les panneaux que dans la disposition immersive (compact=%s)', (compact) => {
    window.matchMedia = jest.fn(() => ({ matches: compact }));
    document.body.innerHTML = '<div id="panel"><div data-drag-handle>Poignée</div></div>';
    const element = document.getElementById('panel');
    const cleanup = makeDraggable(element);
    element.firstElementChild.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 50 }));
    expect(element.style.left).toBe(compact ? '' : '30px');
    expect(element.style.top).toBe(compact ? '' : '40px');
    document.dispatchEvent(new MouseEvent('mouseup'));
    cleanup();
  });

  test('un stockage indisponible ne bloque pas l’initialisation du panneau', () => {
    window.matchMedia = jest.fn(() => ({ matches: false }));
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('indisponible'); });
    document.body.innerHTML = '<div id="panel"><div data-drag-handle>Poignée</div></div>';
    const cleanup = makeDraggable(document.getElementById('panel'), 'position');
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
