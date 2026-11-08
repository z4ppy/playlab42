/**
 * Effets sonores synthétisés (WebAudio), coupés par défaut.
 *
 * Aucun fichier audio : chaque effet est une courte glissade de fréquence.
 * Le contexte n'est créé qu'au premier son demandé après un geste du joueur,
 * comme l'exigent les navigateurs. Une erreur audio coupe le son sans
 * interrompre la partie.
 */

/** Effets : [forme d'onde, fréquence de départ, fréquence d'arrivée, durée en s, volume]. */
const EFFECTS = {
  shoot: ['triangle', 220, 520, 0.18, 0.18],
  bounce: ['sine', 330, 180, 0.08, 0.12],
  holed: ['sine', 523, 1046, 0.45, 0.22],
  lost: ['sawtooth', 300, 70, 0.4, 0.08],
  rest: ['sine', 260, 240, 0.12, 0.1],
};

/** Petit synthétiseur à la demande. */
export class GolfSound {
  /**
   * @param {{AudioContext?: typeof AudioContext, webkitAudioContext?: typeof AudioContext}} host - Fenêtre.
   * @param {(message: string) => void} onFailure - Prévient le joueur si l'audio est indisponible.
   */
  constructor(host, onFailure) {
    this.Context = host.AudioContext ?? host.webkitAudioContext ?? null;
    this.onFailure = onFailure;
    this.enabled = false;
    this.context = null;
  }

  /** @returns {boolean} L'audio peut être activé dans ce navigateur. */
  get available() {
    return this.Context !== null;
  }

  /**
   * Active ou coupe les effets. L'activation suit un geste du joueur : c'est
   * le moment où le navigateur autorise la création du contexte audio.
   * @param {boolean} enabled - Son voulu.
   * @returns {boolean} Son réellement actif.
   */
  setEnabled(enabled) {
    this.enabled = enabled && this.available;
    if (this.enabled) { this.guard(() => { this.context ??= new this.Context(); this.context.resume?.()?.catch?.(() => {}); }); }
    return this.enabled;
  }

  /** @param {keyof typeof EFFECTS} name - Effet à jouer, ignoré si le son est coupé. */
  play(name) {
    const effect = EFFECTS[name];
    if (this.enabled && effect) { this.guard(() => this.sweep(...effect)); }
  }

  /** @param {() => void} action - Appel audio ; un échec coupe le son et prévient le joueur. */
  guard(action) {
    try {
      action();
    } catch {
      this.enabled = false;
      this.onFailure('Le son est indisponible dans ce navigateur : il a été coupé.');
    }
  }

  /**
   * @param {OscillatorType} type - Forme d'onde.
   * @param {number} from - Fréquence initiale, en Hz.
   * @param {number} to - Fréquence finale.
   * @param {number} seconds - Durée.
   * @param {number} volume - Gain maximal.
   */
  sweep(type, from, to, seconds, volume) {
    const { context } = this;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  }

  /** Libère le contexte audio au démontage. */
  dispose() {
    this.enabled = false;
    this.context?.close?.();
    this.context = null;
  }
}
