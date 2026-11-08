/**
 * Records personnels du golf orbital, rangés par `GameKit.saveProgress`.
 *
 * Au golf, le plus petit nombre de coups gagne : le tri décroissant de
 * `GameKit.saveScore` ne convient pas. Format v1 :
 * `{ version: 1, course: { best, holes: [9] }, daily: { date, strokes }, free: { best } }`.
 * Une donnée illisible ou d'une version future est conservée telle quelle :
 * aucun record n'est écrit par-dessus, et le joueur en est prévenu.
 */

export const RECORD_VERSION = 1;
const COURSE_HOLES = 9;

/** @returns {object} Records vides au format v1. */
export function emptyRecords() {
  return {
    version: RECORD_VERSION,
    course: { best: null, holes: Array(COURSE_HOLES).fill(null) },
    daily: { date: null, strokes: null },
    free: { best: null },
  };
}

/** @param {unknown} value - Valeur lue. @returns {boolean} Nombre de coups positif ou absent. */
const isScore = value => value === null || (Number.isInteger(value) && value > 0);
const isObject = value => Boolean(value) && typeof value === 'object';

/**
 * Valide le schéma v1 sans faire confiance au stockage.
 * @param {unknown} data - Valeur chargée.
 * @returns {boolean} Records v1 exploitables.
 */
export function isRecordData(data) {
  return isObject(data) && data.version === RECORD_VERSION
    && isCourse(data.course) && isDaily(data.daily) && isObject(data.free) && isScore(data.free.best);
}

/** @param {unknown} course - Records d'initiation. @returns {boolean} Total et neuf trous valides. */
function isCourse(course) {
  return isObject(course) && isScore(course.best) && Array.isArray(course.holes)
    && course.holes.length === COURSE_HOLES && course.holes.every(isScore);
}

/** @param {unknown} daily - Résultat du trou du jour. @returns {boolean} Date et coups valides. */
function isDaily(daily) {
  return isObject(daily) && isScore(daily.strokes) && (daily.date === null || typeof daily.date === 'string');
}

/** @param {number|null} previous - Record actuel. @param {number} value - Résultat. @returns {boolean} Amélioration. */
const beats = (previous, value) => previous === null || value < previous;

/** @param {number[]} strokes - Coups par trou. @returns {number} Total. */
const total = strokes => strokes.reduce((sum, value) => sum + value, 0);

/** Records d'un joueur, avec écriture vérifiée. */
export class GolfRecords {
  /**
   * @param {{loadProgress:() => unknown, saveProgress:(data: unknown) => boolean}} kit - Persistance GameKit.
   * @param {(message: string) => void} notify - Message visible pour le joueur.
   */
  constructor(kit, notify) {
    this.kit = kit;
    this.notify = notify;
    const stored = kit.loadProgress();
    this.locked = stored !== null && !isRecordData(stored);
    this.data = isRecordData(stored) ? JSON.parse(JSON.stringify(stored)) : emptyRecords();
    if (this.locked) {
      notify('Les records enregistrés sont illisibles : ils sont conservés tels quels et aucun nouveau record ne sera écrit.');
    }
  }

  /**
   * Met à jour les records d'une partie terminée sans reprise ni indice.
   * @param {{mode:string, date:string|null, strokes:number[], restarts:number}} state - Partie finie.
   * @param {{assisted?: boolean}} [options] - Indice utilisé pendant la partie.
   * @returns {{record: boolean, eligible: boolean, best: number|null}} Bilan.
   */
  finish(state, { assisted = false } = {}) {
    const eligible = state.restarts === 0 && !assisted;
    const before = JSON.stringify(this.data);
    const previous = this.best(state.mode, state.date);
    if (eligible) { this.apply(state, total(state.strokes)); }
    const best = this.best(state.mode, state.date);
    // Un meilleur trou d'initiation s'enregistre aussi quand le total n'est pas battu.
    if (JSON.stringify(this.data) !== before && !this.locked && !this.kit.saveProgress(this.data)) {
      this.notify('Le stockage est indisponible : ce record restera uniquement en mémoire.');
    }
    return { record: best !== previous, eligible, best };
  }

  /**
   * @param {object} state - Partie finie.
   * @param {number} score - Total des coups.
   */
  apply(state, score) {
    if (state.mode === 'daily') {
      this.applyDaily(state.date, score);
    } else if (state.mode === 'free') {
      this.replace(this.data.free, 'best', score);
    } else {
      state.strokes.forEach((strokes, index) => this.replace(this.data.course.holes, index, strokes));
      this.replace(this.data.course, 'best', score);
    }
  }

  /**
   * @param {string} date - Date du trou du jour.
   * @param {number} score - Coups : un nouveau jour remplace le résultat de la veille.
   */
  applyDaily(date, score) {
    if (this.data.daily.date !== date) { this.data.daily = { date, strokes: null }; }
    this.replace(this.data.daily, 'strokes', score);
  }

  /**
   * @param {object|number[]} holder - Objet ou tableau du record.
   * @param {string|number} key - Champ.
   * @param {number} value - Résultat, gardé seulement s'il bat le record.
   */
  replace(holder, key, value) {
    if (beats(holder[key], value)) { holder[key] = value; }
  }

  /**
   * @param {string} mode - Mode de jeu.
   * @param {string|null} [date] - Date du jour, pour le trou du jour.
   * @returns {number|null} Meilleur total du mode (du jour donné pour le trou du jour).
   */
  best(mode, date = null) {
    if (mode === 'daily') { return date === null || this.data.daily.date === date ? this.data.daily.strokes : null; }
    return mode === 'free' ? this.data.free.best : this.data.course.best;
  }

  /** @param {number} index - Trou d'initiation. @returns {number|null} Meilleur score du trou. */
  bestHole(index) {
    return this.data.course.holes[index];
  }
}
