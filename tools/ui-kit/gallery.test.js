/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const setTheme = jest.fn();
const getTheme = jest.fn(() => 'system');
jest.unstable_mockModule('../../lib/theme.js', () => ({
  getTheme,
  initTheme: jest.fn(),
  setTheme,
}));

beforeEach(async () => {
  jest.resetModules();
  setTheme.mockClear();
  getTheme.mockReset().mockReturnValue('system');
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/)[1];
  document.documentElement.style.setProperty('--space-md', '1rem');
  document.documentElement.style.setProperty('--color-bg', '#101827');
  await import('./gallery.js');
});

describe('Galerie UI interactive', () => {
  test('applique un formulaire sans interpréter le HTML saisi', () => {
    document.getElementById('card-title').value = '<img src=x onerror=alert(1)>';
    document.getElementById('description').value = 'Description personnalisée';
    document.getElementById('kind').value = 'Jeu';
    document.getElementById('spacing').value = '24';
    document.getElementById('compact').checked = true;
    document.querySelector('input[value="Prête à relire"]').checked = true;
    document.getElementById('preview-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(document.getElementById('preview-name').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.getElementById('preview').querySelector('img')).toBeNull();
    expect(document.getElementById('preview-kind').textContent).toBe('Jeu');
    expect(document.getElementById('preview-state').textContent).toContain('Prête à relire');
    expect(document.getElementById('preview').style.padding).toBe('24px');
    expect(document.getElementById('preview').classList.contains('compact')).toBe(true);
    expect(document.getElementById('form-status').textContent).toContain('Succès');
  });

  test('annonce le titre invalide et restitue le focus au champ', () => {
    document.getElementById('card-title').value = '   ';
    document.getElementById('preview-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(document.getElementById('form-status').textContent).toContain('Erreur');
    expect(document.activeElement).toBe(document.getElementById('card-title'));
    expect(document.getElementById('preview-name').textContent).toBe('Ma contribution');
  });

  test('utilise le thème partagé et exporte une propriété CSS adaptée au token', () => {
    const theme = document.getElementById('theme');
    theme.value = 'light';
    theme.dispatchEvent(new Event('change'));
    expect(setTheme).toHaveBeenCalledWith('light');
    const token = document.getElementById('token');
    token.value = '--space-md';
    token.dispatchEvent(new Event('change'));
    expect(document.getElementById('token-value').textContent).toBe('1rem');
    expect(document.getElementById('token-code').textContent).toContain('padding: var(--space-md)');
  });

  test('ouvre un dialogue inspectable et laisse la fermeture native disponible', () => {
    const dialog = document.getElementById('inspector');
    dialog.showModal = jest.fn();
    document.getElementById('open-dialog').click();
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    expect(document.getElementById('card-code').textContent).toContain('Ma contribution');
    expect(dialog.classList.contains('ui-dialog')).toBe(true);
    expect(dialog.querySelector('form').getAttribute('method')).toBe('dialog');
    expect(dialog.querySelector('button').hasAttribute('autofocus')).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(false);
  });

  test('les boutons produisent des statuts textuels', () => {
    const status = document.getElementById('button-status');
    document.getElementById('primary').click();
    expect(status.textContent).toContain('Succès');
    expect(status.classList.contains('ui-status-success')).toBe(true);
    document.getElementById('secondary').click();
    expect(status.textContent).toContain('Information');
    // Une information ne garde pas la bordure verte du succès précédent.
    expect(status.className).toBe('ui-status');
  });

  test('la variante du statut de formulaire suit le message et aria-invalid suit l\'erreur', () => {
    const title = document.getElementById('card-title');
    const status = document.getElementById('form-status');
    const form = document.getElementById('preview-form');
    title.value = '  ';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(status.classList.contains('ui-status-error')).toBe(true);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    title.value = 'Titre corrigé';
    title.dispatchEvent(new Event('input'));
    expect(title.hasAttribute('aria-invalid')).toBe(false);
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(status.classList.contains('ui-status-success')).toBe(true);
    expect(status.classList.contains('ui-status-error')).toBe(false);
  });

  test('le sélecteur de thème suit un changement venu d\'ailleurs (portail, autre onglet)', () => {
    const theme = document.getElementById('theme');
    expect(theme.value).toBe('system');
    // lib/theme.js émet themechange après un événement storage ou une préférence système.
    getTheme.mockReturnValue('dark');
    document.documentElement.style.setProperty('--color-bg', '#000000');
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'dark' } }));
    expect(theme.value).toBe('dark');
    expect(document.getElementById('token-value').textContent).toBe('#000000');
  });

  test('le curseur d\'espacement annonce sa valeur avec l\'unité', () => {
    const spacing = document.getElementById('spacing');
    expect(spacing.getAttribute('aria-valuetext')).toBe('16 px');
    spacing.value = '28';
    spacing.dispatchEvent(new Event('input'));
    expect(spacing.getAttribute('aria-valuetext')).toBe('28 px');
    expect(document.getElementById('spacing-value').value).toBe('28');
  });

  test('emploie les composants partagés pour tous les boutons et champs', () => {
    for (const button of document.querySelectorAll('button')) {
      expect(button.classList.contains('ui-button')).toBe(true);
    }
    for (const field of document.querySelectorAll('select, textarea, input:not([type="checkbox"]):not([type="radio"])')) {
      expect(field.classList.contains('ui-field')).toBe(true);
    }
    expect(document.getElementById('preview').classList.contains('ui-card')).toBe(true);
    expect(document.getElementById('form-status').classList.contains('ui-status')).toBe(true);
  });

  test('la feuille partagée reste opt-in et ne remplace pas le comportement du dialogue', () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(directory, '../../lib/components.css'), 'utf8');
    expect(css).toContain('@import url("./theme.css")');
    expect(css).toContain('@import url("./ui.css")');
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '');
    for (const [, selector] of rules.matchAll(/([^{}]+)\{/g)) {
      if (selector.trim().startsWith('@media')) { continue; }
      for (const part of selector.split(',')) {
        expect(part).toContain('.ui-');
      }
    }
    expect(css.match(/\.ui-dialog\s*\{([^}]*)\}/)[1]).not.toMatch(/\bdisplay\s*:/);
    // Régressions de rendu : contour de contrôle contrasté, région vide sans barre, code visible en clair.
    const control = css.match(/\.ui-button, \.ui-field \{([^}]*)\}/)[1];
    expect(control).toMatch(/border-color:\s*color-mix\(in srgb, var\(--color-text-muted\)/);
    expect(control).toContain('accent-color: var(--color-accent)');
    expect(css).toMatch(/\.ui-status:empty \{[^}]*border-left-color: transparent/);
    expect(css.match(/\.ui-code \{([^}]*)\}/)[1]).not.toContain('--color-bg-secondary');
    const local = readFileSync(join(directory, 'gallery.css'), 'utf8');
    expect(local).not.toMatch(/\.ui-(button|field|status|dialog)\b/);
  });
});
