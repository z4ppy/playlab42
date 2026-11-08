/**
 * Tests du permalien : sérialisation de l'état dans le fragment d'URL.
 */

import { decodeState, DEFAULT_STATE, encodeState, MAX_CELLS_LENGTH } from '../src/hash-state.js';

describe('permalien', () => {
  it('aller-retour d’un état 2D complet', () => {
    const state = {
      ...DEFAULT_STATE,
      mode: '2d',
      life: 'B36/S23',
      size: 64,
      speed: 3,
      trace: false,
      cells: '2$b3o3$5bo!',
    };
    const hash = encodeState(state);
    expect(decodeState(`#${hash}`)).toEqual({ state, warnings: [] });
  });

  it('aller-retour d’un état 1D avec ligne de départ', () => {
    const state = { ...DEFAULT_STATE, mode: '1d', rule: 110, width: 65, row: '10bo5b3o!' };
    expect(decodeState(encodeState(state))).toEqual({ state, warnings: [] });
  });

  it('garde les caractères RLE et B/S lisibles dans l’URL', () => {
    const hash = encodeState({ ...DEFAULT_STATE, cells: 'bo$2bo$3o!' });
    expect(hash).toContain('r=B3/S23');
    expect(hash).toContain('c=bo$2bo$3o!');
  });

  it('omet une grille trop longue pour un lien', () => {
    const cells = `${'bo'.repeat(MAX_CELLS_LENGTH)}!`;
    const hash = encodeState({ ...DEFAULT_STATE, size: 256, cells });
    expect(hash).not.toContain('c=');
    expect(decodeState(hash).state.cells).toBeNull();
  });

  it('un fragment vide donne l’état par défaut', () => {
    expect(decodeState('')).toEqual({ state: { ...DEFAULT_STATE }, warnings: [] });
    expect(decodeState('#')).toEqual({ state: { ...DEFAULT_STATE }, warnings: [] });
  });

  it('normalise la règle 2D en notation canonique', () => {
    expect(decodeState('#r=b63s32').state.life).toBe('B36/S23');
  });

  it('remplace chaque valeur invalide par le défaut et le signale', () => {
    const { state, warnings } = decodeState('#m=3d&e=300&r=B9/S1&n=100&w=abc&v=99&c=3x!&i=%E0');
    expect(state).toEqual({ ...DEFAULT_STATE });
    expect(warnings).toEqual([
      'mode invalide',
      'règle 1D invalide',
      'taille invalide',
      'largeur invalide',
      'vitesse invalide',
      'règle 2D invalide',
      'grille invalide',
      'ligne de départ invalide',
    ]);
  });

  it('signale un champ dont l’encodage « % » est invalide', () => {
    expect(decodeState('#c=%').warnings).toEqual(['grille invalide']);
    expect(decodeState('#c=%').state.cells).toBeNull();
    expect(decodeState('#e=%25%').warnings).toEqual(['règle 1D invalide']);
    expect(decodeState('#t=%').warnings).toEqual(['traînée invalide']);
    expect(decodeState('#m=%E0').warnings).toEqual(['mode invalide']);
  });

  it('refuse vite un compteur RLE démesuré (permalien piégé)', () => {
    const started = Date.now();
    const { state, warnings } = decodeState('#m=2d&n=48&c=999999999o!');
    expect(Date.now() - started).toBeLessThan(100);
    expect(state.cells).toBeNull();
    expect(warnings).toEqual(['grille invalide']);
    // Même piège sur la ligne 1D et en décalant par des cellules mortes.
    expect(decodeState('#w=65&i=999999999o!').warnings).toEqual(['ligne de départ invalide']);
    expect(decodeState('#n=48&c=47bo999999999o!').warnings).toEqual(['grille invalide']);
    expect(decodeState('#n=48&c=999999999$o!').warnings).toEqual(['grille invalide']);
  });

  it('refuse une grille plus grande que la taille annoncée', () => {
    const { state, warnings } = decodeState('#n=48&c=60o!');
    expect(state.cells).toBeNull();
    expect(warnings).toEqual(['grille invalide']);
  });

  it('refuse une ligne 1D sur plusieurs lignes', () => {
    const { state, warnings } = decodeState('#w=65&i=o$o!');
    expect(state.row).toBeNull();
    expect(warnings).toEqual(['ligne de départ invalide']);
  });
});
