/**
 * Lecture HTTP bornée au site publié : origine et sous-chemin sont imposés.
 */

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Résout un chemin du catalogue et refuse tout ce qui sort du site publié.
 * @param {URL} base URL de base normalisée.
 * @param {unknown} path Chemin relatif lu dans les données publiées.
 * @returns {URL} URL absolue dans le site.
 */
export function resolveResourceURL(base, path) {
  if (typeof path !== 'string' || !path) {throw new Error('Chemin de ressource absent du catalogue.');}
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error(`Ressource hors du site publié : ${path}`);
  }
  return url;
}

/**
 * Télécharge une ressource en transformant tout échec en erreur explicite.
 * @param {URL} url Ressource à lire.
 * @returns {Promise<Response>} Réponse HTTP réussie.
 */
async function fetchOk(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: 'no-store' });
  } catch (error) {
    throw new Error(`Ressource indisponible : ${url} (${error.message})`, { cause: error });
  }
  if (!response.ok) {throw new Error(`HTTP ${response.status} : ${url}`);}
  return response;
}

/**
 * Lit le corps attendu : JSON, ou page HTML qui ne soit pas une erreur déguisée en HTTP 200.
 * @param {Response} response Réponse réussie.
 * @param {URL} url Ressource lue.
 * @param {boolean} json Vrai pour décoder du JSON.
 * @returns {Promise<unknown>} Objet JSON ou texte HTML.
 */
async function readBody(response, url, json) {
  if (json) {
    try {return await response.json();}
    catch (error) {throw new Error(`JSON invalide : ${url}`, { cause: error });}
  }
  const text = await response.text();
  if (!/<(?:!doctype|html)\b/i.test(text)) {throw new Error(`Page HTML invalide : ${url}`);}
  return text;
}

/**
 * Crée un lecteur qui compte les ressources vérifiées avec succès (statut HTTP).
 * @param {URL} base URL de base normalisée.
 * @returns {{read: function(string, boolean=): Promise<unknown>, count: function(): number}} Lecteur.
 */
export function createResourceReader(base) {
  let checked = 0;
  return {
    async read(path, json = false) {
      const url = resolveResourceURL(base, path);
      const response = await fetchOk(url);
      checked++;
      return readBody(response, url, json);
    },
    count: () => checked,
  };
}
