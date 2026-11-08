import { getTheme, initTheme, setTheme } from '../../lib/theme.js';

initTheme();
const theme = document.getElementById('theme');
const token = document.getElementById('token');

/** Propriété CSS d'exemple associée à chaque token inspectable. */
const TOKEN_PROPERTIES = {
  '--color-bg': 'background',
  '--color-text': 'color',
  '--color-accent': 'color',
  '--color-border': 'border-color',
  '--space-md': 'padding',
  '--radius-lg': 'border-radius',
};

/** Variantes visuelles de ui-status ; l'information garde la classe de base seule. */
const STATUS_TONES = ['success', 'warning', 'error'];

/**
 * Écrit un message dans une région de statut et aligne sa variante visuelle.
 * Le préfixe textuel (« Succès », « Erreur »…) reste dans le message : la
 * couleur de la bordure ne fait que le doubler.
 * @param {HTMLElement} element - Région `role="status"` portant `ui-status`.
 * @param {string} message - Texte annoncé, inséré sans interprétation HTML.
 * @param {'info'|'success'|'warning'|'error'} [tone='info'] - Variante affichée.
 */
export function announce(element, message, tone = 'info') {
  for (const name of STATUS_TONES) {
    element.classList.toggle(`ui-status-${name}`, name === tone);
  }
  element.textContent = message;
}

/**
 * Retire l'indentation commune d'un fragment HTML sérialisé.
 * `outerHTML` conserve l'indentation du fichier source : sans ce nettoyage, les
 * enfants apparaissent décalés de dix espaces et la balise fermante de huit.
 * @param {string} html - Code dont seule la première ligne est déjà à gauche.
 * @returns {string} Code ré-indenté à partir de la colonne zéro.
 */
export function dedent(html) {
  const [first, ...rest] = html.split('\n');
  const indents = rest.filter(line => line.trim()).map(line => line.match(/^ */)[0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  return [first, ...rest.map(line => line.slice(common))].join('\n');
}

/** Affiche la valeur réelle du token pour le thème courant, sans la recopier. */
function inspectToken() {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token.value).trim();
  document.getElementById('token-value').textContent = value;
  document.getElementById('token-code').textContent =
    `.contribution {\n  ${TOKEN_PROPERTIES[token.value]}: var(${token.value});\n}`;
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

const buttonStatus = document.getElementById('button-status');
document.getElementById('primary').addEventListener('click', () => {
  announce(buttonStatus, 'Succès : action principale activée.', 'success');
});
document.getElementById('secondary').addEventListener('click', () => {
  announce(buttonStatus, 'Information : action secondaire activée.');
});

const spacing = document.getElementById('spacing');
/** Le curseur annonce sa valeur avec l'unité, comme le libellé visible. */
function syncSpacing() {
  document.getElementById('spacing-value').value = spacing.value;
  spacing.setAttribute('aria-valuetext', `${spacing.value} px`);
}
spacing.addEventListener('input', syncSpacing);
syncSpacing();

const form = document.getElementById('preview-form');
const formStatus = document.getElementById('form-status');
const title = document.getElementById('card-title');
// L'erreur ne reste pas affirmée pendant que la personne corrige sa saisie.
title.addEventListener('input', () => title.removeAttribute('aria-invalid'));
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!title.value.trim()) {
    // `required` laisse passer une chaîne d'espaces : la règle métier est vérifiée ici.
    title.setAttribute('aria-invalid', 'true');
    announce(formStatus, 'Erreur : saisir un titre qui ne contient pas seulement des espaces.', 'error');
    title.focus();
    return;
  }
  title.removeAttribute('aria-invalid');
  document.getElementById('preview-name').textContent = title.value.trim();
  document.getElementById('preview-description').textContent = document.getElementById('description').value;
  document.getElementById('preview-kind').textContent = document.getElementById('kind').value;
  document.getElementById('preview-state').textContent = `Statut : ${new FormData(form).get('status')}`;
  const preview = document.getElementById('preview');
  preview.style.padding = `${spacing.value}px`;
  preview.classList.toggle('compact', document.getElementById('compact').checked);
  announce(formStatus, 'Succès : la carte de prévisualisation a été mise à jour.', 'success');
});

const dialog = document.getElementById('inspector');
const opener = document.getElementById('open-dialog');
opener.addEventListener('click', () => {
  document.getElementById('card-code').textContent = dedent(document.getElementById('preview').outerHTML);
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
  // Laisser au navigateur le temps de lire le blob avant de libérer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(document.getElementById('download-status'), 'Téléchargement de contribution-token.css demandé au navigateur.');
});
