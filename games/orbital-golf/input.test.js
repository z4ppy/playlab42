/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import {
  DEAD_ZONE, PointerAim, aimFromDrag, aimFromKey, aimToward, clampPower, formatAngle, maxPull, nudgeAim,
} from './input.js';

describe('Modèle de visée', () => {
  test('la tension maximale suit 35 % du côté, bornée entre 110 et 220 px', () => {
    expect([maxPull(200), maxPull(344), maxPull(1000)]).toEqual([110, 0.35 * 344, 220]);
  });

  test('le lance-pierre tire à l’opposé du glissé, puissance linéaire après la zone morte', () => {
    expect(aimFromDrag(-(DEAD_ZONE - 1), 0, 120)).toBeNull();
    expect(aimFromDrag(-DEAD_ZONE, 0, 120)).toEqual({ angle: 0, power: 1 });
    expect(aimFromDrag(0, -120, 120)).toEqual({ angle: 900, power: 100 });
    expect(aimFromDrag(400, 0, 120)).toEqual({ angle: 1800, power: 100 });
    expect(aimFromDrag(0, 67, 120)).toEqual({ angle: 2700, power: 51 });
  });

  test('le réglage fin fait le tour du cadran et borne la puissance', () => {
    expect(nudgeAim({ angle: 3598, power: 50 }, 'angle', 5)).toEqual({ angle: 3, power: 50 });
    expect(nudgeAim({ angle: 2, power: 50 }, 'angle', -5)).toEqual({ angle: 3597, power: 50 });
    expect(nudgeAim({ angle: 0, power: 100 }, 'power', 1)).toEqual({ angle: 0, power: 100 });
    expect(nudgeAim({ angle: 0, power: 1 }, 'power', -10)).toEqual({ angle: 0, power: 1 });
    expect([clampPower(0.4), clampPower(55.5), clampPower(140)]).toEqual([1, 56, 100]);
  });

  test.each([
    ['ArrowRight', false, { angle: 110, power: 50 }],
    ['ArrowRight', true, { angle: 101, power: 50 }],
    ['ArrowLeft', false, { angle: 90, power: 50 }],
    ['ArrowLeft', true, { angle: 99, power: 50 }],
    ['ArrowUp', false, { angle: 100, power: 51 }],
    ['ArrowUp', true, { angle: 100, power: 60 }],
    ['ArrowDown', false, { angle: 100, power: 49 }],
    ['ArrowDown', true, { angle: 100, power: 40 }],
  ])('clavier : %s (Maj %s)', (key, shift, expected) => {
    expect(aimFromKey({ angle: 100, power: 50 }, key, shift)).toEqual(expected);
  });

  test('une autre touche ne change pas la visée', () => {
    expect(aimFromKey({ angle: 0, power: 1 }, 'a', false)).toBeNull();
  });

  test('visée initiale vers le trou et format français de l’angle', () => {
    expect(aimToward({ x: 0, y: 0 }, { x: 0, y: -10 })).toEqual({ angle: 2700, power: 40 });
    expect(formatAngle(125)).toBe('12,5°');
  });
});

describe('Capture des pointeurs', () => {
  let canvas;
  let handlers;
  let controller;
  let aim;

  /** jsdom ne fournit pas PointerEvent : un MouseEvent porte l'identifiant du pointeur. */
  function pointer(type, x, y, { id = 1, button = 0 } = {}) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'pointerId', { value: id });
    canvas.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    document.body.innerHTML = '<canvas></canvas>';
    canvas = document.querySelector('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 344 });
    canvas.setPointerCapture = jest.fn();
    controller = new AbortController();
    handlers = { enabled: jest.fn(() => true), onAim: jest.fn(), onRelease: jest.fn(), onCancel: jest.fn() };
    aim = new PointerAim(canvas, handlers, controller.signal);
  });

  afterEach(() => controller.abort());

  test('un glissé suffisant vise puis tire au relâcher', () => {
    const down = pointer('pointerdown', 200, 200);
    expect(down.defaultPrevented).toBe(true);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    expect(aim.active).toBe(true);
    pointer('pointermove', 190, 200);
    expect(handlers.onAim).toHaveBeenLastCalledWith(null);
    pointer('pointermove', 120, 200);
    expect(handlers.onAim).toHaveBeenLastCalledWith({ angle: 0, power: expect.any(Number) });
    pointer('pointerup', 120, 200);
    expect(handlers.onRelease).toHaveBeenCalledWith(expect.objectContaining({ angle: 0 }));
    expect(aim.active).toBe(false);
  });

  test('revenir dans la zone morte annule le tir', () => {
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 100, 200);
    pointer('pointerup', 205, 200);
    expect(handlers.onRelease).not.toHaveBeenCalled();
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  test('pointercancel et perte de capture annulent ; un autre pointeur est ignoré', () => {
    pointer('pointerdown', 200, 200);
    pointer('pointerdown', 10, 10, { id: 2 });
    pointer('pointermove', 100, 100, { id: 2 });
    pointer('pointerup', 100, 100, { id: 2 });
    pointer('pointercancel', 0, 0, { id: 2 });
    expect(handlers.onAim).not.toHaveBeenCalled();
    expect(handlers.onCancel).not.toHaveBeenCalled();
    pointer('pointercancel', 0, 0);
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    pointer('pointerdown', 200, 200);
    pointer('lostpointercapture', 0, 0);
    expect(handlers.onCancel).toHaveBeenCalledTimes(2);
    aim.abort();
    expect(handlers.onCancel).toHaveBeenCalledTimes(2);
  });

  test('ignore le bouton secondaire, un geste désactivé, puis tout après démontage', () => {
    pointer('pointerdown', 200, 200, { button: 2 });
    expect(aim.active).toBe(false);
    handlers.enabled.mockReturnValue(false);
    pointer('pointerdown', 200, 200);
    expect(aim.active).toBe(false);
    handlers.enabled.mockReturnValue(true);
    controller.abort();
    pointer('pointerdown', 200, 200);
    expect(aim.active).toBe(false);
  });

  test('une annulation explicite sans pointeur arrête le geste en cours', () => {
    pointer('pointerdown', 200, 200);
    aim.abort();
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(aim.active).toBe(false);
  });
});
