#!/usr/bin/env node
/**
 * Génère une contribution depuis les gabarits, sans écraser de fichiers.
 * Les contenus sont tous rendus et validés avant la création du dossier final.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidId } from './lib/build-utils.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINATIONS = { game: ['games'], tool: ['tools'], epic: ['parcours', 'epics'] };
export const USAGE = 'node scripts/scaffold.js <game|tool|epic> <id-kebab-case> --title "Titre"';

function assertContributionMetadata(id, title) {
  if (!isValidId(id) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id.length > 64) {
    throw new Error('Identifiant invalide : 1 à 64 caractères, lettre initiale, minuscules, chiffres et tirets simples.');
  }
  if (typeof title !== 'string' || !title.trim() || title !== title.trim()
    || title.length > 120 || /\p{Cc}/u.test(title)) {
    throw new Error('Titre invalide : 1 à 120 caractères, sans contrôle ni espaces aux extrémités.');
  }
}

/**
 * Valide la ligne de commande, sans accès au disque.
 * @param {string[]} args Arguments sans le nom de l'exécutable.
 * @returns {{type: string, id: string, title: string}} Options validées.
 */
export function parseArgs(args) {
  if (args.length !== 4 || args[2] !== '--title') {
    throw new Error(`Usage : ${USAGE}`);
  }
  const [type, id, , title] = args;
  if (!Object.hasOwn(DESTINATIONS, type)) {
    throw new Error('Type invalide : choisir game, tool ou epic.');
  }
  assertContributionMetadata(id, title);
  return { type, id, title };
}

/**
 * Inspecte aussi les liens symboliques cassés ; seule l'absence est tolérée.
 * @param {string} path Chemin à inspecter.
 * @returns {import('node:fs').Stats|null} Métadonnées ou absence.
 */
function inspect(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') { return null; }
    throw error;
  }
}

/**
 * Échappe un texte destiné au contenu HTML, jamais à du JavaScript.
 * @param {string} value Texte brut.
 * @returns {string} Texte HTML sûr.
 */
function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

/**
 * Prépare récursivement les fichiers .tpl, dans un ordre stable.
 * @param {string} directory Dossier des gabarits.
 * @param {{id: string, title: string}} options Valeurs validées.
 * @param {string} [prefix] Chemin relatif dans la contribution.
 * @returns {{path: string, content: string}[]} Fichiers prêts à écrire.
 */
function renderAssets(directory, options, prefix = '') {
  const assets = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) {
      assets.push(...renderAssets(join(directory, entry.name), options, path));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.tpl')) {
      throw new Error(`Gabarit inattendu : ${path}. Seuls les fichiers .tpl et dossiers sont autorisés.`);
    }
    const output = path.slice(0, -4);
    const values = {
      ID: options.id,
      TITLE_HTML: escapeHtml(options.title),
      TITLE_JSON: JSON.stringify(options.title),
    };
    const content = readFileSync(join(directory, entry.name), 'utf8').replace(
      /\{\{([A-Z_]+)\}\}/g,
      (_match, key) => {
        if (!Object.hasOwn(values, key)) {
          throw new Error(`Variable inconnue ${key} dans ${path}. Corriger le gabarit.`);
        }
        return values[key];
      },
    );
    if (output.endsWith('.json')) { JSON.parse(content); }
    assets.push({ path: output, content });
  }
  return assets;
}

function scaffoldParent(root, type) {
  let parent = realpathSync(root);
  for (const segment of DESTINATIONS[type]) {
    parent = join(parent, segment);
    const stat = inspect(parent);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Destination non sûre : ${parent}. Utiliser un dossier réel, sans lien symbolique.`);
    }
  }
  return parent;
}

/**
 * Crée une contribution ; la racine optionnelle sert aux tests isolés.
 * Refuse les liens symboliques dans toute la destination et réserve le dossier
 * avec mkdir exclusif. Un échec d'écriture supprime seulement ce dossier réservé.
 * @param {string[]} args Arguments de la CLI.
 * @param {{root?: string, templates?: string}} [options] Racines de travail.
 * @returns {string} Chemin absolu de la contribution créée.
 */
export function scaffold(args, { root = ROOT, templates = join(ROOT, 'templates') } = {}) {
  const config = parseArgs(args);
  const assets = renderAssets(join(templates, config.type), config);
  if (!assets.length) { throw new Error('Gabarit vide : ajouter les fichiers .tpl avant de générer.'); }
  const parent = scaffoldParent(root, config.type);
  const destination = join(parent, config.id);
  const collisions = [destination];
  if (config.type === 'tool') {
    collisions.push(join(parent, `${config.id}.html`), join(parent, `${config.id}.json`));
  }
  for (const path of collisions) {
    if (inspect(path)) {
      throw new Error(`Collision : ${path} existe déjà. Choisir un autre identifiant ; aucun fichier n'a été écrasé.`);
    }
  }
  mkdirSync(parent, { recursive: true });
  // mkdir sans recursive réserve la destination, même face à une création concurrente.
  mkdirSync(destination);
  let complete = false;
  try {
    for (const asset of assets) {
      const path = join(destination, asset.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, asset.content, { flag: 'wx' });
    }
    complete = true;
  } finally {
    if (!complete) { rmSync(destination, { recursive: true }); }
  }
  return destination;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  // Frontière CLI : toute erreur est affichée et produit un code de sortie non nul.
  try {
    const destination = scaffold(process.argv.slice(2));
    console.log(`Contribution créée : ${destination}`);
  } catch (error) {
    console.error(`Scaffold : ${error.message}`);
    process.exitCode = 1;
  }
}
