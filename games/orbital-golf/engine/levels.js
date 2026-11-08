/**
 * Parcours d'initiation : neuf trous faits à la main, du plus simple au plus riche.
 *
 * Données JSON pures (un tableau gelé plutôt qu'un fichier .json, dont l'import
 * ESM varie selon les navigateurs et Jest). Chaque corps tient sur une ligne.
 * Angles en dixièmes de degré (0 = est, sens horaire) ; `reference` est un tir
 * vérifié par les tests qui atteint le green ou le trou en un coup.
 */
const deepFreeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

export const INITIATION = deepFreeze([
  {
    id: 'i1', name: 'Premier putt', par: 2, tee: [150, 500], hole: { x: 850, y: 500 }, previewSeconds: 2.5,
    lesson: 'Vise le trou et dose la puissance : le green freine la balle, un petit putt finit le travail.',
    bodies: [],
    reference: { angle: 0, power: 66 },
  },
  {
    id: 'i2', name: 'Première courbe', par: 2, tee: [120, 520], hole: { x: 880, y: 520 }, previewSeconds: 2.5,
    lesson: 'Une planète attire la balle : vise à côté pour que la gravité la ramène.',
    bodies: [
      { kind: 'planet', x: 500, y: 540, radius: 80, mass: 4, palette: 'ocre' },
    ],
    reference: { angle: 3460, power: 76 },
  },
  {
    id: 'i3', name: 'Fronde', par: 3, tee: [180, 820], hole: { x: 820, y: 820 }, previewSeconds: 2.5,
    lesson: 'Contourne le grand puits : il courbe la trajectoire et la renvoie vers le bas.',
    bodies: [
      { kind: 'planet', x: 500, y: 420, radius: 60, mass: 7, palette: 'lave' },
      { kind: 'planet', x: 500, y: 810, radius: 70, mass: 2, palette: 'glace' },
    ],
    reference: { angle: 180, power: 66 },
  },
  {
    id: 'i4', name: 'Rebond', par: 3, tee: [150, 300], hole: { x: 350, y: 840 },
    lesson: 'Une surface renvoie la balle : fais-la rebondir pour contourner l’obstacle.',
    bodies: [
      { kind: 'planet', x: 225, y: 555, radius: 80, mass: 2, palette: 'jade' },
      { kind: 'planet', x: 620, y: 560, radius: 80, mass: 3, palette: 'ambre' },
    ],
    reference: { angle: 480, power: 44 },
  },
  {
    id: 'i5', name: 'Deux puits', par: 3, tee: [120, 500], hole: { x: 880, y: 540 },
    lesson: 'Entre deux masses, le passage n’est pas au milieu.',
    bodies: [
      { kind: 'planet', x: 500, y: 290, radius: 70, mass: 5, palette: 'ocre' },
      { kind: 'planet', x: 520, y: 720, radius: 60, mass: 4, palette: 'glace' },
      { kind: 'planet', x: 500, y: 515, radius: 45, mass: 1.5, palette: 'lave' },
    ],
    reference: { angle: 150, power: 54 },
  },
  {
    id: 'i6', name: 'Horizon', par: 3, tee: [150, 850], hole: { x: 850, y: 150 },
    lesson: 'Un trou noir avale la balle : le coup compte et elle revient au point de tir.',
    bodies: [
      { kind: 'blackhole', x: 500, y: 500, mass: 9 },
      { kind: 'planet', x: 250, y: 250, radius: 60, mass: 3, palette: 'jade' },
    ],
    reference: { angle: 3030, power: 96 },
  },
  {
    id: 'i7', name: 'Lune en orbite', par: 3, tee: [120, 500], hole: { x: 880, y: 500 },
    lesson: 'La lune ne bouge que pendant les vols : observe sa position avant de tirer.',
    bodies: [
      { kind: 'planet', x: 500, y: 500, radius: 75, mass: 5, palette: 'ambre' },
      { kind: 'moon', radius: 22, mass: 0.6, palette: 'glace', orbit: { cx: 500, cy: 500, r: 190, period: 6, phase: -90 } },
    ],
    reference: { angle: 170, power: 78 },
  },
  {
    id: 'i8', name: 'Atterrissage', par: 3, tee: [120, 850], hole: { on: { body: 0, deg: -35 } },
    lesson: 'Le trou est posé sur la planète : pose-toi sur le green et laisse rouler.',
    bodies: [
      { kind: 'planet', x: 520, y: 560, radius: 140, mass: 6, palette: 'jade' },
    ],
    reference: { angle: 120, power: 24 },
  },
  {
    id: 'i9', name: 'Grand tour', par: 4, tee: [100, 900], hole: { x: 900, y: 120 },
    lesson: 'Tout ensemble : puits, trou noir et lune. Prends le chemin le plus sûr.',
    bodies: [
      { kind: 'planet', x: 310, y: 690, radius: 70, mass: 5, palette: 'ocre' },
      { kind: 'planet', x: 700, y: 420, radius: 60, mass: 6, palette: 'lave' },
      { kind: 'blackhole', x: 520, y: 180, mass: 10 },
      { kind: 'moon', radius: 20, mass: 0.5, palette: 'glace', orbit: { cx: 700, cy: 420, r: 150, period: 5, phase: 0 } },
    ],
    reference: { angle: 2950, power: 78 },
  },
]);
