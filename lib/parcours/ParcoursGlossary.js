/**
 * Playlab42 - Gestionnaire de Glossaire pour Parcours
 * Gère le chargement, la fusion et l'affichage des définitions
 * @see openspec/changes/add-glossary-system/proposal.md
 */

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} short - Définition courte (tooltip)
 * @property {string} [long] - Définition longue (page glossaire)
 * @property {string[]} [see] - Termes liés
 * @property {string} [category] - Catégorie pour regroupement
 */

/**
 * @typedef {Object.<string, GlossaryEntry>} Glossary
 */

/**
 * Classe de gestion du glossaire
 */
export class ParcoursGlossary {
  /**
   * @param {string} epicId - ID de l'epic
   * @param {string} epicPath - Chemin vers le dossier de l'epic
   */
  constructor(epicId, epicPath) {
    /** @type {string} */
    this.epicId = epicId;

    /** @type {string} */
    this.epicPath = epicPath;

    /** @type {Glossary} */
    this.terms = {};

    /** @type {boolean} */
    this.loaded = false;

    /** @type {HTMLElement|null} */
    this._tooltipEl = null;

    /** @type {Function|null} */
    this._boundHideTooltip = null;
  }

  /**
   * Charge le glossaire (global + epic)
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loaded) {return;}

    // Charger le glossaire global (optionnel)
    // Utilise un chemin absolu depuis la racine du site
    const globalTerms = await this._loadGlossaryFile('/parcours/glossary.json');

    // Charger le glossaire de l'epic (optionnel)
    // epicPath peut être relatif (depuis une slide) ou absolu
    const epicTerms = await this._loadGlossaryFile(`${this.epicPath}/glossary.json`);

    // Fusionner : epic > global
    this.terms = { ...globalTerms, ...epicTerms };
    this.loaded = true;
  }

  /**
   * Charge un fichier glossaire JSON
   * @param {string} path - Chemin du fichier
   * @returns {Promise<Glossary>}
   * @private
   */
  async _loadGlossaryFile(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {return {};}

      const data = await response.json();
      // Support format { terms: {...} } ou directement {...}
      return data.terms || data;
    } catch {
      // Fichier non trouvé ou invalide
      return {};
    }
  }

  /**
   * Vérifie si un terme est défini
   * @param {string} term - Terme à vérifier (insensible à la casse)
   * @returns {boolean}
   */
  has(term) {
    return this._normalizeTerm(term) in this.terms;
  }

  /**
   * Récupère la définition d'un terme
   * @param {string} term - Terme à chercher
   * @returns {GlossaryEntry|undefined}
   */
  get(term) {
    return this.terms[this._normalizeTerm(term)];
  }

  /**
   * Liste tous les termes définis
   * @returns {string[]}
   */
  allTerms() {
    return Object.keys(this.terms);
  }

  /**
   * Liste les termes par catégorie
   * @returns {Object.<string, string[]>}
   */
  termsByCategory() {
    const categories = {};
    for (const [term, entry] of Object.entries(this.terms)) {
      const cat = entry.category || 'Autres';
      if (!categories[cat]) {categories[cat] = [];}
      categories[cat].push(term);
    }
    // Trier les termes dans chaque catégorie
    for (const terms of Object.values(categories)) {
      terms.sort((a, b) => a.localeCompare(b, 'fr'));
    }
    return categories;
  }

  /**
   * Normalise un terme pour la recherche
   * @param {string} term
   * @returns {string}
   * @private
   */
  _normalizeTerm(term) {
    return term.toLowerCase().trim();
  }

  /**
   * Attache les tooltips aux éléments <dfn> d'un conteneur
   * @param {HTMLElement} container
   */
  attachTooltips(container) {
    if (!container) {return;}

    const dfnElements = container.querySelectorAll('dfn, [data-term]');

    dfnElements.forEach(el => {
      const term = el.dataset.term || el.textContent;
      const entry = this.get(term);

      if (!entry) {
        console.warn(`[Glossary] Terme non défini: "${term}"`);
        return;
      }

      // Marquer comme terme avec définition
      el.classList.add('glossary-term');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-describedby', 'glossary-tooltip');

      // Event listeners
      el.addEventListener('mouseenter', (e) => this._showTooltip(e.target, entry, term));
      el.addEventListener('mouseleave', () => this._hideTooltip());
      el.addEventListener('focus', (e) => this._showTooltip(e.target, entry, term));
      el.addEventListener('blur', () => this._hideTooltip());

      // Support mobile (tap)
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this._tooltipEl && this._tooltipEl.style.opacity === '1') {
          this._hideTooltip();
        } else {
          this._showTooltip(e.target, entry, term);
        }
      });
    });

    // Fermer tooltip au clic ailleurs (mobile)
    this._boundHideTooltip = (e) => {
      if (this._tooltipEl && !e.target.closest('.glossary-term') && !e.target.closest('.glossary-tooltip')) {
        this._hideTooltip();
      }
    };
    document.addEventListener('click', this._boundHideTooltip);
  }

  /**
   * Détache les tooltips et nettoie
   */
  detachTooltips() {
    if (this._tooltipEl) {
      this._tooltipEl.remove();
      this._tooltipEl = null;
    }
    if (this._boundHideTooltip) {
      document.removeEventListener('click', this._boundHideTooltip);
      this._boundHideTooltip = null;
    }
  }

  /**
   * Affiche le tooltip pour un terme
   * @param {HTMLElement} targetEl
   * @param {GlossaryEntry} entry
   * @param {string} term
   * @private
   */
  _showTooltip(targetEl, entry, term) {
    // Créer ou réutiliser l'élément tooltip
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div');
      this._tooltipEl.id = 'glossary-tooltip';
      this._tooltipEl.className = 'glossary-tooltip';
      this._tooltipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(this._tooltipEl);
    }

    // Construire le contenu
    const seeAlso = entry.see?.length
      ? `<p class="glossary-tooltip-see">Voir aussi : ${entry.see.join(', ')}</p>`
      : '';

    this._tooltipEl.innerHTML = `
      <div class="glossary-tooltip-header">${this._escapeHtml(term)}</div>
      <p class="glossary-tooltip-short">${this._escapeHtml(entry.short)}</p>
      ${seeAlso}
    `;

    // Positionner le tooltip
    this._positionTooltip(targetEl);

    // Afficher avec animation
    requestAnimationFrame(() => {
      this._tooltipEl.style.opacity = '1';
      this._tooltipEl.style.transform = 'translateY(0)';
    });
  }

  /**
   * Positionne le tooltip près de l'élément cible
   * @param {HTMLElement} targetEl
   * @private
   */
  _positionTooltip(targetEl) {
    const tooltip = this._tooltipEl;
    const rect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Positionnement par défaut : au-dessus
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Si déborde en haut, mettre en-dessous
    if (top < 8) {
      top = rect.bottom + 8;
      tooltip.classList.add('glossary-tooltip--below');
    } else {
      tooltip.classList.remove('glossary-tooltip--below');
    }

    // Éviter débordement horizontal
    const maxLeft = window.innerWidth - tooltipRect.width - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(-4px)';
  }

  /**
   * Cache le tooltip
   * @private
   */
  _hideTooltip() {
    if (this._tooltipEl) {
      this._tooltipEl.style.opacity = '0';
      this._tooltipEl.style.transform = 'translateY(-4px)';
    }
  }

  /**
   * Échappe le HTML pour éviter les XSS
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Génère le HTML d'une page glossaire complète
   * @returns {string}
   */
  generateGlossaryPage() {
    const categories = this.termsByCategory();
    const categoryNames = Object.keys(categories).sort((a, b) => {
      // "Autres" en dernier
      if (a === 'Autres') {return 1;}
      if (b === 'Autres') {return -1;}
      return a.localeCompare(b, 'fr');
    });

    let html = '<div class="glossary-page">';

    for (const category of categoryNames) {
      const terms = categories[category];

      html += `
        <section class="glossary-category">
          <h3 class="glossary-category-title">${this._escapeHtml(category)}</h3>
          <dl class="glossary-list">
      `;

      for (const term of terms) {
        const entry = this.terms[term];
        const seeAlso = entry.see?.length
          ? `<p class="glossary-see">Voir aussi : ${entry.see.map(t =>
            `<a href="#term-${this._slugify(t)}" class="glossary-link">${this._escapeHtml(t)}</a>`,
          ).join(', ')}</p>`
          : '';

        html += `
          <div class="glossary-entry" id="term-${this._slugify(term)}">
            <dt class="glossary-term-title">${this._escapeHtml(term)}</dt>
            <dd class="glossary-definition">
              <p class="glossary-short">${this._escapeHtml(entry.short)}</p>
              ${entry.long ? `<p class="glossary-long">${this._escapeHtml(entry.long)}</p>` : ''}
              ${seeAlso}
            </dd>
          </div>
        `;
      }

      html += '</dl></section>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Convertit un terme en slug pour les ancres
   * @param {string} term
   * @returns {string}
   * @private
   */
  _slugify(term) {
    return term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
