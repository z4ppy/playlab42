import { Simulation } from "./Simulation.js";
import { Renderer } from "./Renderer.js";
let simulation;
let renderer;
let isRunning = true;
let animationId = null;
function init() {
  const canvas = document.getElementById("canvas");
  if (!canvas) {
    console.error("Canvas non trouv\xE9");
    return;
  }
  const container = canvas.parentElement;
  if (container) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  simulation = new Simulation({
    width: canvas.width,
    height: canvas.height,
    particleCount: 500,
    groupCount: 4
  });
  renderer = new Renderer(canvas);
  setupControls();
  window.addEventListener("resize", handleResize);
  startLoop();
}
function loop() {
  if (!isRunning) {
    animationId = requestAnimationFrame(loop);
    return;
  }
  simulation.update();
  renderer.render(simulation.getParticles());
  updateStats();
  animationId = requestAnimationFrame(loop);
}
function startLoop() {
  if (animationId === null) {
    animationId = requestAnimationFrame(loop);
  }
}
function stopLoop() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}
function setupControls() {
  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.addEventListener("click", togglePlay);
  }
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      simulation.resetParticles();
    });
  }
  const randomBtn = document.getElementById("randomBtn");
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      simulation.randomizeAttractions();
    });
  }
  const particleSlider = document.getElementById("particleCount");
  const particleValue = document.getElementById("particleCountValue");
  if (particleSlider && particleValue) {
    particleSlider.addEventListener("input", () => {
      const count = parseInt(particleSlider.value, 10);
      particleValue.textContent = count.toString();
      simulation.updateConfig({ particleCount: count });
    });
  }
  const groupSlider = document.getElementById("groupCount");
  const groupValue = document.getElementById("groupCountValue");
  if (groupSlider && groupValue) {
    groupSlider.addEventListener("input", () => {
      const count = parseInt(groupSlider.value, 10);
      groupValue.textContent = count.toString();
      simulation.updateConfig({ groupCount: count });
      updateAttractionMatrix();
    });
  }
  const frictionSlider = document.getElementById("friction");
  const frictionValue = document.getElementById("frictionValue");
  if (frictionSlider && frictionValue) {
    frictionSlider.addEventListener("input", () => {
      const friction = parseFloat(frictionSlider.value);
      frictionValue.textContent = friction.toFixed(2);
      simulation.updateConfig({ friction });
    });
  }
  const radiusSlider = document.getElementById("interactionRadius");
  const radiusValue = document.getElementById("interactionRadiusValue");
  if (radiusSlider && radiusValue) {
    radiusSlider.addEventListener("input", () => {
      const radius = parseInt(radiusSlider.value, 10);
      radiusValue.textContent = radius.toString();
      simulation.updateConfig({ interactionRadius: radius });
    });
  }
  const trailsCheckbox = document.getElementById("showTrails");
  if (trailsCheckbox) {
    trailsCheckbox.addEventListener("change", () => {
      renderer.setTrails(trailsCheckbox.checked);
    });
  }
  updateAttractionMatrix();
}
function togglePlay() {
  isRunning = !isRunning;
  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.textContent = isRunning ? "Pause" : "Play";
  }
}
function handleResize() {
  const canvas = document.getElementById("canvas");
  const container = canvas?.parentElement;
  if (canvas && container) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.resize(width, height);
    simulation.resize(width, height);
  }
}
function updateStats() {
  const stats = simulation.getStats();
  const state = simulation.getState();
  const energyEl = document.getElementById("energy");
  const speedEl = document.getElementById("speed");
  const tickEl = document.getElementById("tick");
  if (energyEl) energyEl.textContent = stats.kineticEnergy.toFixed(1);
  if (speedEl) speedEl.textContent = stats.averageSpeed.toFixed(2);
  if (tickEl) tickEl.textContent = state.tick.toString();
}
function updateAttractionMatrix() {
  const container = document.getElementById("attractionMatrix");
  if (!container) return;
  const config = simulation.getConfig();
  const attractions = simulation.getAttractions();
  const colors = renderer.getColors();
  let html = '<table class="matrix">';
  html += "<tr><th></th>";
  for (let j = 0; j < config.groupCount; j++) {
    const color = colors[j % colors.length];
    html += `<th style="color: hsl(${color.h}, ${color.s}%, ${color.l}%)">${j + 1}</th>`;
  }
  html += "</tr>";
  for (let i = 0; i < config.groupCount; i++) {
    const color = colors[i % colors.length];
    html += `<tr><th style="color: hsl(${color.h}, ${color.s}%, ${color.l}%)">${i + 1}</th>`;
    for (let j = 0; j < config.groupCount; j++) {
      const value = attractions[i]?.[j] ?? 0;
      const bgColor = value > 0 ? `rgba(0, 255, 0, ${Math.abs(value) * 0.5})` : `rgba(255, 0, 0, ${Math.abs(value) * 0.5})`;
      html += `<td style="background: ${bgColor}">
        <input type="range" min="-1" max="1" step="0.1" value="${value}"
               data-from="${i}" data-to="${j}"
               title="${value.toFixed(1)}">
      </td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  container.innerHTML = html;
  const sliders = container.querySelectorAll('input[type="range"]');
  sliders.forEach((slider) => {
    slider.addEventListener("input", (e) => {
      const input = e.target;
      const from = parseInt(input.dataset.from ?? "0", 10);
      const to = parseInt(input.dataset.to ?? "0", 10);
      const value = parseFloat(input.value);
      simulation.setAttraction(from, to, value);
      input.title = value.toFixed(1);
      const bgColor = value > 0 ? `rgba(0, 255, 0, ${Math.abs(value) * 0.5})` : `rgba(255, 0, 0, ${Math.abs(value) * 0.5})`;
      input.parentElement.style.background = bgColor;
    });
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
export {
  init,
  renderer,
  simulation,
  togglePlay
};
//# sourceMappingURL=main.js.map
