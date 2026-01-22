const DEFAULT_CONFIG = {
  particleCount: 500,
  groupCount: 4,
  interactionRadius: 80,
  friction: 0.05,
  forceStrength: 1,
  width: 800,
  height: 600
};
const DEFAULT_RENDER_CONFIG = {
  particleRadius: 3,
  showTrails: true,
  trailOpacity: 0.1,
  colors: [
    { h: 0, s: 80, l: 60 },
    // Rouge
    { h: 120, s: 80, l: 50 },
    // Vert
    { h: 220, s: 80, l: 60 },
    // Bleu
    { h: 50, s: 90, l: 55 },
    // Jaune
    { h: 280, s: 70, l: 60 },
    // Violet
    { h: 180, s: 70, l: 50 }
    // Cyan
  ]
};
export {
  DEFAULT_CONFIG,
  DEFAULT_RENDER_CONFIG
};
//# sourceMappingURL=types.js.map
