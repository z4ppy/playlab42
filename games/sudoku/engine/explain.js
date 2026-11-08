/**
 * Explications en français des déductions du solveur humain.
 *
 * Chaque pas produit deux textes, pour un indice en deux temps :
 * - `hint` oriente le regard sans donner la réponse (« Regardez la boîte 4 ») ;
 * - `detail` expose le raisonnement complet et sa conclusion.
 * La notation compacte « L5C2 » signifie « ligne 5, colonne 2 ».
 */

import { cellLongName, cellName, unitName } from './grid.js';
import { techniqueById } from './techniques/index.js';

/** « 2 », « 2 et 7 », « 2, 5 et 7 ». */
export function listText(items) {
  const texts = items.map(String);
  return texts.length <= 1 ? texts.join('') : `${texts.slice(0, -1).join(', ')} et ${texts.at(-1)}`;
}

const cellsText = (cells) => listText(cells.map(cellName));

const PLURAL_NOUNS = { row: 'les lignes', column: 'les colonnes', box: 'les boîtes' };

/** « les lignes 2 et 7 » pour un groupe d'unités du même type. */
const unitsText = (units) => `${PLURAL_NOUNS[units[0].type]} ${listText(units.map((unit) => unit.index + 1))}`;

/**
 * « le 3 de L5C7 et L5C8 ; le 7 de L5C9 » : éliminations regroupées par chiffre.
 * @param {{cell: number, value: number}[]} eliminations
 */
export function eliminationsText(eliminations) {
  const byValue = new Map();
  for (const { cell, value } of eliminations) {
    byValue.set(value, [...(byValue.get(value) ?? []), cell]);
  }
  return [...byValue.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, cells]) => `le ${value} de ${cellsText(cells)}`)
    .join(' ; ');
}

const removal = (step) => `on retire ${eliminationsText(step.eliminations)}`;

/** Rédacteurs par technique : chacun reçoit le pas et le nom de la technique. */
const WRITERS = {
  hiddenSingle(step, name) {
    const [unit] = step.units;
    const [{ cell, value }] = step.placements;
    return {
      hint: `Regardez ${unitName(unit)} : où peut aller le ${value} ?`,
      detail: `Dans ${unitName(unit)}, le ${value} ne peut aller qu'en ${cellLongName(cell)} : `
        + `les autres cases sont occupées ou voient déjà un ${value} (${name}).`,
    };
  },
  nakedSingle(step, name) {
    const [{ cell, value }] = step.placements;
    return {
      hint: `Regardez la case ${cellLongName(cell)} : quels chiffres peut-elle encore recevoir ?`,
      detail: `En ${cellLongName(cell)}, tous les chiffres sauf le ${value} sont déjà présents dans sa ligne, `
        + `sa colonne ou sa boîte : il ne reste que le ${value} (${name}).`,
    };
  },
  pointing(step, name) {
    const [box, line] = step.units;
    const [value] = step.digits;
    return {
      hint: `Regardez où peut aller le ${value} dans ${unitName(box)}.`,
      detail: `Dans ${unitName(box)}, le ${value} n'est possible que sur ${unitName(line)} (${cellsText(step.cells)}). `
        + `Le ${value} de ${unitName(line)} sera donc dans ${unitName(box)} : ${removal(step)} (${name}).`,
    };
  },
  boxLineReduction(step, name) {
    const [line, box] = step.units;
    const [value] = step.digits;
    return {
      hint: `Regardez où peut aller le ${value} sur ${unitName(line)}.`,
      detail: `Sur ${unitName(line)}, le ${value} n'est possible que dans ${unitName(box)} (${cellsText(step.cells)}). `
        + `Le ${value} de ${unitName(box)} sera donc sur ${unitName(line)} : ${removal(step)} (${name}).`,
    };
  },
  nakedSubset(step, name) {
    const [unit] = step.units;
    return {
      hint: `Regardez ${unitName(unit)} : ${step.cells.length} cases s'y partagent seulement ${step.cells.length} candidats.`,
      detail: `Dans ${unitName(unit)}, les cases ${cellsText(step.cells)} ne peuvent contenir que ${listText(step.digits)} : `
        + `ces chiffres leur sont réservés, donc ${removal(step)} (${name}).`,
    };
  },
  hiddenSubset(step, name) {
    const [unit] = step.units;
    return {
      hint: `Regardez ${unitName(unit)} : ${step.digits.length} chiffres n'y ont que ${step.digits.length} places.`,
      detail: `Dans ${unitName(unit)}, les chiffres ${listText(step.digits)} ne peuvent aller que dans ${cellsText(step.cells)} : `
        + `ces cases leur sont réservées, donc ${removal(step)} (${name}).`,
    };
  },
  fish(step, name) {
    const size = step.units.length / 2;
    const bases = step.units.slice(0, size);
    const covers = step.units.slice(size);
    const [value] = step.digits;
    return {
      hint: `Regardez les places du ${value} dans ${unitsText(bases)}.`,
      detail: `Dans ${unitsText(bases)}, le ${value} n'est possible que dans ${unitsText(covers)} (${cellsText(step.cells)}). `
        + `Quelle que soit la répartition, ${unitsText(covers)} reçoivent leur ${value} dans ces cases : `
        + `${removal(step)} (${name}).`,
    };
  },
  xyWing(step, name) {
    const [pivot, first, second] = step.cells;
    const [x, y, z] = step.digits;
    return {
      hint: `Regardez la case ${cellLongName(pivot)}, qui n'a que deux candidats, et ses voisines à deux candidats.`,
      detail: `Le pivot ${cellName(pivot)} vaut ${x} ou ${y}. S'il vaut ${x}, ${cellName(first)} vaut ${z} ; `
        + `s'il vaut ${y}, ${cellName(second)} vaut ${z}. L'une des deux pinces contient donc le ${z} : `
        + `une case qui voit les deux pinces ne peut pas être ${z}, donc ${removal(step)} (${name}).`,
    };
  },
};

const WRITER_OF = {
  nakedPair: 'nakedSubset', nakedTriple: 'nakedSubset',
  hiddenPair: 'hiddenSubset', hiddenTriple: 'hiddenSubset',
  xWing: 'fish', swordfish: 'fish',
};

/**
 * @typedef {{technique: string, name: string, hint: string, detail: string}} StepExplanation
 */

/**
 * Explique un pas du solveur humain.
 * @param {import('./techniques/shared.js').Step} step
 * @returns {StepExplanation}
 */
export function explainStep(step) {
  const { name } = techniqueById(step.technique);
  const writer = WRITERS[WRITER_OF[step.technique] ?? step.technique];
  return { technique: step.technique, name, ...writer(step, name) };
}
