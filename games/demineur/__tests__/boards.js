/**
 * Aides de test : dessiner une grille en texte plutôt qu'en indices.
 *
 * Légende : `o` case ouverte (son chiffre est calculé), `.` case fermée sans
 * mine, `*` case fermée minée, `F` drapeau sur une mine, `f` drapeau faux.
 * Les espaces sont ignorés : on peut aligner les colonnes.
 */
import { adjacentMineCounts } from '../engine/grid.js';
import { MinesweeperEngine } from '../engine.js';

/**
 * @param {string} drawing - Lignes de la grille.
 * @returns {{width: number, height: number, chars: string[]}}
 */
function parse(drawing) {
  const lines = drawing.trim().split('\n').map(line => line.replace(/\s+/g, ''));
  return { width: lines[0].length, height: lines.length, chars: lines.join('').split('') };
}

/**
 * Vue joueur dessinée, et la vérité cachée séparément (le solveur ne la reçoit pas).
 * @param {string} drawing - Grille dessinée.
 * @param {{mineCount?: number}} [options] - Nombre total de mines s'il diffère du dessin.
 * @returns {{view: object, mines: number[]}}
 */
export function drawView(drawing, { mineCount } = {}) {
  const { width, height, chars } = parse(drawing);
  const mines = chars.flatMap((char, index) => ('*F'.includes(char) ? [index] : []));
  const counts = adjacentMineCounts(width, height, mines);
  const cells = chars.map((char, index) => {
    if (char === 'o') { return counts[index]; }
    return 'fF'.includes(char) ? 'flag' : 'hidden';
  });
  return { view: { width, height, mineCount: mineCount ?? mines.length, cells, status: 'playing' }, mines };
}

/**
 * État de moteur en cours de partie avec des mines imposées (Débutant 9 × 9 par défaut).
 * @param {number[]} mines - Mines (autant que le niveau en prévoit).
 * @param {object} [config] - Configuration du moteur.
 * @returns {object} État « playing », grille entièrement fermée.
 */
export function playingState(mines, config = {}) {
  const state = new MinesweeperEngine().init({ seed: 1, playerIds: ['p1'], ...config });
  return { ...state, status: 'playing', mines: [...mines].sort((a, b) => a - b), generation: { attempts: 1, guaranteed: false } };
}
