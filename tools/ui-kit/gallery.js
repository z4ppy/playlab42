import { getTheme, initTheme, setTheme } from '../../lib/theme.js';

initTheme();
const theme = document.getElementById('theme');
const token = document.getElementById('token');

/** Affiche la valeur réelle du token pour le thème courant, sans la recopier. */
function inspectToken() {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token.value).trim();
  const properties = {
    '--color-bg': 'background',
    '--color-text': 'color',
    '--color-accent': 'color',
    '--color-border': 'border-color',
    '--space-md': 'padding',
    '--radius-lg': 'border-radius',
  };
  document.getElementById('token-value').textContent = value;
  document.getElementById('token-code').textContent = `.contribution {\n  ${properties[token.value]}: var(${token.value});\n}`;
}

/**
 * Resynchronise le sélecteur et l'inspecteur. `themechange` est aussi émis
 * quand le thème change ailleurs (portail parent, autre onglet via `storage`,
 * préférence système) : le sélecteur ne doit pas afficher un choix périmé.
 */
function syncThemeControls() {
  theme.value = getTheme();
  inspectToken();
}

// setTheme émet themechange : l'inspecteur n'est rafraîchi qu'une fois.
theme.addEventListener('change', () => setTheme(theme.value));
window.addEventListener('themechange', syncThemeControls);
token.addEventListener('change', inspectToken);
syncThemeControls();

document.getElementById('primary').addEventListener('click', () => {
  document.getElementById('button-status').textContent = 'Succès : action principale activée.';
});
document.getElementById('secondary').addEventListener('click', () => {
  document.getElementById('button-status').textContent = 'Information : action secondaire activée.';
});
const spacing = document.getElementById('spacing');
spacing.addEventListener('input', () => {
  document.getElementById('spacing-value').value = spacing.value;
});

const form = document.getElementById('preview-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const title = document.getElementById('card-title');
  if (!title.value.trim()) {
    document.getElementById('form-status').textContent = 'Erreur : saisir un titre qui ne contient pas seulement des espaces.';
    title.focus();
    return;
  }
  document.getElementById('preview-name').textContent = title.value.trim();
  document.getElementById('preview-description').textContent = document.getElementById('description').value;
  document.getElementById('preview-kind').textContent = document.getElementById('kind').value;
  document.getElementById('preview-state').textContent = `Statut : ${new FormData(form).get('status')}`;
  const preview = document.getElementById('preview');
  preview.style.padding = `${spacing.value}px`;
  preview.classList.toggle('compact', document.getElementById('compact').checked);
  document.getElementById('form-status').textContent = 'Succès : la carte de prévisualisation a été mise à jour.';
});

const dialog = document.getElementById('inspector');
const opener = document.getElementById('open-dialog');
opener.addEventListener('click', () => {
  document.getElementById('card-code').textContent = document.getElementById('preview').outerHTML;
  dialog.showModal();
});

document.getElementById('download').addEventListener('click', () => {
  const blob = new Blob([document.getElementById('token-code').textContent], { type: 'text/css;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'contribution-token.css';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById('download-status').textContent = 'Téléchargement de contribution-token.css demandé au navigateur.';
});
