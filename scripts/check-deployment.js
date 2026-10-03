/**
 * Contrôle HTTP de publication, sans prétendre remplacer les interactions navigateur.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile } from './lib/artifact-inventory.js';
import { getRootDir } from './lib/build-utils.js';

/**
 * Vérifie le contenu attendu indépendamment du graphe Git (merge squash possible).
 * @param {object} manifest Manifeste publié.
 * @param {object} identity Identité publiée.
 * @param {object} expectedInputs Empreintes des sources attendues.
 * @returns {void}
 */
function checkPublishedManifest(manifest, identity, expectedInputs) {
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
 * Vérifie le commit, les catalogues et quelques ressources de la publication.
 * @param {string} baseURL URL du site, avec son éventuel sous-chemin Pages.
 * @param {string|null} expectedCommit SHA attendu ; null pour un build local.
 * @param {object} expectedInputs Empreintes des entrées de fabrication attendues.
 * @returns {Promise<{version: string, commit: string|null, checked: number}>} Résultat vérifié.
 */
export async function checkDeployment(baseURL, expectedCommit = null, expectedInputs = {}) {
  const base = new URL(baseURL);
  if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash || base.username || base.password) {
    throw new Error('URL de publication invalide : utiliser HTTP(S), sans identifiants, requête ou fragment.');
  }
  if (expectedCommit !== null && !/^[a-f\d]{40}$/i.test(expectedCommit)) {
    throw new Error('Le commit attendu doit être un SHA Git complet.');
  }
  if (!base.pathname.endsWith('/')) {base.pathname += '/';}
  let checked = 0;
  const resource = async (path, json = false) => {
    if (typeof path !== 'string' || !path) {throw new Error('Chemin de ressource absent du catalogue.');}
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new Error(`Ressource hors du site publié : ${path}`);
    }
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    } catch (error) {
      throw new Error(`Ressource indisponible : ${url} (${error.message})`, { cause: error });
    }
    if (!response.ok) {throw new Error(`HTTP ${response.status} : ${url}`);}
    checked++;
    if (json) {
      try {return await response.json();}
      catch (error) {throw new Error(`JSON invalide : ${url}`, { cause: error });}
    }
    const text = await response.text();
    if (!/<(?:!doctype|html)\b/i.test(text)) {throw new Error(`Page HTML invalide : ${url}`);}
    return text;
  };
  const identity = await resource('build-info.json', true);
  if (!identity || typeof identity.version !== 'string' || !identity.version
    || !(identity.commit === null || (typeof identity.commit === 'string' && /^[a-f\d]{40}$/i.test(identity.commit)))) {
    throw new Error('Identité du build absente ou invalide.');
  }
  if (expectedCommit && identity.commit?.toLowerCase() !== expectedCommit.toLowerCase()) {
    throw new Error(`Commit publié différent : attendu ${expectedCommit}, reçu ${identity.commit}.`);
  }
  checkPublishedManifest(await resource('build-manifest.json', true), identity, expectedInputs);
  await resource('index.html');
  await resource('docs/site/index.html');
  const catalogue = await resource('data/catalogue.json', true);
  const parcours = await resource('data/parcours.json', true);
  const bookmarks = await resource('data/bookmarks.json', true);
  for (const [name, items] of [
    ['tools', catalogue?.tools], ['games', catalogue?.games],
    ['epics', parcours?.epics], ['categories', bookmarks?.categories],
  ]) {
    if (!Array.isArray(items) || !items.length) {throw new Error(`Catalogue invalide ou vide : ${name}`);}
  }
  await resource(catalogue.tools[0].path);
  await resource(catalogue.games[0].path);
  const epic = parcours.epics[0];
  if (!epic || typeof epic.path !== 'string' || !Array.isArray(epic.structure)) {
    throw new Error('Structure du premier parcours invalide.');
  }
  const entries = [...epic.structure];
  let slide;
  while (entries.length && !slide) {
    const entry = entries.shift();
    if (!entry || typeof entry !== 'object') {throw new Error('Entrée de parcours invalide.');}
    if (entry.type === 'slide') {slide = entry;}
    else if (Array.isArray(entry.children)) {entries.unshift(...entry.children);}
  }
  if (!slide?.id || !/^[a-z\d][a-z\d-]*$/.test(slide.id)) {
    throw new Error('Le premier parcours ne contient aucune slide valide.');
  }
  await resource(`${epic.path}/slides/${slide.id}/index.html`);
  return { ...identity, checked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3 || process.argv.length > 4) {
    console.error('Usage : node scripts/check-deployment.js <url-du-site> [sha-attendu]');
    process.exitCode = 1;
  } else {
    try {
      const root = getRootDir(import.meta.url);
      const result = await checkDeployment(process.argv[2], process.argv[3] || null, {
        packageLock: hashFile(resolve(root, 'package-lock.json')),
        ogSnapshot: hashFile(resolve(root, 'metadata/bookmarks-og.json')),
      });
      console.log(`Publication vérifiée : ${result.version}, commit ${result.commit ?? 'local'}, ${result.checked} ressources.`);
    } catch (error) {
      console.error(`Contrôle de publication échoué : ${error.message}`);
      process.exitCode = 1;
    }
  }
}
