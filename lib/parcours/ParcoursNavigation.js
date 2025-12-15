/**
 * Gestion de la navigation dans un parcours
 */

const PRELOAD_ADJACENT = 1; // Nombre de slides à pré-charger

export class ParcoursNavigation {
  /**
   * @param {Object} epic - Epic chargé
   * @param {Array} slides - Liste plate des slides
   * @param {ParcoursProgress} progress - Gestionnaire de progression
   * @param {Function} onSlideChange - Callback appelé quand on change de slide
   */
  constructor(epic, slides, progress, onSlideChange) {
    this.epic = epic;
    this.slides = slides;
    this.progress = progress;
    this.onSlideChange = onSlideChange;
    this.currentIndex = 0;
  }

  /**
   * Va à la slide précédente
   */
  prev() {
    if (this.currentIndex > 0) {
      this.goTo(this.currentIndex - 1);
    }
  }

  /**
   * Va à la slide suivante
   */
  next() {
    if (this.currentIndex < this.slides.length - 1) {
      this.goTo(this.currentIndex + 1);
    }
  }

  /**
   * Va à une slide spécifique
   * @param {number} index
   */
  goTo(index) {
    if (index >= 0 && index < this.slides.length) {
      this.showSlide(index);
    }
  }

  /**
   * Affiche une slide
   * @param {number} index
   */
  showSlide(index) {
    if (index < 0 || index >= this.slides.length) {return;}

    const slide = this.slides[index];
    this.currentIndex = index;

    // Mettre à jour l'URL
    const newHash = `#/parcours/${this.epic.id}/${slide.id}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }

    // Marquer comme visitée
    this.progress.markVisited(slide.id);

    // Pré-charger les slides adjacentes
    this.preloadAdjacent();

    // Callback
    this.onSlideChange(slide, index);
  }

  /**
   * Pré-charge les slides adjacentes
   */
  preloadAdjacent() {
    for (let i = 1; i <= PRELOAD_ADJACENT; i++) {
      // Suivante
      if (this.currentIndex + i < this.slides.length) {
        const nextSlide = this.slides[this.currentIndex + i];
        this.preloadSlide(nextSlide.id);
      }
      // Précédente
      if (this.currentIndex - i >= 0) {
        const prevSlide = this.slides[this.currentIndex - i];
        this.preloadSlide(prevSlide.id);
      }
    }
  }

  /**
   * Pré-charge une slide
   * @param {string} slideId
   */
  preloadSlide(slideId) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `${this.epic.path}/slides/${slideId}/index.html`;
    document.head.appendChild(link);
  }

  /**
   * Retourne la slide courante
   * @returns {Object}
   */
  getCurrentSlide() {
    return this.slides[this.currentIndex];
  }

  /**
   * Retourne l'index courant
   * @returns {number}
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Définit l'index courant
   * @param {number} index
   */
  setCurrentIndex(index) {
    this.currentIndex = index;
  }
}
