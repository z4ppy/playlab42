/**
 * Point d'entrée de la page : thème, puis contrôleur relié au vrai GameKit.
 */
import { GameKit } from '../../lib/gamekit.js';
import { initTheme, toggleTheme } from '../../lib/theme.js';
import { MinesweeperController } from './controller.js';

initTheme();
document.getElementById('theme').addEventListener('click', toggleTheme);
new MinesweeperController({ document, window, kit: GameKit });
