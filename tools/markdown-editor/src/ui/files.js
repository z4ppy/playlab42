/**
 * Entrées/sorties de fichiers : lecture d'un fichier choisi ou déposé,
 * téléchargement, copie dans le presse-papiers.
 * @module ui/files
 */

/** Taille maximale acceptée pour un fichier ouvert (5 Mo). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const reTextFile = /\.(?:md|markdown|mdown|mkd|mkdn|txt|text)$/i;

/**
 * Vérifie qu'un fichier ressemble à du Markdown lisible.
 * @param {File} file
 * @returns {string|null} Message d'erreur, ou null si le fichier est acceptable.
 */
export function rejectReason(file) {
  if (!reTextFile.test(file.name) && !/^text\//.test(file.type)) {
    return `« ${file.name} » n'est pas un fichier texte ou Markdown.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `« ${file.name} » dépasse 5 Mo.`;
  }
  return null;
}

/**
 * Lit un fichier texte.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function readTextFile(file) {
  const reason = rejectReason(file);
  if (reason) {
    throw new Error(reason);
  }
  const text = typeof file.text === 'function' ? await file.text() : await readWithFileReader(file);
  // Retire l'éventuelle marque d'ordre des octets et normalise les fins de ligne.
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/**
 * Lecture par FileReader, pour les environnements sans `Blob.text()`.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readWithFileReader(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Lecture de « ${file.name} » impossible.`));
    reader.readAsText(file);
  });
}

/**
 * Propose le téléchargement d'un contenu.
 * @param {Document} doc
 * @param {string} content
 * @param {string} fileName
 * @param {string} type - Type MIME.
 */
export function downloadText(doc, content, fileName, type) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copie un texte dans le presse-papiers (API moderne, sinon sélection).
 * @param {Document} doc
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(doc, text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'mde-mirror';
    doc.body.append(area);
    area.select();
    const copied = execCopy(doc);
    area.remove();
    return copied;
  }
}

/**
 * Copie la sélection courante (méthode historique).
 * @param {Document} doc
 * @returns {boolean}
 */
function execCopy(doc) {
  try {
    return doc.execCommand('copy');
  } catch {
    return false;
  }
}
