/**
 * Point d'entrée de Paint Studio : thème, application, réaction au changement de thème.
 */

import { initTheme, onThemeChange, toggleTheme } from '../../../lib/theme.js';
import { App } from './ui/app.js';

initTheme();

const app = new App();
document.getElementById('theme-toggle')?.addEventListener('click', () => toggleTheme());
onThemeChange(() => {
  app.editor.renderer.refreshTheme();
  app.editor.requestRender(false);
});
// Point d'entrée exposé pour la console et les tests de bout en bout.
Object.defineProperty(window, 'paintStudio', { value: app });
app.start();
