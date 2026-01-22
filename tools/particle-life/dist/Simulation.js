import { DEFAULT_CONFIG } from "./types.js";
class Simulation {
  state;
  /**
   * Crée une nouvelle simulation
   * @param config - Configuration partielle (fusionnée avec les valeurs par défaut)
   */
  constructor(config = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState(fullConfig);
  }
  /**
   * Crée l'état initial de la simulation
   */
  createInitialState(config) {
    const particles = this.createParticles(config);
    const attractions = this.createRandomAttractions(config.groupCount);
    return {
      particles,
      attractions,
      config,
      tick: 0
    };
  }
  /**
   * Crée les particules initiales avec positions et groupes aléatoires
   */
  createParticles(config) {
    const particles = [];
    for (let i = 0; i < config.particleCount; i++) {
      particles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        vx: 0,
        vy: 0,
        group: Math.floor(Math.random() * config.groupCount)
      });
    }
    return particles;
  }
  /**
   * Crée une matrice d'attractions aléatoire
   * Valeurs entre -1 (répulsion) et +1 (attraction)
   */
  createRandomAttractions(groupCount) {
    const matrix = [];
    for (let i = 0; i < groupCount; i++) {
      matrix[i] = [];
      for (let j = 0; j < groupCount; j++) {
        matrix[i][j] = Math.random() * 2 - 1;
      }
    }
    return matrix;
  }
  /**
   * Avance la simulation d'un pas de temps
   */
  update() {
    const { particles, attractions, config } = this.state;
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < particles.length; j++) {
        if (i === j) continue;
        const p2 = particles[j];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        if (dx > config.width / 2) dx -= config.width;
        if (dx < -config.width / 2) dx += config.width;
        if (dy > config.height / 2) dy -= config.height;
        if (dy < -config.height / 2) dy += config.height;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        if (dist > config.interactionRadius || dist < 1) continue;
        const attraction = attractions[p1.group][p2.group];
        const normalizedDist = dist / config.interactionRadius;
        const forceMagnitude = this.forceFunction(normalizedDist) * attraction * config.forceStrength;
        fx += dx / dist * forceMagnitude;
        fy += dy / dist * forceMagnitude;
      }
      p1.vx += fx;
      p1.vy += fy;
      p1.vx *= 1 - config.friction;
      p1.vy *= 1 - config.friction;
    }
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x += config.width;
      if (p.x >= config.width) p.x -= config.width;
      if (p.y < 0) p.y += config.height;
      if (p.y >= config.height) p.y -= config.height;
    }
    this.state.tick++;
  }
  /**
   * Fonction de force en fonction de la distance normalisée
   * Retourne une force qui :
   * - Est répulsive à très courte distance (éviter les collisions)
   * - Atteint son maximum à mi-distance
   * - Décroît vers zéro à longue distance
   */
  forceFunction(normalizedDist) {
    if (normalizedDist < 0.3) {
      return normalizedDist / 0.3 - 1;
    }
    return (1 - Math.abs(2 * normalizedDist - 1.3)) * 0.5;
  }
  /**
   * Retourne l'état actuel (lecture seule)
   */
  getState() {
    return this.state;
  }
  /**
   * Retourne les particules pour le rendu
   */
  getParticles() {
    return this.state.particles;
  }
  /**
   * Retourne la configuration
   */
  getConfig() {
    return this.state.config;
  }
  /**
   * Retourne la matrice d'attractions
   */
  getAttractions() {
    return this.state.attractions;
  }
  /**
   * Modifie une valeur dans la matrice d'attractions
   */
  setAttraction(fromGroup, toGroup, value) {
    if (fromGroup >= 0 && fromGroup < this.state.config.groupCount && toGroup >= 0 && toGroup < this.state.config.groupCount) {
      this.state.attractions[fromGroup][toGroup] = Math.max(-1, Math.min(1, value));
    }
  }
  /**
   * Randomise toutes les attractions
   */
  randomizeAttractions() {
    this.state.attractions = this.createRandomAttractions(this.state.config.groupCount);
  }
  /**
   * Remet les particules à des positions aléatoires
   */
  resetParticles() {
    this.state.particles = this.createParticles(this.state.config);
    this.state.tick = 0;
  }
  /**
   * Calcule les statistiques de la simulation
   */
  getStats() {
    const { particles, config } = this.state;
    let kineticEnergy = 0;
    let totalSpeed = 0;
    const groupCounts = new Array(config.groupCount).fill(0);
    for (const p of particles) {
      const speedSq = p.vx * p.vx + p.vy * p.vy;
      kineticEnergy += speedSq * 0.5;
      totalSpeed += Math.sqrt(speedSq);
      groupCounts[p.group]++;
    }
    return {
      kineticEnergy,
      averageSpeed: totalSpeed / particles.length,
      groupCounts
    };
  }
  /**
   * Met à jour la configuration (redémarre la simulation)
   */
  updateConfig(newConfig) {
    const config = { ...this.state.config, ...newConfig };
    this.state = this.createInitialState(config);
  }
  /**
   * Redimensionne le monde
   */
  resize(width, height) {
    const scaleX = width / this.state.config.width;
    const scaleY = height / this.state.config.height;
    for (const p of this.state.particles) {
      p.x *= scaleX;
      p.y *= scaleY;
    }
    this.state.config.width = width;
    this.state.config.height = height;
  }
}
export {
  Simulation
};
//# sourceMappingURL=Simulation.js.map
