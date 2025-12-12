/**
 * Playlab42 - Gestion des thèmes
 * Permet de basculer entre thème dark et light
 */

const STORAGE_KEY = 'playlab42.theme';

/**
 * Thèmes disponibles
 */
export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system', // Suit les préférences système
};

/**
 * Récupère le thème actuel depuis localStorage
 * @returns {'dark'|'light'|'system'}
 */
export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === THEMES.DARK || saved === THEMES.LIGHT) {
      return saved;
    }
  } catch (e) {
    console.warn('Erreur lecture thème:', e);
  }
  return THEMES.SYSTEM;
}

/**
 * Définit le thème
 * @param {'dark'|'light'|'system'} theme
 */
export function setTheme(theme) {
  try {
    if (theme === THEMES.SYSTEM) {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute('data-theme');
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {
    console.warn('Erreur sauvegarde thème:', e);
  }
}

/**
 * Bascule entre dark et light
 * @returns {'dark'|'light'} Le nouveau thème
 */
export function toggleTheme() {
  const current = getEffectiveTheme();
  const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  setTheme(next);
  return next;
}

/**
 * Retourne le thème effectif (résout 'system')
 * @returns {'dark'|'light'}
 */
export function getEffectiveTheme() {
  const theme = getTheme();
  if (theme === THEMES.SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? THEMES.LIGHT
      : THEMES.DARK;
  }
  return theme;
}

/**
 * Initialise le thème au chargement
 * Doit être appelé le plus tôt possible pour éviter le flash
 */
export function initTheme() {
  const theme = getTheme();
  if (theme !== THEMES.SYSTEM) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Écouter les changements de préférences système
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (getTheme() === THEMES.SYSTEM) {
      // Le thème système a changé, le CSS s'en occupe via @media
      // On dispatch un événement custom pour notifier l'UI
      window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: e.matches ? THEMES.LIGHT : THEMES.DARK },
      }));
    }
  });
}

/**
 * Écoute les changements de thème
 * @param {Function} callback - (theme: 'dark'|'light') => void
 * @returns {Function} - Pour retirer le listener
 */
export function onThemeChange(callback) {
  const handler = (e) => callback(e.detail.theme);
  window.addEventListener('themechange', handler);
  return () => window.removeEventListener('themechange', handler);
}
