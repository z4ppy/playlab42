/**
 * Validations pures du contrôle de publication : aucune requête réseau ici.
 */

const FULL_SHA = /^[a-f\d]{40}$/i;
const SLIDE_ID = /^[a-z\d][a-z\d-]*$/;

/**
 * Valide l'URL du site et la normalise avec un slash final (sous-chemin Pages).
 * @param {string} baseURL URL fournie.
 * @param {string|null} expectedCommit SHA attendu ; null pour un build local.
 * @returns {URL} URL de base normalisée.
 */
export function validateTarget(baseURL, expectedCommit) {
  const base = new URL(baseURL);
  if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash || base.username || base.password) {
    throw new Error('URL de publication invalide : utiliser HTTP(S), sans identifiants, requête ou fragment.');
  }
  if (expectedCommit !== null && !FULL_SHA.test(expectedCommit)) {
    throw new Error('Le commit attendu doit être un SHA Git complet.');
  }
  if (!base.pathname.endsWith('/')) {base.pathname += '/';}
  return base;
}

/**
 * Indique si l'identité publiée a une version non vide et un SHA complet ou nul.
 * @param {object} identity Contenu de build-info.json.
 * @returns {boolean} Vrai si la forme est valide.
 */
function hasValidIdentityShape(identity) {
  const commit = identity?.commit;
  const validCommit = commit === null || (typeof commit === 'string' && FULL_SHA.test(commit));
  return Boolean(identity) && typeof identity.version === 'string' && Boolean(identity.version) && validCommit;
}

/**
 * Vérifie la forme de l'identité publiée puis sa correspondance avec le commit attendu.
 * @param {object} identity Contenu de build-info.json.
 * @param {string|null} expectedCommit SHA attendu ; null pour ne rien exiger.
 * @returns {void}
 */
export function validateIdentity(identity, expectedCommit) {
  if (!hasValidIdentityShape(identity)) {throw new Error('Identité du build absente ou invalide.');}
  if (expectedCommit && identity.commit?.toLowerCase() !== expectedCommit.toLowerCase()) {
    throw new Error(`Commit publié différent : attendu ${expectedCommit}, reçu ${identity.commit}.`);
  }
}

/**
 * Vérifie le contenu attendu indépendamment du graphe Git (merge squash possible).
 * @param {object} manifest Manifeste publié.
 * @param {object} identity Identité publiée.
 * @param {object} expectedInputs Empreintes des sources attendues.
 * @returns {void}
 */
export function checkPublishedManifest(manifest, identity, expectedInputs) {
  if (manifest?.formatVersion !== 1 || manifest.commit !== identity.commit
    || manifest.version !== identity.version || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('Manifeste de fabrication publié absent ou incohérent.');
  }
  for (const [name, hash] of Object.entries(expectedInputs)) {
    if (manifest.inputs?.[name] !== hash) {
      throw new Error(`Contenu publié différent des sources attendues : ${name}.`);
    }
  }
}

/**
 * Exige des listes non vides dans les trois catalogues publiés.
 * @param {object} catalogue Contenu de data/catalogue.json.
 * @param {object} parcours Contenu de data/parcours.json.
 * @param {object} bookmarks Contenu de data/bookmarks.json.
 * @returns {void}
 */
export function validateCatalogues(catalogue, parcours, bookmarks) {
  for (const [name, items] of [
    ['tools', catalogue?.tools], ['games', catalogue?.games],
    ['epics', parcours?.epics], ['categories', bookmarks?.categories],
  ]) {
    if (!Array.isArray(items) || !items.length) {throw new Error(`Catalogue invalide ou vide : ${name}`);}
  }
}

/**
 * Cherche en profondeur la première slide d'une structure de parcours.
 * @param {object[]} structure Sections et slides du parcours.
 * @returns {object|undefined} Première slide trouvée.
 */
function findFirstSlide(structure) {
  const entries = [...structure];
  while (entries.length) {
    const entry = entries.shift();
    if (!entry || typeof entry !== 'object') {throw new Error('Entrée de parcours invalide.');}
    if (entry.type === 'slide') {return entry;}
    if (Array.isArray(entry.children)) {entries.unshift(...entry.children);}
  }
  return undefined;
}

/**
 * Retourne l'identifiant de la première slide, en parcourant les sections en profondeur.
 * @param {object} epic Premier parcours publié.
 * @returns {string} Identifiant validé de slide.
 */
export function findFirstSlideId(epic) {
  if (!epic || typeof epic.path !== 'string' || !Array.isArray(epic.structure)) {
    throw new Error('Structure du premier parcours invalide.');
  }
  const slide = findFirstSlide(epic.structure);
  if (!slide?.id || !SLIDE_ID.test(slide.id)) {
    throw new Error('Le premier parcours ne contient aucune slide valide.');
  }
  return slide.id;
}
