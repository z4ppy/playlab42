import { DEFAULT_RENDER_CONFIG } from "./types.js";
class Renderer {
  canvas;
  ctx;
  config;
  /**
   * Crée un nouveau renderer
   * @param canvas - Élément canvas HTML
   * @param config - Configuration du rendu
   */
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Impossible d'obtenir le contexte 2D du canvas");
    }
    this.ctx = ctx;
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
  }
  /**
   * Efface le canvas (avec effet de traînée optionnel)
   */
  clear() {
    if (this.config.showTrails) {
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.config.trailOpacity})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  /**
   * Dessine toutes les particules
   * @param particles - Liste des particules à dessiner
   */
  drawParticles(particles) {
    const { particleRadius, colors } = this.config;
    for (const p of particles) {
      const color = colors[p.group % colors.length];
      this.ctx.fillStyle = this.hslToString(color);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  /**
   * Dessine une frame complète
   * @param particles - Particules à dessiner
   */
  render(particles) {
    this.clear();
    this.drawParticles(particles);
  }
  /**
   * Convertit une couleur HSL en chaîne CSS
   */
  hslToString(color) {
    return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
  }
  /**
   * Redimensionne le canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
  /**
   * Met à jour la configuration de rendu
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
  /**
   * Retourne la configuration actuelle
   */
  getConfig() {
    return this.config;
  }
  /**
   * Retourne les couleurs configurées
   */
  getColors() {
    return this.config.colors;
  }
  /**
   * Définit les couleurs des groupes
   */
  setColors(colors) {
    this.config.colors = colors;
  }
  /**
   * Active/désactive les traînées
   */
  setTrails(enabled) {
    this.config.showTrails = enabled;
  }
  /**
   * Définit l'opacité des traînées
   */
  setTrailOpacity(opacity) {
    this.config.trailOpacity = Math.max(0, Math.min(1, opacity));
  }
  /**
   * Définit le rayon des particules
   */
  setParticleRadius(radius) {
    this.config.particleRadius = Math.max(1, radius);
  }
}
export {
  Renderer
};
//# sourceMappingURL=Renderer.js.map
