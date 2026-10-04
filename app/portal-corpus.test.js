/**
 * @jest-environment jsdom
 *
 * Corpus différentiel du portail : rend les vrais modules sur le vrai index.html
 * pour une grille d'états, puis compare le DOM obtenu à une sortie de référence
 * figée avant refactorisation (app/__tests__/fixtures/portal-corpus.golden.json).
 *
 * Régénération volontaire : PORTAL_CORPUS_WRITE=1 (à ne faire qu'après revue du diff).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const goldenUrl = new URL('./__tests__/fixtures/portal-corpus.golden.json', import.meta.url);

const { state, setState } = await import('./state.js');
const { el } = await import('./dom-cache.js');
const { renderParcours, createEpicCardElement, selectParcoursCategory } = await import('./parcours.js');
const { renderBookmarks, selectBookmarkTag } = await import('./bookmarks.js');
const { renderCatalogue, loadCatalogue, createCardElement, filterItems, getTagsForCurrentTab } = await import('./catalogue.js');
const { switchTab, updateTabUI, handleTabKeydown, registerRenderCallbacks } = await import('./tabs.js');
const { renderTagFilters, setDiscoveryCount, setDiscoveryMessage } = await import('../lib/catalogue-ui.js');
const dom = await import('../lib/dom.js');

const REGIONS = [
  'filters', 'parcoursCategoryFilters', 'bookmarkFilters', 'cardsParcours', 'parcoursCategoriesExpanded',
  'parcoursList', 'emptyParcours', 'cardsGames', 'cardsTools', 'emptyGames', 'emptyTools', 'bookmarkTree',
  'emptyBookmarks', 'catalogueStatus', 'resetDiscovery', 'searchLabel',
  'tabParcours', 'tabTools', 'tabGames', 'tabBookmarks',
];
const PANELS = ['panelParcours', 'panelTools', 'panelGames', 'panelBookmarks'];

/**
 * Décrit le DOM observable du portail (ids de cartes normalisés par ordre d'apparition).
 * @returns {string} Instantané lisible
 */
function snapshot() {
  const active = document.activeElement;
  const parts = REGIONS.map(name => `${name}: ${el[name].outerHTML}`);
  parts.push(...PANELS.map(name => `${name}: ${el[name].className}`));
  parts.push(`search: ${el.search.outerHTML} value=${JSON.stringify(el.search.value)}`);
  parts.push(`label: ${document.getElementById('discovery-filter-label').textContent}`);
  parts.push(`focus: ${active === document.body ? 'body' : `${active.tagName}#${active.id}.${active.className}[${active.dataset.tag ?? ''}|${active.dataset.category ?? ''}|${active.dataset.epicId ?? ''}]`}`);
  return parts.join('\n').replace(/epic-(title|progress)-\d+/g, 'epic-$1-N');
}

const epic = (id, extra = {}) => ({
  id, title: `Titre ${id}`, description: `Description ${id}`, path: `parcours/epics/${id}/epic.json`,
  slideCount: 4, ...extra,
});
const parcoursCatalogue = {
  taxonomy: { hierarchy: [
    { id: 'playlab42', label: 'PlayLab42', icon: '🧪' },
    { id: 'dev', label: 'Développement', icon: '💻', order: 5 },
    { id: 'data', label: 'Données', order: 2 },
  ] },
  epics: [
    epic('intro', { hierarchy: ['playlab42'], tags: ['contribution', 'ia', 'tests', 'quatrieme'], duration: '15 min',
      structure: [{ type: 'section' }, { type: 'slide' }, { type: 'section' }], icon: '🚀' }),
    epic('algo', { hierarchy: ['dev'], tags: ['développement', 'ia'], author: { name: 'Émilie' }, thumbnail: 'a/thumb.svg' }),
    epic('solo', { hierarchy: ['dev'], slideCount: 1, author: 'Zoé', structure: [{ type: 'section' }] }),
    epic('stats', { hierarchy: ['data'], tags: ['données'], slideCount: 0 }),
    epic('libre', { description: undefined }),
    epic('ghost', { hierarchy: ['inconnu'], author: null, tags: [] }),
  ],
};
const bookmarksCatalogue = {
  tags: [{ id: 'ide', label: 'IDE', count: 2 }, { id: 'cli' }],
  categories: [
    { id: 'coding', label: 'Coding', bookmarks: [
      { title: 'Cursor', displayTitle: 'Cursor enrichi', description: 'Éditeur', displayDescription: 'Enrichi',
        url: 'https://cursor.com/app', domain: 'cursor.com', tags: ['ide'] },
      { displayTitle: 'Titre seul', displayDescription: 'Desc enrichie', url: 'https://sans-domaine.example/x', tags: ['ide', 'cli'] },
    ] },
    { label: 'Sans identifiant', bookmarks: [
      { title: 'Aider', url: 'https://aider.chat', domain: 'aider.chat', tags: ['cli'] },
    ] },
    { id: 'vide', label: 'Catégorie vide', bookmarks: [] },
  ],
};
const toolsAndGames = {
  tools: [
    { id: 'json', name: 'JSON', icon: '🧾', description: 'Formater', path: 'tools/json.html', tags: ['dev', 'json', 'a', 'b'] },
    { id: 'plain', name: 'Plain', description: 'Sans icône', path: 'tools/plain.html' },
  ],
  games: [
    { id: 'chess', name: 'Échecs', icon: '♟️', description: 'Classique', path: 'games/chess/index.html', tags: ['solo'] },
    { id: 'go', name: 'Go', description: 'Territoire', path: 'games/go/index.html', tags: ['solo', 'duo'] },
  ],
};

const emptyState = {
  activeTab: 'parcours', activeFilter: '', parcoursCategory: null, bookmarkTagFilter: null, currentView: 'catalogue',
  catalogue: null, parcoursCatalogue: null, bookmarksCatalogue: null,
};

function reset() {
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.clear();
  document.activeElement?.blur();
  setState({ ...emptyState });
  el.search.value = '';
  for (const name of ['filters', 'parcoursCategoryFilters', 'bookmarkFilters', 'cardsParcours',
    'parcoursCategoriesExpanded', 'cardsGames', 'cardsTools', 'bookmarkTree']) {
    el[name].textContent = '';
  }
  for (const name of ['emptyParcours', 'emptyGames', 'emptyTools', 'emptyBookmarks']) {
    el[name].textContent = '';
    el[name].removeAttribute('role');
    el[name].className = el[name].className.replace(/\bvisible\b/g, '').trim();
  }
  el.parcoursList.removeAttribute('style');
  el.parcoursCategoriesExpanded.removeAttribute('style');
  el.catalogueStatus.textContent = '';
  updateTabUI();
}

const progress = value => localStorage.setItem('parcours-progress', JSON.stringify(value));
const search = text => { el.search.value = text; };
const focusSelector = selector => document.querySelector(selector)?.focus();

/** Chaque scénario prépare un état, appelle l'API publique, puis retourne l'instantané. */
const scenarios = {};
const add = (name, run) => { scenarios[name] = run; };

// --- Parcours ---
const parcoursCases = {
  'catalogue-absent': {},
  'catalogue-vide': { catalogue: { epics: [] } },
  'accueil': { catalogue: parcoursCatalogue },
  'accueil-sans-taxonomie': { catalogue: { epics: parcoursCatalogue.epics } },
  'recherche-titre': { catalogue: parcoursCatalogue, search: 'titre algo' },
  'recherche-auteur-objet': { catalogue: parcoursCatalogue, search: 'emilie' },
  'recherche-auteur-texte': { catalogue: parcoursCatalogue, search: 'zoe' },
  'recherche-tags': { catalogue: parcoursCatalogue, search: 'données' },
  'recherche-sans-resultat': { catalogue: parcoursCatalogue, search: 'zzz' },
  'categorie-dev': { catalogue: parcoursCatalogue, category: 'dev' },
  'categorie-autres': { catalogue: parcoursCatalogue, category: 'autres' },
  'categorie-playlab': { catalogue: parcoursCatalogue, category: 'playlab42' },
  'categorie-inconnue-active': { catalogue: parcoursCatalogue, category: 'absente' },
  'tag-ia': { catalogue: parcoursCatalogue, tag: 'ia' },
  'tag-et-categorie': { catalogue: parcoursCatalogue, tag: 'ia', category: 'dev' },
  'tag-sans-epic': { catalogue: parcoursCatalogue, tag: 'zzz' },
  'progression-partielle': { catalogue: parcoursCatalogue, progress: { algo: { visited: ['a', 'a', 'b'] }, solo: { visited: [] } } },
  'progression-terminee': { catalogue: parcoursCatalogue, progress: { intro: { visited: ['1', '2', '3', '4', '5'] }, algo: { visited: ['a'] } } },
  'progression-liste-visitee-absente': { catalogue: parcoursCatalogue, progress: { algo: {} } },
  'progression-recherche': { catalogue: parcoursCatalogue, search: 'titre', progress: { algo: { visited: ['a'] } } },
  'onglet-inactif': { catalogue: parcoursCatalogue, tab: 'games' },
};
for (const [name, c] of Object.entries(parcoursCases)) {
  add(`parcours/${name}`, () => {
    setState({ activeTab: c.tab || 'parcours', parcoursCatalogue: c.catalogue || null,
      parcoursCategory: c.category || null, activeFilter: c.tag || '' });
    search(c.search || '');
    if (c.progress) { progress(c.progress); }
    renderParcours();
    return snapshot();
  });
}
add('parcours/focus-carte-conservee', () => {
  setState({ parcoursCatalogue });
  renderParcours();
  focusSelector('[data-epic-id="algo"]');
  renderParcours();
  return snapshot();
});
add('parcours/focus-filtre-categorie', () => {
  setState({ parcoursCatalogue });
  renderParcours();
  focusSelector('[data-category="dev"]');
  selectParcoursCategory('dev');
  return snapshot();
});
add('parcours/selection-puis-retour-tous', () => {
  setState({ parcoursCatalogue });
  selectParcoursCategory('data');
  const first = snapshot();
  selectParcoursCategory(null);
  return `${first}\n=====\n${snapshot()}`;
});
add('parcours/vignette-erreur-repli', () => {
  setState({ parcoursCatalogue });
  renderParcours();
  const img = el.parcoursCategoriesExpanded.querySelector('.epic-thumb img');
  img.dispatchEvent(new Event('error'));
  return `${snapshot()}\nimg: ${img.outerHTML}`;
});
for (const [name, value] of Object.entries({
  complet: parcoursCatalogue.epics[0], minimal: { id: 'm', path: 'p', slideCount: 1 },
  'sans-slides': { id: 'z', path: 'p', title: 'Z', slideCount: 0 },
  'structure-section-unique': { id: 's', path: 'p', title: 'S', slideCount: 2, structure: [{ type: 'section' }] },
  'tags-vides': { id: 't', path: 'p', title: 'T', slideCount: 2, tags: [] },
  'vignette-sans-icone': { id: 'v', path: 'p', title: 'V', slideCount: 2, thumbnail: 'v.png' },
})) {
  add(`parcours/carte-${name}`, () => {
    localStorage.clear();
    const host = document.createElement('div');
    host.appendChild(createEpicCardElement(value));
    return host.innerHTML.replace(/epic-(title|progress)-\d+/g, 'epic-$1-N');
  });
}

// --- Bookmarks ---
const bookmarkCases = {
  'catalogue-absent': {},
  'catalogue-absent-onglet-autre': { tab: 'tools' },
  'catalogue-sans-lien': { catalogue: { categories: [{ label: 'x', bookmarks: [] }] } },
  'catalogue-sans-tags': { catalogue: { categories: bookmarksCatalogue.categories } },
  'complet': { catalogue: bookmarksCatalogue },
  'recherche-domaine': { catalogue: bookmarksCatalogue, search: 'cursor.com' },
  'recherche-categorie': { catalogue: bookmarksCatalogue, search: 'sans identifiant' },
  'recherche-titre-enrichi': { catalogue: bookmarksCatalogue, search: 'enrichi' },
  'recherche-sans-resultat': { catalogue: bookmarksCatalogue, search: 'zzz' },
  'tag-ide': { catalogue: bookmarksCatalogue, tag: 'ide' },
  'tag-cli': { catalogue: bookmarksCatalogue, tag: 'cli' },
  'tag-et-recherche': { catalogue: bookmarksCatalogue, tag: 'cli', search: 'aider' },
  'tag-inconnu': { catalogue: bookmarksCatalogue, tag: 'zzz' },
  'onglet-inactif': { catalogue: bookmarksCatalogue, tab: 'tools' },
};
for (const [name, c] of Object.entries(bookmarkCases)) {
  add(`bookmarks/${name}`, () => {
    setState({ activeTab: c.tab || 'bookmarks', bookmarksCatalogue: c.catalogue || null, bookmarkTagFilter: c.tag || null });
    search(c.search || '');
    renderBookmarks();
    return snapshot();
  });
}
add('bookmarks/navigation-clic', () => {
  setState({ activeTab: 'bookmarks', bookmarksCatalogue: bookmarksCatalogue });
  renderBookmarks();
  const details = el.bookmarkTree.querySelector('details');
  details.open = true;
  el.bookmarkTree.querySelector('.bookmark-navigation-link:last-child').click();
  return `${snapshot()}\nopen=${details.open}`;
});
add('bookmarks/selection-tag-puis-vide', () => {
  setState({ activeTab: 'bookmarks', bookmarksCatalogue });
  focusSelector('#bookmark-filters button');
  selectBookmarkTag('ide');
  const first = snapshot();
  selectBookmarkTag('');
  return `${first}\n=====\n${snapshot()}`;
});

// --- Catalogue ---
const catalogueCases = {
  'outils': { tab: 'tools' }, 'jeux': { tab: 'games' },
  'outils-tag': { tab: 'tools', tag: 'json' }, 'jeux-tag': { tab: 'games', tag: 'solo' },
  'outils-recherche': { tab: 'tools', search: 'format' }, 'jeux-recherche': { tab: 'games', search: 'echecs' },
  'outils-sans-resultat': { tab: 'tools', search: 'zzz' }, 'jeux-sans-resultat': { tab: 'games', search: 'zzz' },
  'outils-vide': { tab: 'tools', catalogue: { tools: [], games: [] } },
  'jeux-vide': { tab: 'games', catalogue: { tools: [], games: [] } },
  'onglet-inactif': { tab: 'bookmarks' },
};
for (const [name, c] of Object.entries(catalogueCases)) {
  add(`catalogue/${name}`, () => {
    setState({ activeTab: c.tab, catalogue: c.catalogue || toolsAndGames, activeFilter: c.tag || '' });
    search(c.search || '');
    renderCatalogue();
    return snapshot();
  });
}
add('catalogue/non-charge', () => {
  setState({ activeTab: 'tools', catalogue: null });
  renderCatalogue();
  return snapshot();
});
add('catalogue/tags-par-onglet', () => {
  setState({ catalogue: toolsAndGames, activeTab: 'tools' });
  const tools = getTagsForCurrentTab();
  setState({ activeTab: 'games' });
  const games = getTagsForCurrentTab();
  setState({ catalogue: null });
  return JSON.stringify({ tools, games, none: getTagsForCurrentTab() });
});
add('catalogue/filtrage-direct', () => {
  setState({ activeFilter: 'solo' });
  search('go');
  const kept = filterItems(toolsAndGames.games).map(item => item.id);
  setState({ activeFilter: '' });
  return JSON.stringify({ kept, all: filterItems(toolsAndGames.tools).map(item => item.id) });
});
for (const [name, args] of Object.entries({
  jeu: [toolsAndGames.games[0], 'game'], 'jeu-sans-icone': [toolsAndGames.games[1], 'game'],
  outil: [toolsAndGames.tools[0], 'tool'], 'outil-sans-icone': [toolsAndGames.tools[1], 'tool'],
})) {
  add(`catalogue/carte-${name}`, () => {
    const host = document.createElement('div');
    host.appendChild(createCardElement(...args));
    host.querySelector('img').dispatchEvent(new Event('error'));
    return host.innerHTML;
  });
}
add('catalogue/chargement-ok', async () => {
  globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(toolsAndGames) }));
  setState({ activeTab: 'games' });
  await loadCatalogue();
  return snapshot();
});
add('catalogue/chargement-echec', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false }));
  setState({ activeTab: 'tools' });
  await loadCatalogue();
  const out = snapshot();
  console.error.mockRestore();
  return out;
});

// --- Onglets ---
const calls = [];
registerRenderCallbacks({
  renderCatalogue: () => calls.push('catalogue'),
  renderParcours: () => calls.push('parcours'),
  renderBookmarks: () => calls.push('bookmarks'),
});
for (const from of ['parcours', 'tools', 'games', 'bookmarks']) {
  for (const to of ['parcours', 'tools', 'games', 'bookmarks', 'invalide', '']) {
    add(`tabs/${from}-vers-${to || 'vide'}`, () => {
      setState({ activeTab: from, activeFilter: 'f', parcoursCategory: 'c', bookmarkTagFilter: 't' });
      search(to === 'games' ? 'texte' : '');
      calls.length = 0;
      switchTab(to);
      return `${snapshot()}\ncalls=${calls.join(',')}\nstate=${JSON.stringify([state.activeTab, state.activeFilter, state.parcoursCategory, state.bookmarkTagFilter])}\nprefs=${localStorage.getItem('preferences')}`;
    });
  }
}
for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Tab', 'Enter']) {
  for (const [start, index] of [['parcours', 0], ['bookmarks', 3]]) {
    add(`tabs/clavier-${key}-depuis-${start}`, () => {
      setState({ activeTab: start });
      updateTabUI();
      calls.length = 0;
      const tabs = [el.tabParcours, el.tabTools, el.tabGames, el.tabBookmarks];
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: tabs[index] });
      handleTabKeydown(event);
      return `${snapshot()}\nprevented=${event.defaultPrevented} calls=${calls.join(',')}`;
    });
  }
}
for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
  add(`tabs/clavier-modifie-${modifier}`, () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', [modifier]: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: el.tabParcours });
    handleTabKeydown(event);
    return `prevented=${event.defaultPrevented} tab=${state.activeTab}`;
  });
}
add('tabs/clavier-cible-etrangere', () => {
  const event = new KeyboardEvent('keydown', { key: 'Home', cancelable: true });
  Object.defineProperty(event, 'target', { value: el.search });
  handleTabKeydown(event);
  return `prevented=${event.defaultPrevented}`;
});
for (const query of ['', '  ', 'x']) {
  add(`tabs/reset-visible-recherche-${JSON.stringify(query)}`, () => {
    search(query);
    updateTabUI();
    return snapshot();
  });
}

// --- Filtres partagés et compteurs ---
const filterCases = {
  'liste-simple': { tags: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', count: 2 }], active: 'b' },
  'liste-vide': { tags: [], active: null },
  'actif-absent': { tags: [{ id: 'a', label: 'A', count: 0 }], active: 'zz' },
  'attribut-categorie': { tags: [{ id: 'a', label: 'A', count: 1 }], active: 'a', options: { attribute: 'category', allLabel: 'Tous les parcours' } },
};
for (const [name, c] of Object.entries(filterCases)) {
  add(`filtres/${name}`, () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderTagFilters(container, c.tags, c.active, c.options);
    const first = container.outerHTML;
    renderTagFilters(container, [...c.tags].reverse(), null, c.options);
    const second = container.outerHTML;
    container.remove();
    return `${first}\n${second}`;
  });
}
add('filtres/focus-puis-disparition', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderTagFilters(container, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 'a');
  container.querySelector('[data-tag="b"]').focus();
  renderTagFilters(container, [{ id: 'a', label: 'A' }], 'a');
  const out = `${container.outerHTML} focus=${document.activeElement.dataset.tag}`;
  container.remove();
  return out;
});
add('filtres/focus-conserve', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderTagFilters(container, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 'a');
  container.querySelector('[data-tag="b"]').focus();
  renderTagFilters(container, [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }], 'b');
  const out = `${container.outerHTML} focus=${document.activeElement.dataset.tag}`;
  container.remove();
  return out;
});
add('decouverte/compteurs', () => {
  const lines = [];
  for (const [count, noun] of [[0, 'parcours'], [1, 'parcours'], [1, 'outils'], [2, 'outils'], [1, 'jeux'],
    [1, 'ressources'], [1, 'liens'], [1, 'autres'], [3, 'autres']]) {
    setDiscoveryCount(count, noun);
    lines.push(el.catalogueStatus.textContent);
  }
  setDiscoveryMessage('État');
  lines.push(el.catalogueStatus.textContent);
  return lines.join('|');
});

// --- Utilitaires DOM ---
const markup = node => {
  const host = document.createElement('div');
  host.appendChild(node);
  return host.innerHTML;
};
let clicks = 0;
const createCases = {
  'balise-seule': ['p'],
  'classe-et-data': ['button', { class: 'btn big', 'data-id': '42', id: 'x' }, ['Cliquer']],
  'style-objet': ['div', { style: { color: 'red', paddingTop: '2px' } }],
  'style-texte': ['div', { style: 'color: blue' }],
  'evenement-fonction': ['button', { onClick: () => { clicks++; } }],
  'evenement-attribut-non-fonction': ['button', { onclick: 'alert(1)' }],
  'valeur-numerique-et-booleenne': ['input', { tabindex: 3, disabled: true, value: 0 }],
  'valeur-null': ['span', { title: null, lang: undefined }],
  'enfants-mixtes': ['div', {}, ['a', create('b'), 12, null, undefined, document.createTextNode('t'), '<i>']],
  'html-echappe': ['p', {}, ['<script>alert(1)</script>']],
};
function create(...args) { return dom.create(...args); }
for (const [name, args] of Object.entries(createCases)) {
  add(`dom/create-${name}`, () => markup(dom.create(...args)));
}
add('dom/create-evenement-declenche', () => {
  clicks = 0;
  const button = dom.create('button', { onClick: () => { clicks++; } });
  button.click();
  return `clicks=${clicks}`;
});
const templateCases = {
  'texte': { h3: 'Titre', p: 'Desc' },
  'attributs': { '.card-thumb': { class: 'x y', 'data-k': 'v', title: 'T' } },
  'textContent-innerText': { h3: { textContent: 'A' }, p: { innerText: 'B' } },
  'innerHTML-explicite': { p: { innerHTML: '<b>gras</b>' } },
  'selecteur-absent': { '.absent': 'x', h3: 'ok' },
  'valeur-null': { h3: null, p: undefined },
  'valeur-nombre': { h3: 12 },
  'melange': { h3: { textContent: 'T', class: 'c', lang: 'fr' } },
  'vide': {},
};
for (const [name, data] of Object.entries(templateCases)) {
  add(`dom/fill-${name}`, () => markup(dom.fillTemplate('card-template', data)));
}
add('dom/template-introuvable', () => {
  const warn = console.warn;
  const out = [markup(dom.cloneTemplate('absent')), markup(dom.fillTemplate('absent', { h3: 'x' })), warn.mock.calls.length];
  return JSON.stringify(out);
});
add('dom/echappement', () => JSON.stringify(
  [undefined, null, 5, '', 'a&b', '<a href="x">\'</a>'].map(value => dom.escapeHtml(value)),
));

describe('corpus différentiel du portail', () => {
  const golden = (() => {
    try { return JSON.parse(readFileSync(goldenUrl, 'utf8')); } catch { return {}; }
  })();
  const produced = {};

  beforeEach(reset);

  it.each(Object.keys(scenarios))('%s', async name => {
    produced[name] = await scenarios[name]();
    if (!process.env.PORTAL_CORPUS_WRITE) {
      expect(produced[name]).toBe(golden[name]);
    }
  });

  it('couvre exactement les scénarios de référence', () => {
    if (process.env.PORTAL_CORPUS_WRITE) {
      mkdirSync(new URL('./__tests__/fixtures/', import.meta.url), { recursive: true });
      writeFileSync(goldenUrl, `${JSON.stringify(produced, null, 1)}\n`);
      return;
    }
    expect(Object.keys(golden).sort()).toEqual(Object.keys(scenarios).sort());
    expect(Object.keys(scenarios).length).toBeGreaterThan(130);
  });
});
