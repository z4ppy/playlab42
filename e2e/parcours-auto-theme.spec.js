import { test, expect, activate } from './fixtures.js';

// En thème automatique, lib/theme.js retire data-theme : le lecteur de parcours
// doit alors rendre exactement le thème choisi qui correspond au système.
const epicId = 'algorithm-complexity';

/** Styles du lecteur propres à un thème : voile du menu mobile et ombre d'une infobulle du glossaire. */
async function readViewerStyles(page) {
  await page.goto(`/#/parcours/${epicId}`);
  await expect(page.locator('.pv-menu-item').first()).toBeAttached();
  await page.locator('.parcours-viewer').evaluate(element => element.classList.add('menu-open'));
  return page.evaluate(() => {
    const root = document.documentElement;
    const tooltip = document.createElement('div');
    tooltip.className = 'glossary-tooltip';
    document.body.append(tooltip);
    const overlay = getComputedStyle(document.querySelector('.parcours-viewer'), '::before');
    const styles = {
      colorScheme: getComputedStyle(root).colorScheme,
      overlay: `${overlay.content} ${overlay.backgroundColor}`,
      tooltipShadow: getComputedStyle(tooltip).boxShadow,
      viewerBackground: getComputedStyle(document.querySelector('.parcours-viewer')).backgroundColor,
    };
    tooltip.remove();
    return { theme: root.getAttribute('data-theme'), styles };
  });
}

async function chooseTheme(page, theme) {
  await page.goto('/');
  await activate(page.locator('#btn-settings'));
  await activate(page.locator(`#theme-${theme}`));
  await activate(page.locator('#btn-close-settings'));
}

for (const scheme of ['dark', 'light']) {
  test(`parcours en thème automatique sur système ${scheme} : rendu identique au thème ${scheme} choisi`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const automatic = await readViewerStyles(page);
    expect(automatic.theme).toBeNull();

    // Préférence système opposée : seul le choix enregistré doit décider.
    await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'light' : 'dark' });
    await chooseTheme(page, scheme);
    const chosen = await readViewerStyles(page);
    expect(chosen.theme).toBe(scheme);

    expect(automatic.styles).toEqual(chosen.styles);
    // Valeurs de référence du thème choisi, inchangées par le correctif.
    expect(chosen.styles.overlay).toBe(scheme === 'dark' ? '"" rgba(0, 0, 0, 0.7)' : '"" rgba(0, 0, 0, 0.5)');
    expect(chosen.styles.tooltipShadow).toContain(scheme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)');
  });
}
