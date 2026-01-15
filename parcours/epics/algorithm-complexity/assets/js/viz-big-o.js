/**
 * Visualisation Big O (Graphique Interactif)
 * Amélioré pour lisibilité + Zoom
 */
export function initBigOViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';

  // Config default
  let maxN = 50;
  let maxY = 400;

  // Create UI Layout
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col w-full h-full';

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'relative flex-1 min-h-[300px] w-full bg-gray-900 rounded-t-lg overflow-hidden group';

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  canvas.className = 'w-full h-full object-contain';

  // Zoom Controls (Overlay)
  const zoomControls = document.createElement('div');
  zoomControls.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

  const btnZoomIn = document.createElement('button');
  btnZoomIn.innerText = '+ Zoom';
  btnZoomIn.className = 'px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 shadow';

  const btnZoomOut = document.createElement('button');
  btnZoomOut.innerText = '- Zoom';
  btnZoomOut.className = 'px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 shadow';

  zoomControls.append(btnZoomIn, btnZoomOut);

  // Legend Container (Overlay)
  const legend = document.createElement('div');
  legend.className = 'absolute top-4 left-12 bg-gray-800/90 p-3 rounded border border-gray-700 text-xs font-mono shadow-xl backdrop-blur-sm z-10';

  canvasContainer.append(canvas, legend, zoomControls);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'w-full bg-gray-800 rounded-b-lg p-4 flex items-center gap-4 border-t border-gray-700';

  const label = document.createElement('label');
  label.innerText = 'Taille des données (N) :';
  label.className = 'text-sm font-bold text-gray-300 whitespace-nowrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '100'; // Will be scaled by maxN conceptually
  slider.value = '20';
  slider.step = '1';
  slider.className = 'flex-1 accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer';

  const valDisplay = document.createElement('span');
  valDisplay.innerText = 'N=20';
  valDisplay.className = 'font-mono text-[var(--ac-accent-blue)] w-16 text-right font-bold';

  controls.append(label, slider, valDisplay);
  wrapper.append(canvasContainer, controls);
  container.append(wrapper);

  const ctx = canvas.getContext('2d');

  // Const functions
  const functions = [
    {
      id: 'o_1',
      name: 'O(1)',
      color: '#4ade80',
      fn: () => 10,
    },
    {
      id: 'o_log',
      name: 'O(log n)',
      color: '#2dd4bf',
      fn: (n) => 10 + Math.log2(n || 1) * 20,
    },
    {
      id: 'o_n',
      name: 'O(n)',
      color: '#facc15',
      fn: (n) => n * 3.0,
    },
    {
      id: 'o_nlog',
      name: 'O(n log n)',
      color: '#f472b6',
      fn: (n) => n * Math.log2(n||1) * 0.7,
    },
    {
      id: 'o_sq',
      name: 'O(n²)',
      color: '#ef4444',
      fn: (n) => (n * n) * 0.1,
      // NOTE: Reduced coefficients to fit zoom better
    },
    {
      id: 'o_exp',
      name: 'O(2ⁿ)',
      color: '#b91c1c',
      fn: (n) => Math.pow(2, n) * 0.01, // Scaled way down
    },
  ];

  function updateLegend(n) {
    legend.innerHTML = '';
    functions.forEach(f => {
      const val = Math.round(f.fn(n));
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 mb-1 last:mb-0';

      const dot = document.createElement('div');
      dot.className = 'w-3 h-3 rounded-full';
      dot.style.backgroundColor = f.color;

      const txt = document.createElement('span');
      txt.className = 'text-gray-300';
      let displayVal = val;
      if (val > 10000) {displayVal = '>10k';}
      txt.innerHTML = `<span class="font-bold" style="color:${f.color}">${f.name}</span> : <span class="text-gray-400">~${displayVal}</span>`;

      row.append(dot, txt);
      legend.appendChild(row);
    });
  }

  function draw() {
    const width = canvas.width;
    const height = canvas.height;
    const BOTTOM_PAD = 30;
    const LEFT_PAD = 40;

    // Valid current N from slider percentage
    const sliderPct = parseInt(slider.value); // 1-100
    const currentN = Math.max(1, Math.round((sliderPct / 100) * maxN));

    valDisplay.innerText = `N=${currentN}`;


    // Reset
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines
    for(let i=0; i<=10; i++) {
      const x = LEFT_PAD + (i/10) * (width - LEFT_PAD);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - BOTTOM_PAD);
    }
    // Horizontal lines
    for(let i=0; i<=5; i++) {
      const y = (height - BOTTOM_PAD) - (i/5) * (height - BOTTOM_PAD);
      ctx.moveTo(LEFT_PAD, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`N=${maxN}`, width - 10, height - 10);
    ctx.fillText('N=0', LEFT_PAD + 20, height - 10);

    // Scales
    const plotWidth = width - LEFT_PAD;
    const plotHeight = height - BOTTOM_PAD;

    const scaleX = plotWidth / maxN;
    const scaleY = plotHeight / maxY;

    // Draw Curves
    functions.forEach(f => {
      ctx.beginPath();
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let first = true;
      // Scan x from 0 to maxN
      for(let x=1; x<=maxN; x+= (maxN/100)) { // step optimization
        const y = f.fn(x);
        const plotX = LEFT_PAD + (x * scaleX);
        const plotY = (height - BOTTOM_PAD) - (y * scaleY);

        if (plotY < -10) {
          if (!first) {ctx.lineTo(plotX, -10);}
          break;
        }
        if (first) {
          ctx.moveTo(plotX, plotY);
          first = false;
        } else {
          ctx.lineTo(plotX, plotY);
        }
      }
      ctx.stroke();

      // Dot
      const val = f.fn(currentN);
      const dotX = LEFT_PAD + (currentN * scaleX);
      const dotY = (height - BOTTOM_PAD) - (val * scaleY);

      if (dotY > -20 && dotY < height) {
        ctx.beginPath();
        ctx.fillStyle = '#111827';
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = f.color;
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Current X Line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([5, 5]);
    const lineX = LEFT_PAD + (currentN * scaleX);
    ctx.moveTo(lineX, 0);
    ctx.lineTo(lineX, height - BOTTOM_PAD);
    ctx.stroke();
    ctx.setLineDash([]);

    updateLegend(currentN);
  }

  slider.oninput = () => {
    requestAnimationFrame(draw);
  };

  btnZoomIn.onclick = () => {
    // Zoom in means smaller Max N range focused
    if (maxN > 10) {
      maxN = Math.floor(maxN / 2);
      maxY = Math.floor(maxY / 2); // Also zoom Y to keep ratio somewhat
      draw();
    }
  };

  btnZoomOut.onclick = () => {
    // Zoom out means larger Max N range
    if (maxN < 500) {
      maxN = Math.floor(maxN * 2);
      maxY = Math.floor(maxY * 2);
      draw();
    }
  };

  // Initial draw
  requestAnimationFrame(draw);
}
