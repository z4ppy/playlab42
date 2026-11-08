/**
 * Réglages et statistiques locales, via `GameKit.saveProgress`.
 *
 * Le format est petit, versionné et revalidé au chargement : le stockage n'est
 * pas une source de confiance. Une valeur illisible n'est jamais effacée, elle
 * est seulement ignorée (et signalée) jusqu'à la prochaine sauvegarde réussie.
 *
 * @module games/solitaire/ui/progress
 */

/** Réglages par défaut d'une première visite. */
export const DEFAULT_SETTINGS = Object.freeze({ drawCount: 1, winnableOnly: false, autoFinish: true });

const EMPTY_STATS = Object.freeze({ played: 0, won: 0, bestTimeMs: null, bestScore: 0 });

const isCount = value => Number.isSafeInteger(value) && value >= 0;

/** Réglages valides ? */
function isSettings(value) {
  return Boolean(value) && [1, 3].includes(value.drawCount)
    && typeof value.winnableOnly === 'boolean' && typeof value.autoFinish === 'boolean';
}

/** Statistiques valides ? */
function isStats(value) {
  return Boolean(value) && isCount(value.played) && isCount(value.won) && value.won <= value.played
    && (value.bestTimeMs === null || isCount(value.bestTimeMs)) && isCount(value.bestScore);
}

/**
 * Valide les données relues du stockage.
 * @param {unknown} data
 * @returns {boolean}
 */
export function isProgressData(data) {
  return Boolean(data) && typeof data === 'object' && data.version === 1
    && isSettings(data.settings) && isStats(data.stats);
}

/**
 * Donne demandée par l'adresse de la page (`?donne=1234&pioche=3`).
 * Une valeur invalide est ignorée : la page reste jouable.
 * @param {string} search - `location.search`
 * @returns {{seed?: number, drawCount?: 1|3}}
 */
export function dealFromQuery(search) {
  const params = new URLSearchParams(search);
  const deal = {};
  const raw = params.get('donne') ?? '';
  const seed = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (seed <= 0xffffffff) {
    deal.seed = seed;
  }
  const drawCount = Number(params.get('pioche'));
  if (drawCount === 1 || drawCount === 3) {
    deal.drawCount = drawCount;
  }
  return deal;
}

/** Progression locale du joueur : réglages et bilan des parties. */
export class SolitaireProgress {
  /**
   * @param {{loadProgress: Function, saveProgress: Function, saveScore: Function}} kit - GameKit
   * @param {(message: string) => void} notify - Message visible en cas de problème de stockage
   */
  constructor(kit, notify) {
    this.kit = kit;
    this.notify = notify;
    const data = kit.loadProgress();
    this.data = { version: 1, settings: { ...DEFAULT_SETTINGS }, stats: { ...EMPTY_STATS } };
    if (isProgressData(data)) {
      this.data = { version: 1, settings: { ...data.settings }, stats: { ...data.stats } };
    } else if (data !== null) {
      notify('Les réglages enregistrés sont illisibles : les valeurs par défaut sont utilisées.');
    }
  }

  get settings() {
    return { ...this.data.settings };
  }

  get stats() {
    return { ...this.data.stats };
  }

  /** @param {Partial<typeof DEFAULT_SETTINGS>} changes */
  updateSettings(changes) {
    this.data.settings = { ...this.data.settings, ...changes };
    this.#save();
  }

  /** Une partie compte comme jouée dès son premier coup. */
  recordStart() {
    this.data.stats = { ...this.data.stats, played: this.data.stats.played + 1 };
    this.#save();
  }

  /**
   * Enregistre une victoire et son score (classement GameKit décroissant).
   * @param {{score: number, elapsedMs: number}} result
   */
  recordWin({ score, elapsedMs }) {
    const { stats } = this.data;
    const time = Math.round(elapsedMs);
    this.data.stats = {
      ...stats,
      won: Math.min(stats.won + 1, stats.played),
      bestTimeMs: stats.bestTimeMs === null ? time : Math.min(stats.bestTimeMs, time),
      bestScore: Math.max(stats.bestScore, score),
    };
    this.#save();
    if (!this.kit.saveScore(score)) {
      this.notify('Le stockage est indisponible : le score ne peut pas être enregistré.');
    }
  }

  #save() {
    if (!this.kit.saveProgress(this.data)) {
      this.notify('Le stockage est indisponible : réglages et statistiques restent en mémoire.');
    }
  }
}
