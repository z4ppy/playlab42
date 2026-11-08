/**
 * Registre des outils et description de leurs options.
 *
 * Interface commune d'un outil :
 * - id, label, icon, key (raccourci affiché), cursor ('brush'|'crosshair'|'move'|'grab'|'text') ;
 * - options : noms des réglages affichés dans la barre d'options (voir OPTION_DEFS) ;
 * - defaults : valeurs initiales de ces réglages ;
 * - down / move / up (editor, point) et cancel (editor) ; point = coordonnées
 *   document + pressure, pointerType, shift, alt, secondary (bouton droit) ;
 * - pans : vrai si l'outil déplace la vue au lieu de dessiner (main).
 */

import { createBrushTool } from './brush.js';
import { createPencilTool } from './pencil.js';
import { createShapeTool } from './shape.js';
import { createFillTool } from './fill.js';
import { createEyedropperTool, createHandTool, createTextTool } from './simple-tools.js';
import { createMoveTool, createSelectTool } from './selection-tools.js';

/** Crée une instance de chaque outil, dans l'ordre de la barre d'outils. */
export function createTools() {
  return [
    createBrushTool({ id: 'brush', label: 'Pinceau', icon: '🖌️', key: 'B', erase: false }),
    createPencilTool(),
    createBrushTool({ id: 'eraser', label: 'Gomme', icon: '🧽', key: 'E', erase: true }),
    createFillTool(),
    createShapeTool('line'),
    createShapeTool('rect'),
    createShapeTool('ellipse'),
    createSelectTool(),
    createMoveTool(),
    createTextTool(),
    createEyedropperTool(),
    createHandTool(),
  ];
}

/**
 * Réglages possibles. range : curseur ; toggle : case à cocher ; choice : liste.
 * Les valeurs sont stockées par outil (chaque outil garde sa taille).
 */
export const OPTION_DEFS = Object.freeze({
  size: { type: 'range', label: 'Taille', min: 1, max: 300, step: 1, unit: ' px' },
  opacity: { type: 'range', label: 'Opacité', min: 1, max: 100, step: 1, unit: ' %' },
  hardness: { type: 'range', label: 'Dureté', min: 0, max: 100, step: 1, unit: ' %' },
  smoothing: { type: 'range', label: 'Lissage', min: 0, max: 100, step: 1, unit: ' %' },
  tolerance: { type: 'range', label: 'Tolérance', min: 0, max: 255, step: 1, unit: '' },
  fontSize: { type: 'range', label: 'Corps', min: 6, max: 400, step: 1, unit: ' px' },
  // Libellés courts (la barre doit tenir dès la tablette) ; le détail est dans hint.
  pressure: { type: 'toggle', label: 'Pression', hint: 'du stylet' },
  constrain: { type: 'toggle', label: 'Contraindre', hint: 'carré, cercle, 45°, comme Maj' },
  fromCenter: { type: 'toggle', label: 'Du centre', hint: 'tracer depuis le centre, comme Alt' },
  sampleAll: { type: 'toggle', label: 'Tous les calques' },
  bold: { type: 'toggle', label: 'Gras' },
  fillMode: {
    type: 'choice',
    label: 'Style',
    choices: [['stroke', 'Contour'], ['fill', 'Rempli'], ['both', 'Contour + fond']],
  },
  fontFamily: {
    type: 'choice',
    label: 'Police',
    choices: [['sans-serif', 'Sans empattement'], ['serif', 'Avec empattement'], ['monospace', 'Chasse fixe'], ['cursive', 'Manuscrite']],
  },
  selectionActions: { type: 'actions', label: 'Sélection' },
});

/**
 * Borne et convertit une valeur de réglage selon sa définition (valeur par défaut si invalide).
 * @param {string} name
 * @param {unknown} value
 * @param {unknown} fallback
 */
export function sanitizeOption(name, value, fallback) {
  const def = OPTION_DEFS[name];
  if (!def) {
    return fallback;
  }
  if (def.type === 'range') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, Math.round(n))) : fallback;
  }
  if (def.type === 'toggle') {
    return typeof value === 'boolean' ? value : fallback;
  }
  if (def.type === 'choice') {
    return def.choices.some(([id]) => id === value) ? value : fallback;
  }
  return fallback;
}
