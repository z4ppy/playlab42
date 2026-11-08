// Point d'entrée : thème du portail d'abord (pas de flash), puis le jeu.
import { initTheme } from '../../lib/theme.js';
import { GameKit } from '../../lib/gamekit.js';
import { GolfController } from './controller.js';

initTheme();
new GolfController({ document, window, kit: GameKit });
