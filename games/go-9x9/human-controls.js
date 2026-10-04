/**
 * Relie les commandes humaines au joueur actif, y compris en hot-seat.
 * @param {Object} options Dépendances de l'interface.
 * @param {Object} options.engine Moteur de Go.
 * @param {Function} options.getState Lecture de l'état courant.
 * @param {Function} options.setState Mise à jour de l'état courant.
 * @param {Function} options.hasBot Présence d'un adversaire automatique.
 * @param {string} options.humanId Identifiant humain en mode contre un bot.
 * @param {Function} options.onUpdate Rendu après une action.
 * @param {Function} options.onInvalid Annonce d'une action refusée.
 * @returns {{getPlayerId: Function, play: Function}} Commandes humaines.
 */
export function createHumanControls({ engine, getState, setState, hasBot, humanId, onUpdate, onInvalid }) {
  const getPlayerId = () => {
    const state = getState();
    if (!state || state.gameOver) {return null;}
    if (state.scoring) {return state.currentPlayerId;}
    return !hasBot() || state.currentPlayerId === humanId ? state.currentPlayerId : null;
  };
  return {
    getPlayerId,
    play(action) {
      const playerId = getPlayerId();
      if (playerId === null) {return false;}
      const state = getState();
      if (!engine.isValidAction(state, action, playerId)) {
        onInvalid(action);
        return false;
      }
      setState(engine.applyAction(state, action, playerId));
      onUpdate();
      return true;
    },
  };
}
