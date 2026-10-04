/**
 * Détection de hauteur par autocorrélation pour l'accordeur.
 *
 * Fonctions pures : aucune dépendance au DOM ni à l'audio.
 *
 * @module controllers/tuner-pitch
 */

/** Niveau RMS minimal en dessous duquel le signal est considéré silencieux */
const SILENCE_RMS = 0.01;

/** Plage de détection : ~1000 Hz (lag min) à ~50 Hz (lag max) */
const MAX_FREQUENCY = 1000;
const MIN_FREQUENCY = 50;

function rootMeanSquare(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function autocorrelate(buffer) {
  const size = buffer.length;
  const correlations = new Float32Array(size);
  for (let lag = 0; lag < size; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }
  return correlations;
}

/**
 * Cherche le premier pic de corrélation dans la plage de lags audibles.
 * Le parcours s'arrête dès que la corrélation retombe sous 90 % du pic.
 */
function findBestLag(correlations, sampleRate) {
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag < maxLag && lag < correlations.length; lag++) {
    if (correlations[lag] > bestCorr) {
      bestCorr = correlations[lag];
      bestLag = lag;
    } else if (bestLag !== -1 && correlations[lag] < bestCorr * 0.9) {
      break;
    }
  }

  return { bestLag, bestCorr };
}

/**
 * Détecte la fréquence fondamentale d'un buffer audio.
 *
 * @param {Float32Array} buffer - Échantillons temporels
 * @param {number} sampleRate - Taux d'échantillonnage
 * @returns {number} Fréquence en Hz, ou -1 si le signal est trop faible ou ambigu
 */
export function detectPitch(buffer, sampleRate) {
  if (rootMeanSquare(buffer) < SILENCE_RMS) {return -1;}

  const correlations = autocorrelate(buffer);
  const { bestLag, bestCorr } = findBestLag(correlations, sampleRate);

  if (bestLag === -1 || bestCorr < correlations[0] * 0.5) {
    return -1;
  }
  return sampleRate / bestLag;
}
