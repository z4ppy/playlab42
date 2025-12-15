/**
 * Gestion de la progression dans un parcours
 */

const STORAGE_KEY = 'parcours-progress';

export class ParcoursProgress {
  /**
   * @param {string} epicId - ID de l'epic
   */
  constructor(epicId) {
    this.epicId = epicId;
    this.data = { visited: [], current: null };
  }

  /**
   * Charge la progression depuis localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const all = JSON.parse(data);
        this.data = all[this.epicId] || { visited: [], current: null };
      }
    } catch {
      this.data = { visited: [], current: null };
    }
  }

  /**
   * Sauvegarde la progression dans localStorage
   */
  save() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const all = data ? JSON.parse(data) : {};
      all[this.epicId] = this.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Erreur sauvegarde progression:', e);
    }
  }

  /**
   * Marque une slide comme visitée
   * @param {string} slideId
   */
  markVisited(slideId) {
    if (!this.data.visited.includes(slideId)) {
      this.data.visited.push(slideId);
    }
    this.data.current = slideId;
    this.save();
  }

  /**
   * Vérifie si une slide a été visitée
   * @param {string} slideId
   * @returns {boolean}
   */
  isVisited(slideId) {
    return this.data.visited.includes(slideId);
  }

  /**
   * Retourne la slide courante
   * @returns {string|null}
   */
  getCurrentSlide() {
    return this.data.current;
  }
}
