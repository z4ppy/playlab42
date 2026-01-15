/**
 * Diese & Mat - Point d'entrée de l'application
 *
 * Ce fichier initialise l'application et charge les dépendances.
 *
 * @module main
 */

import { App } from './App.js';
import GameKit from '../../../lib/gamekit.js';
import { initTheme } from '../../../lib/theme.js';

// ============================================================================
// Initialisation
// ============================================================================

/**
 * Démarre l'application.
 */
async function init() {
  try {
    // Initialiser le thème
    initTheme();

    // Initialiser GameKit pour la communication avec le portail
    GameKit.init('diese-et-mat');

    // Créer et démarrer l'application
    const app = new App();
    await app.init();

    // Exposer l'app pour le debug (en dev uniquement)
    if (window.location.hostname === 'localhost') {
      window.app = app;
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    showError(error);
  }
}

/**
 * Affiche une erreur à l'utilisateur.
 * @param {Error} error - L'erreur à afficher
 */
function showError(error) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div style="color: var(--color-error); text-align: center; padding: 2rem;">
        <h2>Oups ! Une erreur est survenue</h2>
        <p style="margin-top: 1rem; opacity: 0.8;">${error.message}</p>
        <button onclick="location.reload()" style="
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: var(--color-accent);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
        ">Réessayer</button>
      </div>
    `;
  }
}

// Lancer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
