/**
 * Table des curseurs du synthétiseur mis à jour depuis la configuration.
 *
 * Chaque entrée associe un curseur à sa clé de config, sa valeur par défaut
 * (appliquée aussi aux valeurs fausses 0/null), son échelle d'affichage
 * et son format.
 *
 * @module controllers/synth-slider-specs
 */

const fixed = (digits) => (v) => v.toFixed(digits);
const rounded = (v) => Math.round(v).toString();
const withUnit = (unit) => (v) => `${Math.round(v)}${unit}`;
const seconds = (digits, divisor) => (v) => `${(v / divisor).toFixed(digits)}s`;

const spec = (id, key, fallback, scale, toDisplay) => ({ id, key, fallback, scale, toDisplay });

/** Sections de paramètres dans l'ordre de mise à jour. */
export const SYNTH_PARAM_SLIDERS = [
  ['fm', [
    spec('fm-harmonicity', 'harmonicity', 3, 1, fixed(1)),
    spec('fm-modulation-index', 'modulationIndex', 10, 1, rounded),
  ]],
  ['pluck', [
    spec('pluck-attack-noise', 'attackNoise', 1.5, 10, (v) => (v / 10).toFixed(1)),
    spec('pluck-dampening', 'dampening', 3500, 1, withUnit(' Hz')),
    spec('pluck-resonance', 'resonance', 0.98, 100, (v) => (v / 100).toFixed(2)),
    spec('pluck-release', 'release', 2, 1000, seconds(1, 1000)),
  ]],
  ['membrane', [
    spec('membrane-pitch-decay', 'pitchDecay', 0.05, 1000, seconds(3, 1000)),
    spec('membrane-octaves', 'octaves', 8, 1, rounded),
  ]],
  ['metal', [
    spec('metal-frequency', 'frequency', 400, 1, withUnit(' Hz')),
    spec('metal-harmonicity', 'harmonicity', 5.1, 1, fixed(1)),
    spec('metal-modulation-index', 'modulationIndex', 32, 1, rounded),
    spec('metal-resonance', 'resonance', 4000, 1, withUnit(' Hz')),
    spec('metal-octaves', 'octaves', 1.5, 1, fixed(1)),
  ]],
];

/** Curseurs de chaque effet, dans l'ordre de mise à jour. */
export const SYNTH_EFFECT_SLIDERS = new Map([
  ['reverb', [spec('reverb-amount', 'amount', 0.3, 100, withUnit('%'))]],
  ['delay', [
    spec('delay-time', 'time', 0.2, 1000, withUnit('ms')),
    spec('delay-feedback', 'feedback', 0.3, 100, withUnit('%')),
  ]],
  ['filter', [spec('filter-frequency', 'frequency', 2000, 1, withUnit(' Hz'))]],
]);
