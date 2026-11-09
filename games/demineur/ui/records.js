/**
 * Meilleurs temps par niveau et par mode, rangés par `GameKit.saveProgress`.
 *
 * Un temps se minimise : le tri décroissant de `GameKit.saveScore` ne convient
 * pas. Format v1 : `{ version: 1, best: { beginner: { noGuess, classic }, ... } }`
 * en millisecondes (null si aucun record). Seule une victoire sans aide (ni
 * indice ni IA) compte. Une donnée illisible ou d'une version future est
 * conservée telle quelle : rien n'est écrit par-dessus et le joueur est prévenu.
 */
import { LEVELS } from '../engine/grid.js';

export const RECORDS_VERSION = 1;
const MODES = ['noGuess', 'classic'];

/** @returns {{version: number, best: Record<string, Record<string, number|null>>}} Records vides. */
export function emptyRecords() {
  const best = {};
  for (const level of Object.keys(LEVELS)) { best[level] = { noGuess: null, classic: null }; }
  return { version: RECORDS_VERSION, best };
}

/** @param {unknown} value - Valeur lue. @returns {boolean} Durée positive ou absence de record. */
const isTime = value => value === null || (Number.isFinite(value) && value > 0);

/**
 * Valide le format v1 sans faire confiance au stockage.
 * @param {unknown} data - Valeur chargée.
 * @returns {boolean}
 */
export function isRecordData(data) {
  if (!data || typeof data !== 'object' || data.version !== RECORDS_VERSION || !data.best) { return false; }
  return Object.keys(LEVELS).every(level => {
    const entry = data.best[level];
    return Boolean(entry) && MODES.every(mode => isTime(entry[mode]));
  });
}

/** Records du joueur, avec écriture vérifiée. */
export class MinesweeperRecords {
  /**
   * @param {{loadProgress: () => unknown, saveProgress: (data: unknown) => boolean}} kit - Persistance GameKit.
   * @param {(message: string) => void} notify - Message visible pour le joueur.
   */
  constructor(kit, notify) {
    this.kit = kit;
    this.notify = notify;
    const stored = kit.loadProgress();
    this.locked = stored !== null && !isRecordData(stored);
    this.data = this.locked || stored === null ? emptyRecords() : JSON.parse(JSON.stringify(stored));
    if (this.locked) {
      notify('Les records enregistrés sont illisibles : ils sont conservés tels quels et aucun nouveau record ne sera écrit.');
    }
  }

  /**
   * @param {string} level - Niveau.
   * @param {boolean} noGuess - Mode sans hasard.
   * @returns {number|null} Meilleur temps en millisecondes.
   */
  best(level, noGuess) {
    return this.data.best[level][noGuess ? 'noGuess' : 'classic'];
  }

  /**
   * Enregistre une victoire si elle bat le record.
   * @param {{level: string, noGuess: boolean, time: number, assisted: boolean}} result - Victoire.
   * @returns {{record: boolean, previous: number|null}} Nouveau record, et l'ancien.
   */
  submit({ level, noGuess, time, assisted }) {
    const previous = this.best(level, noGuess);
    if (assisted || (previous !== null && time >= previous)) { return { record: false, previous }; }
    this.data.best[level][noGuess ? 'noGuess' : 'classic'] = time;
    if (!this.locked && !this.kit.saveProgress(this.data)) {
      this.notify('Le stockage est indisponible : ce record restera uniquement en mémoire.');
    }
    return { record: true, previous };
  }
}
