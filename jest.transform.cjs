/**
 * Transformer Jest pour TypeScript, basé sur esbuild
 *
 * Remplace ts-jest, qui dépend des APIs internes du compilateur TypeScript et
 * se retrouve donc bloqué à chaque version majeure de TypeScript. esbuild se
 * contente de retirer les annotations de types, fichier par fichier : il ne
 * lit jamais le compilateur TypeScript, et reste donc compatible quelle que
 * soit la version installée.
 *
 * Conséquence assumée : ce transformer ne vérifie PAS les types pendant les
 * tests. Cette vérification est assurée séparément par `npm run typecheck`
 * (tsc --noEmit), lancé par le job « TypeScript » de la CI.
 *
 * Ce découpage est sûr parce que tsconfig.json active `isolatedModules: true` :
 * le projet garantit déjà que chaque fichier peut être transpilé isolément,
 * sans information de type venant des autres fichiers.
 *
 * @see jest.config.js pour le câblage
 * @see jest.resolver.cjs pour la résolution des imports .js -> .ts
 */

const { createHash } = require('crypto');
const { readFileSync } = require('fs');
const { transformSync, version: esbuildVersion } = require('esbuild');

// Empreinte de ce fichier, intégrée à la clé de cache (voir getCacheKey).
// Sans elle, modifier ce transformer laisserait Jest resservir du code
// instrumenté obsolète depuis son cache : les tests et la couverture
// refléteraient l'ancienne implémentation.
const EMPREINTE_TRANSFORMER = createHash('sha1')
  .update(readFileSync(__filename))
  .digest('hex');

// Options de transpilation, alignées sur tsconfig.json (target ES2022, ESM).
// Jest tourne en mode ESM natif (--experimental-vm-modules), la sortie doit
// donc conserver les import/export plutôt que d'être convertie en CommonJS.
const OPTIONS_ESBUILD = {
  loader: 'ts',
  format: 'esm',
  target: 'es2022',
  // Sourcemap externe, retournée à Jest via la clé `map` de process().
  // Indispensable : Jest s'en sert pour remonter les traces d'erreur au
  // fichier .ts d'origine, mais aussi pour rattacher la couverture de code aux
  // lignes du source. Une sourcemap inlinée dans le code ne serait pas lue, et
  // les fichiers .ts disparaîtraient du rapport de couverture.
  sourcemap: true,
};

module.exports = {
  /**
   * Transpile un fichier TypeScript en JavaScript ESM
   *
   * @param {string} sourceText - Contenu du fichier source
   * @param {string} sourcePath - Chemin du fichier, utilisé pour les sourcemaps
   * @returns {{code: string, map: object}} Code transpilé et sa sourcemap
   */
  process(sourceText, sourcePath) {
    const { code, map } = transformSync(sourceText, {
      ...OPTIONS_ESBUILD,
      sourcefile: sourcePath,
    });

    // esbuild renvoie la sourcemap sérialisée en JSON, alors que
    // babel-plugin-istanbul — utilisé par Jest pour instrumenter la couverture
    // — attend un objet. Sans ce parse, la couverture serait rapportée sur les
    // lignes du code transpilé au lieu de celles du fichier .ts.
    return { code, map: JSON.parse(map) };
  },

  /**
   * Clé de cache d'un fichier transformé
   *
   * Inclut la version d'esbuild, les options de transpilation et le contenu de
   * ce fichier : toute évolution de la transformation invalide donc
   * automatiquement le cache, au lieu de resservir du code obsolète.
   *
   * @param {string} sourceText - Contenu du fichier source
   * @param {string} sourcePath - Chemin du fichier
   * @returns {string} Empreinte SHA-1
   */
  getCacheKey(sourceText, sourcePath) {
    return createHash('sha1')
      .update(esbuildVersion)
      .update('\0')
      .update(JSON.stringify(OPTIONS_ESBUILD))
      .update('\0')
      .update(EMPREINTE_TRANSFORMER)
      .update('\0')
      .update(sourcePath)
      .update('\0')
      .update(sourceText)
      .digest('hex');
  },
};
