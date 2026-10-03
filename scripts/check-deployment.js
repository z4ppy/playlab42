/**
 * Contrôle HTTP de publication, sans prétendre remplacer les interactions navigateur.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile } from './lib/artifact-inventory.js';
import { getRootDir } from './lib/build-utils.js';
import { createResourceReader } from './lib/deployment-resources.js';
import {
  checkPublishedManifest, findFirstSlideId, validateCatalogues, validateIdentity, validateTarget,
} from './lib/deployment-validators.js';

/**
 * Vérifie le commit, les catalogues et quelques ressources de la publication.
 * @param {string} baseURL URL du site, avec son éventuel sous-chemin Pages.
 * @param {string|null} expectedCommit SHA attendu ; null pour un build local.
 * @param {object} expectedInputs Empreintes des entrées de fabrication attendues.
 * @returns {Promise<{version: string, commit: string|null, checked: number}>} Résultat vérifié.
 */
export async function checkDeployment(baseURL, expectedCommit = null, expectedInputs = {}) {
  const { read, count } = createResourceReader(validateTarget(baseURL, expectedCommit));
  const identity = await read('build-info.json', true);
  validateIdentity(identity, expectedCommit);
  checkPublishedManifest(await read('build-manifest.json', true), identity, expectedInputs);
  await read('index.html');
  await read('docs/site/index.html');
  const catalogue = await read('data/catalogue.json', true);
  const parcours = await read('data/parcours.json', true);
  const bookmarks = await read('data/bookmarks.json', true);
  validateCatalogues(catalogue, parcours, bookmarks);
  await read(catalogue.tools[0].path);
  await read(catalogue.games[0].path);
  const epic = parcours.epics[0];
  const slideId = findFirstSlideId(epic);
  await read(`${epic.path}/slides/${slideId}/index.html`);
  return { ...identity, checked: count() };
}

/**
 * Exécute l'interface en ligne de commande.
 * @param {string[]} argv Arguments Node : exécutable, script, URL, SHA optionnel.
 * @param {{log: Function, error: Function}} io Sorties standard et d'erreur.
 * @returns {Promise<number>} Code de sortie.
 */
export async function runCli(argv, io = console) {
  if (argv.length < 3 || argv.length > 4) {
    io.error('Usage : node scripts/check-deployment.js <url-du-site> [sha-attendu]');
    return 1;
  }
  try {
    const root = getRootDir(import.meta.url);
    const result = await checkDeployment(argv[2], argv[3] || null, {
      packageLock: hashFile(resolve(root, 'package-lock.json')),
      ogSnapshot: hashFile(resolve(root, 'metadata/bookmarks-og.json')),
    });
    io.log(`Publication vérifiée : ${result.version}, commit ${result.commit ?? 'local'}, ${result.checked} ressources.`);
    return 0;
  } catch (error) {
    io.error(`Contrôle de publication échoué : ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv);
}
