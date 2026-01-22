/**
 * Resolver Jest personnalisé pour gérer les imports TypeScript ESM
 *
 * TypeScript ESM requiert que les imports utilisent l'extension .js même pour
 * les fichiers .ts (car c'est le fichier transpilé qui sera chargé au runtime).
 * Ce resolver transforme les imports .js vers .ts quand le fichier .ts existe.
 */

const { existsSync } = require('fs');
const { resolve } = require('path');

/**
 * Résout un module en transformant les .js vers .ts si nécessaire
 */
module.exports = function customResolver(request, options) {
  // Utiliser le resolver par défaut de Jest
  const defaultResolver = options.defaultResolver;

  // Si c'est un import relatif avec .js, essayer .ts
  if (request.startsWith('.') && request.endsWith('.js')) {
    const tsRequest = request.replace(/\.js$/, '.ts');
    const basedir = options.basedir || process.cwd();
    const tsPath = resolve(basedir, tsRequest);

    // Vérifier si le fichier .ts existe
    if (existsSync(tsPath)) {
      try {
        return defaultResolver(tsRequest, options);
      } catch {
        // Si ça échoue, continuer avec le request original
      }
    }
  }

  // Fallback au resolver par défaut
  return defaultResolver(request, options);
};
