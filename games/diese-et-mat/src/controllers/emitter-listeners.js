/**
 * Abonnement d'un contrôleur aux événements d'un émetteur.
 *
 * @module controllers/emitter-listeners
 */

/**
 * Abonne chaque gestionnaire et enregistre sa fonction de désabonnement.
 *
 * @param {{on: Function, off: Function}} emitter - Émetteur observé
 * @param {Array<[string, Function]>} handlers - Couples [événement, gestionnaire]
 * @param {Function[]} cleanupHandlers - Liste où ajouter les désabonnements
 */
export function listenWithCleanup(emitter, handlers, cleanupHandlers) {
  for (const [event, handler] of handlers) {
    emitter.on(event, handler);
    cleanupHandlers.push(() => emitter.off(event, handler));
  }
}
