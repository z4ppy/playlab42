/**
 * Conversions de couleurs TSV / RVB / hexadécimal et couleurs récentes.
 */

import {
  clamp,
  hexToRgb,
  hsvToRgb,
  MAX_RECENT_COLORS,
  normalizeRgba,
  pushRecentColor,
  relativeLuminance,
  rgbToHex,
  rgbToHsv,
  toCss,
} from '../src/core/color.js';

describe('clamp', () => {
  it('borne et ramène NaN au minimum', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(Number.NaN, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe('hsvToRgb', () => {
  it.each([
    [{ h: 0, s: 1, v: 1 }, { r: 255, g: 0, b: 0 }],
    [{ h: 120, s: 1, v: 1 }, { r: 0, g: 255, b: 0 }],
    [{ h: 240, s: 1, v: 1 }, { r: 0, g: 0, b: 255 }],
    [{ h: 60, s: 1, v: 1 }, { r: 255, g: 255, b: 0 }],
    [{ h: 0, s: 0, v: 0.5 }, { r: 128, g: 128, b: 128 }],
    [{ h: 360, s: 1, v: 1 }, { r: 255, g: 0, b: 0 }],
    [{ h: -120, s: 1, v: 1 }, { r: 0, g: 0, b: 255 }],
  ])('convertit %o en %o', (hsv, rgb) => {
    expect(hsvToRgb(hsv)).toEqual(rgb);
  });

  it('borne saturation et valeur', () => {
    expect(hsvToRgb({ h: 0, s: 2, v: 2 })).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe('rgbToHsv', () => {
  it('donne une teinte nulle pour un gris', () => {
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
    expect(rgbToHsv({ r: 200, g: 200, b: 200 })).toMatchObject({ h: 0, s: 0 });
  });

  it.each([
    [{ r: 255, g: 0, b: 0 }, 0],
    [{ r: 255, g: 0, b: 255 }, 300],
    [{ r: 0, g: 255, b: 0 }, 120],
    [{ r: 0, g: 0, b: 255 }, 240],
  ])('calcule la teinte de %o', (rgb, h) => {
    expect(rgbToHsv(rgb).h).toBeCloseTo(h, 6);
  });

  it('fait l\'aller-retour RVB -> TSV -> RVB sur tout un échantillon', () => {
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 51) {
          expect(hsvToRgb(rgbToHsv({ r, g, b }))).toEqual({ r, g, b });
        }
      }
    }
  });
});

describe('hexadécimal', () => {
  it('formate avec ou sans alpha', () => {
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000');
    expect(rgbToHex({ r: 1, g: 2, b: 3, a: 128 })).toBe('#01020380');
    expect(rgbToHex({ r: 300, g: -5, b: 12.4 })).toBe('#ff000c');
  });

  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 255 }],
    ['0f08', { r: 0, g: 255, b: 0, a: 136 }],
    ['#336699', { r: 51, g: 102, b: 153, a: 255 }],
    ['  #33669980 ', { r: 51, g: 102, b: 153, a: 128 }],
    ['#ABCDEF', { r: 171, g: 205, b: 239, a: 255 }],
  ])('lit %s', (text, rgba) => {
    expect(hexToRgb(text)).toEqual(rgba);
  });

  it.each(['', '#12', '#12345', 'zzzzzz', '#1234567', 'rgb(0,0,0)'])('rejette %p', (text) => {
    expect(hexToRgb(text)).toBeNull();
  });

  it('fait l\'aller-retour hex -> RVB -> hex', () => {
    for (const hex of ['#000000', '#ffffff', '#b42349', '#12345678']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    }
  });
});

describe('utilitaires', () => {
  it('normalise et produit une couleur CSS', () => {
    expect(normalizeRgba({ r: 1.4, g: 2.6, b: 3 })).toEqual({ r: 1, g: 3, b: 3, a: 255 });
    expect(toCss({ r: 10, g: 20, b: 30, a: 128 })).toBe('rgba(10, 20, 30, 0.502)');
  });

  it('calcule la luminance relative', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
    expect(relativeLuminance({ r: 0, g: 255, b: 0 })).toBeGreaterThan(relativeLuminance({ r: 0, g: 0, b: 255 }));
  });
});

describe('pushRecentColor', () => {
  it('ajoute en tête sans doublon et normalise', () => {
    expect(pushRecentColor(['#000000', '#ff0000'], '#F00')).toEqual(['#ff0000', '#000000']);
  });

  it('limite la longueur', () => {
    let recent = [];
    for (let i = 0; i < 20; i++) {
      recent = pushRecentColor(recent, `#0000${i.toString(16).padStart(2, '0')}`);
    }
    expect(recent).toHaveLength(MAX_RECENT_COLORS);
    expect(recent[0]).toBe('#000013');
  });

  it('ignore une couleur invalide', () => {
    expect(pushRecentColor(['#000000'], 'n\'importe quoi')).toEqual(['#000000']);
  });
});
