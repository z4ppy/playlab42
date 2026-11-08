/**
 * Point d'entrée du Solitaire : thème, SDK du portail, puis contrôleur.
 */

import { GameKit } from '../../lib/gamekit.js';
import { initTheme } from '../../lib/theme.js';
import { SolitaireApp } from './ui/app.js';
import { dealFromQuery } from './ui/progress.js';

const stopTheme = initTheme();
// Une donne se partage par l'adresse : ?donne=1234&pioche=3
new SolitaireApp({ doc: document, win: window, kit: GameKit, initialDeal: dealFromQuery(window.location.search) });

// Le contrôleur pose ses hooks GameKit ; on y ajoute le nettoyage du thème.
const disposeApp = window.onGameDispose;
window.onGameDispose = () => {
  disposeApp();
  stopTheme();
};
