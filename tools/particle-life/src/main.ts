/**
 * Point d'entrée principal pour Particle Life
 *
 * Initialise la simulation, le rendu et l'interface utilisateur.
 *
 * @module tools/particle-life/main
 */

import { Simulation } from './Simulation.js';
import { Renderer } from './Renderer.js';

// === État global ===

let simulation: Simulation;
let renderer: Renderer;
let isRunning = true;
let animationId: number | null = null;

// === Initialisation ===

/**
 * Initialise l'application
 */
function init(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas non trouvé');
    return;
  }

  // Adapter la taille au conteneur
  const container = canvas.parentElement;
  if (container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  // Créer la simulation et le renderer
  simulation = new Simulation({
    width: canvas.width,
    height: canvas.height,
    particleCount: 500,
    groupCount: 4,
  });

  renderer = new Renderer(canvas);

  // Configurer les contrôles
  setupControls();

  // Gérer le redimensionnement
  window.addEventListener('resize', handleResize);

  // Démarrer la boucle
  startLoop();
}

/**
 * Boucle d'animation principale
 */
function loop(): void {
  if (!isRunning) {
    animationId = requestAnimationFrame(loop);
    return;
  }

  // Mettre à jour la simulation
  simulation.update();

  // Dessiner
  renderer.render(simulation.getParticles());

  // Mettre à jour les stats
  updateStats();

  // Continuer la boucle
  animationId = requestAnimationFrame(loop);
}

/**
 * Démarre la boucle d'animation
 */
function startLoop(): void {
  if (animationId === null) {
    animationId = requestAnimationFrame(loop);
  }
}

/**
 * Arrête la boucle d'animation
 */
function stopLoop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// === Contrôles ===

/**
 * Configure les contrôles de l'interface
 */
function setupControls(): void {
  // Bouton Play/Pause
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', togglePlay);
  }

  // Bouton Reset
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      simulation.resetParticles();
    });
  }

  // Bouton Randomize
  const randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      simulation.randomizeAttractions();
    });
  }

  // Slider particules
  const particleSlider = document.getElementById('particleCount') as HTMLInputElement;
  const particleValue = document.getElementById('particleCountValue');
  if (particleSlider && particleValue) {
    particleSlider.addEventListener('input', () => {
      const count = parseInt(particleSlider.value, 10);
      particleValue.textContent = count.toString();
      simulation.updateConfig({ particleCount: count });
    });
  }

  // Slider groupes
  const groupSlider = document.getElementById('groupCount') as HTMLInputElement;
  const groupValue = document.getElementById('groupCountValue');
  if (groupSlider && groupValue) {
    groupSlider.addEventListener('input', () => {
      const count = parseInt(groupSlider.value, 10);
      groupValue.textContent = count.toString();
      simulation.updateConfig({ groupCount: count });
      updateAttractionMatrix();
    });
  }

  // Slider friction
  const frictionSlider = document.getElementById('friction') as HTMLInputElement;
  const frictionValue = document.getElementById('frictionValue');
  if (frictionSlider && frictionValue) {
    frictionSlider.addEventListener('input', () => {
      const friction = parseFloat(frictionSlider.value);
      frictionValue.textContent = friction.toFixed(2);
      simulation.updateConfig({ friction });
    });
  }

  // Slider rayon d'interaction
  const radiusSlider = document.getElementById('interactionRadius') as HTMLInputElement;
  const radiusValue = document.getElementById('interactionRadiusValue');
  if (radiusSlider && radiusValue) {
    radiusSlider.addEventListener('input', () => {
      const radius = parseInt(radiusSlider.value, 10);
      radiusValue.textContent = radius.toString();
      simulation.updateConfig({ interactionRadius: radius });
    });
  }

  // Checkbox traînées
  const trailsCheckbox = document.getElementById('showTrails') as HTMLInputElement;
  if (trailsCheckbox) {
    trailsCheckbox.addEventListener('change', () => {
      renderer.setTrails(trailsCheckbox.checked);
    });
  }

  // Initialiser la matrice d'attractions
  updateAttractionMatrix();
}

/**
 * Bascule play/pause
 */
function togglePlay(): void {
  isRunning = !isRunning;
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.textContent = isRunning ? 'Pause' : 'Play';
  }
}

/**
 * Gère le redimensionnement de la fenêtre
 */
function handleResize(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const container = canvas?.parentElement;

  if (canvas && container) {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.resize(width, height);
    simulation.resize(width, height);
  }
}

/**
 * Met à jour l'affichage des statistiques
 */
function updateStats(): void {
  const stats = simulation.getStats();
  const state = simulation.getState();

  const energyEl = document.getElementById('energy');
  const speedEl = document.getElementById('speed');
  const tickEl = document.getElementById('tick');

  if (energyEl) energyEl.textContent = stats.kineticEnergy.toFixed(1);
  if (speedEl) speedEl.textContent = stats.averageSpeed.toFixed(2);
  if (tickEl) tickEl.textContent = state.tick.toString();
}

/**
 * Met à jour l'affichage de la matrice d'attractions
 */
function updateAttractionMatrix(): void {
  const container = document.getElementById('attractionMatrix');
  if (!container) return;

  const config = simulation.getConfig();
  const attractions = simulation.getAttractions();
  const colors = renderer.getColors();

  // Créer le tableau
  let html = '<table class="matrix">';
  html += '<tr><th></th>';

  // En-têtes de colonnes
  for (let j = 0; j < config.groupCount; j++) {
    const color = colors[j % colors.length];
    html += `<th style="color: hsl(${color.h}, ${color.s}%, ${color.l}%)">${j + 1}</th>`;
  }
  html += '</tr>';

  // Lignes
  for (let i = 0; i < config.groupCount; i++) {
    const color = colors[i % colors.length];
    html += `<tr><th style="color: hsl(${color.h}, ${color.s}%, ${color.l}%)">${i + 1}</th>`;

    for (let j = 0; j < config.groupCount; j++) {
      const value = attractions[i]?.[j] ?? 0;
      const bgColor = value > 0
        ? `rgba(0, 255, 0, ${Math.abs(value) * 0.5})`
        : `rgba(255, 0, 0, ${Math.abs(value) * 0.5})`;

      html += `<td style="background: ${bgColor}">
        <input type="range" min="-1" max="1" step="0.1" value="${value}"
               data-from="${i}" data-to="${j}"
               title="${value.toFixed(1)}">
      </td>`;
    }
    html += '</tr>';
  }
  html += '</table>';

  container.innerHTML = html;

  // Ajouter les écouteurs aux sliders
  const sliders = container.querySelectorAll('input[type="range"]');
  sliders.forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const from = parseInt(input.dataset.from ?? '0', 10);
      const to = parseInt(input.dataset.to ?? '0', 10);
      const value = parseFloat(input.value);

      simulation.setAttraction(from, to, value);
      input.title = value.toFixed(1);

      // Mettre à jour la couleur de fond
      const bgColor = value > 0
        ? `rgba(0, 255, 0, ${Math.abs(value) * 0.5})`
        : `rgba(255, 0, 0, ${Math.abs(value) * 0.5})`;
      (input.parentElement as HTMLElement).style.background = bgColor;
    });
  });
}

// === Démarrage ===

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export pour tests
export { simulation, renderer, init, togglePlay };
