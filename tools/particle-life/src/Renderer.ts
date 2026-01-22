/**
 * Rendu Canvas pour la simulation Particle Life
 *
 * Gère l'affichage des particules avec effets de traînées.
 *
 * @module tools/particle-life/Renderer
 */

import type { Particle, HSLColor, RenderConfig } from './types.js';
import { DEFAULT_RENDER_CONFIG } from './types.js';

/**
 * Classe de rendu Canvas
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  /**
   * Crée un nouveau renderer
   * @param canvas - Élément canvas HTML
   * @param config - Configuration du rendu
   */
  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible d\'obtenir le contexte 2D du canvas');
    }
    this.ctx = ctx;
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
  }

  /**
   * Efface le canvas (avec effet de traînée optionnel)
   */
  public clear(): void {
    if (this.config.showTrails) {
      // Effet de traînée : semi-transparent
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.config.trailOpacity})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Effacement complet
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Dessine toutes les particules
   * @param particles - Liste des particules à dessiner
   */
  public drawParticles(particles: readonly Particle[]): void {
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
  public render(particles: readonly Particle[]): void {
    this.clear();
    this.drawParticles(particles);
  }

  /**
   * Convertit une couleur HSL en chaîne CSS
   */
  private hslToString(color: HSLColor): string {
    return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
  }

  /**
   * Redimensionne le canvas
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Met à jour la configuration de rendu
   */
  public updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Retourne la configuration actuelle
   */
  public getConfig(): Readonly<RenderConfig> {
    return this.config;
  }

  /**
   * Retourne les couleurs configurées
   */
  public getColors(): readonly HSLColor[] {
    return this.config.colors;
  }

  /**
   * Définit les couleurs des groupes
   */
  public setColors(colors: HSLColor[]): void {
    this.config.colors = colors;
  }

  /**
   * Active/désactive les traînées
   */
  public setTrails(enabled: boolean): void {
    this.config.showTrails = enabled;
  }

  /**
   * Définit l'opacité des traînées
   */
  public setTrailOpacity(opacity: number): void {
    this.config.trailOpacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Définit le rayon des particules
   */
  public setParticleRadius(radius: number): void {
    this.config.particleRadius = Math.max(1, radius);
  }
}
