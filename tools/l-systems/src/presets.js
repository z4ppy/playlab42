/**
 * Préréglages célèbres de L-systèmes.
 *
 * Sources : Prusinkiewicz & Lindenmayer, « The Algorithmic Beauty of Plants »
 * (ABOP, 1990), chapitre 1 ; courbes classiques (Koch 1904, Sierpiński 1915,
 * Heighway, Hilbert 1891, Gosper). Les symboles F et G tracent, f et g
 * avancent sans tracer, les autres lettres ne servent qu'à la réécriture.
 */

/**
 * @typedef {object} Preset
 * @property {string} id - Identifiant stable (utilisé dans l'URL)
 * @property {string} name - Nom affiché
 * @property {string} group - Famille (optgroup)
 * @property {string} note - Courte explication pédagogique
 * @property {string} axiom - Axiome
 * @property {{ predecessor: string, successor: string, probability?: number }[]} rules - Règles
 * @property {number} angle - Angle δ (degrés)
 * @property {number} iterations - Itérations par défaut
 * @property {number} heading - Orientation initiale (degrés)
 * @property {number} [step] - Longueur du pas
 * @property {'auto'|'depth'|'gradient'|'solid'} [colorMode] - Coloration
 * @property {number} [lineWidth] - Épaisseur de base (px)
 * @property {number} [widthDecay] - Amincissement par niveau de pile
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'koch-curve',
    name: 'Courbe de Koch',
    group: 'Courbes fractales',
    note: 'Chaque segment est remplacé par quatre segments d’un tiers : la longueur est multipliée par 4/3 à chaque itération.',
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'F+F--F+F' }],
    angle: 60,
    iterations: 5,
    heading: 0,
  },
  {
    id: 'koch-snowflake',
    name: 'Flocon de Koch',
    group: 'Courbes fractales',
    note: 'Trois courbes de Koch sur un triangle : périmètre infini, aire finie.',
    axiom: 'F--F--F',
    rules: [{ predecessor: 'F', successor: 'F+F--F+F' }],
    angle: 60,
    iterations: 4,
    heading: 0,
  },
  {
    id: 'koch-island',
    name: 'Île de Koch quadratique',
    group: 'Courbes fractales',
    note: 'ABOP fig. 1.7b : un carré dont chaque côté devient une ligne brisée de huit segments.',
    axiom: 'F-F-F-F',
    rules: [{ predecessor: 'F', successor: 'F-F+F+FF-F-F+F' }],
    angle: 90,
    iterations: 3,
    heading: 0,
  },
  {
    id: 'sierpinski-triangle',
    name: 'Triangle de Sierpiński',
    group: 'Courbes fractales',
    note: 'G double à chaque étape et F se divise en trois triangles : on retrouve le triangle troué de Sierpiński.',
    axiom: 'F-G-G',
    rules: [
      { predecessor: 'F', successor: 'F-G+F+G-F' },
      { predecessor: 'G', successor: 'GG' },
    ],
    angle: 120,
    iterations: 6,
    heading: 0,
  },
  {
    id: 'sierpinski-arrowhead',
    name: 'Pointe de flèche de Sierpiński',
    group: 'Courbes fractales',
    note: 'Une seule ligne continue qui converge vers le triangle de Sierpiński.',
    axiom: 'XF',
    rules: [
      { predecessor: 'X', successor: 'YF+XF+Y' },
      { predecessor: 'Y', successor: 'XF-YF-X' },
    ],
    angle: 60,
    iterations: 7,
    heading: 0,
  },
  {
    id: 'dragon',
    name: 'Courbe du dragon',
    group: 'Courbes fractales',
    note: 'Courbe de Heighway : le pliage répété d’une bande de papier. Elle ne se recoupe jamais.',
    axiom: 'FX',
    rules: [
      { predecessor: 'X', successor: 'X+YF+' },
      { predecessor: 'Y', successor: '-FX-Y' },
    ],
    angle: 90,
    iterations: 12,
    heading: 0,
  },
  {
    id: 'levy',
    name: 'Courbe C de Lévy',
    group: 'Courbes fractales',
    note: 'Chaque segment devient les deux côtés d’un triangle rectangle isocèle.',
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: '+F--F+' }],
    angle: 45,
    iterations: 12,
    heading: 0,
  },
  {
    id: 'hilbert',
    name: 'Courbe de Hilbert',
    group: 'Courbes fractales',
    note: 'Courbe qui remplit le plan en visitant chaque case d’une grille 2ⁿ × 2ⁿ exactement une fois.',
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: '-YF+XFX+FY-' },
      { predecessor: 'Y', successor: '+XF-YFY-FX+' },
    ],
    angle: 90,
    iterations: 6,
    heading: 0,
  },
  {
    id: 'gosper',
    name: 'Courbe de Gosper',
    group: 'Courbes fractales',
    note: 'ABOP fig. 1.11a : la « flowsnake », pavage hexagonal par une seule courbe.',
    axiom: 'F',
    rules: [
      { predecessor: 'F', successor: 'F-G--G+F++FF+G-' },
      { predecessor: 'G', successor: '+F-GG--G-F++F+G' },
    ],
    angle: 60,
    iterations: 4,
    heading: 0,
  },
  {
    id: 'abop-1-24a',
    name: 'Plante ABOP 1.24a',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'Ramification à crochets : [ mémorise la position, ] y revient. n = 5, δ = 25,7°.',
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'F[+F]F[-F]F' }],
    angle: 25.7,
    iterations: 5,
    heading: 90,
    lineWidth: 3,
  },
  {
    id: 'abop-1-24b',
    name: 'Plante ABOP 1.24b',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'Variante avec un bourgeon terminal [F]. n = 5, δ = 20°.',
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'F[+F]F[-F][F]' }],
    angle: 20,
    iterations: 5,
    heading: 90,
    lineWidth: 3,
  },
  {
    id: 'abop-1-24c',
    name: 'Plante ABOP 1.24c',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'Buisson : deux branches imbriquées par réécriture. n = 4, δ = 22,5°.',
    axiom: 'F',
    rules: [{ predecessor: 'F', successor: 'FF-[-F+F+F]+[+F-F-F]' }],
    angle: 22.5,
    iterations: 4,
    heading: 90,
    lineWidth: 3,
  },
  {
    id: 'abop-1-24d',
    name: 'Plante ABOP 1.24d',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'Le symbole X (non tracé) porte la croissance, F s’allonge en FF. n = 7, δ = 20°.',
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F[+X]F[-X]+X' },
      { predecessor: 'F', successor: 'FF' },
    ],
    angle: 20,
    iterations: 7,
    heading: 90,
    lineWidth: 3,
  },
  {
    id: 'abop-1-24e',
    name: 'Plante ABOP 1.24e',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'Ramification opposée. n = 7, δ = 25,7°.',
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F[+X][-X]FX' },
      { predecessor: 'F', successor: 'FF' },
    ],
    angle: 25.7,
    iterations: 7,
    heading: 90,
    lineWidth: 3,
  },
  {
    id: 'abop-1-24f',
    name: 'Plante ABOP 1.24f',
    group: 'Plantes (ABOP fig. 1.24)',
    note: 'La célèbre « fougère » de Lindenmayer. n = 5, δ = 22,5°.',
    axiom: 'X',
    rules: [
      { predecessor: 'X', successor: 'F-[[X]+X]+F[+FX]-X' },
      { predecessor: 'F', successor: 'FF' },
    ],
    angle: 22.5,
    iterations: 5,
    heading: 65,
    lineWidth: 3,
  },
  {
    id: 'binary-tree',
    name: 'Arbre fractal binaire',
    group: 'Arbres',
    note: 'Chaque bourgeon G donne un tronc et deux branches ; la pile [ ] permet de revenir à la fourche.',
    axiom: 'G',
    rules: [
      { predecessor: 'G', successor: 'F[+G]-G' },
      { predecessor: 'F', successor: 'FF' },
    ],
    angle: 45,
    iterations: 7,
    heading: 90,
    colorMode: 'depth',
    lineWidth: 7,
    widthDecay: 0.72,
  },
  {
    id: 'stochastic-plant',
    name: 'Plante stochastique',
    group: 'Arbres',
    note: 'ABOP fig. 1.27 : trois règles pour F, tirées au hasard (33 / 33 / 34 %). Changez la graine pour une autre plante de la même espèce.',
    axiom: 'F',
    rules: [
      { predecessor: 'F', successor: 'F[+F]F[-F]F', probability: 0.33 },
      { predecessor: 'F', successor: 'F[+F]F', probability: 0.33 },
      { predecessor: 'F', successor: 'F[-F]F', probability: 0.34 },
    ],
    angle: 25.7,
    iterations: 5,
    heading: 90,
    lineWidth: 4,
    widthDecay: 0.8,
  },
  {
    id: 'parametric-tree',
    name: 'Arbre paramétré',
    group: 'Arbres',
    note: 'L-système paramétré : A(l,w) porte la longueur l et l’épaisseur w, réduites à chaque branche ; la condition l > 3 arrête la croissance.',
    axiom: 'A(100,1)',
    rules: [
      { predecessor: 'A(l,w) : l > 3', successor: '!(w)F(l)[+A(l*0.72,w*0.7)][-(0.8*28)A(l*0.8,w*0.7)]' },
    ],
    angle: 28,
    iterations: 10,
    heading: 90,
    colorMode: 'depth',
    lineWidth: 10,
    widthDecay: 1,
  },
];

/** Préréglage chargé à la première visite. */
export const DEFAULT_PRESET_ID = 'abop-1-24f';

/**
 * Cherche un préréglage par identifiant.
 * @param {string} id - Identifiant
 * @returns {Preset|undefined}
 */
export function findPreset(id) {
  return PRESETS.find((preset) => preset.id === id);
}
