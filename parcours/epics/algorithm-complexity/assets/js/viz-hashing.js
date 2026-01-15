/**
 * Visualisation simple d'une Table de Hachage avec chaînage
 */
export function initHashViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';
  container.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth || 600;
  canvas.height = 350;
  container.appendChild(canvas);

  // UI Controls
  const controls = document.createElement('div');
  controls.className = 'absolute top-2 right-2 flex gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Entrez un mot...';
  input.value = 'Data';
  input.className = 'w-32 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500';
  input.maxLength = 8;

  const btnAdd = document.createElement('button');
  btnAdd.textContent = 'Insérer';
  btnAdd.className = 'px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500 font-bold transition';

  const btnReset = document.createElement('button');
  btnReset.textContent = 'Reset';
  btnReset.className = 'px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 font-bold transition';

  controls.appendChild(input);
  controls.appendChild(btnAdd);
  controls.appendChild(btnReset);
  container.appendChild(controls);

  const ctx = canvas.getContext('2d');

  // Config
  const bucketCount = 5;
  const buckets = Array(bucketCount).fill().map(() => []);

  // Layout
  const bucketWidth = 60;
  const bucketHeight = 40;
  const bucketX = 100;
  const startY = 80;

  // Animation
  const state = {
    animating: false,
    text: '',
    hash: 0,
    bucketIdx: -1,
    progress: 0, // 0 to 1
    phase: 'idle', // idle, hashing, moving, inserting
  };

  // Helper: Hash function
  function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash + str.charCodeAt(i)) % bucketCount;
    }
    return hash; // 0 to bucketCount-1
  }

  // Actions
  function insert(text) {
    if (state.animating) {return;}
    if (!text) {return;}

    state.animating = true;
    state.text = text;
    state.hash = 0; // visual rolling hash?
    state.bucketIdx = getHash(text);
    state.phase = 'hashing';
    state.progress = 0;

    animate();
  }

  function reset() {
    if (state.animating) {
      // Stop animation
      state.animating = false;
    }
    // Clear buckets
    buckets.forEach(b => b.length = 0);

    // Add defaults
    buckets[0].push('Key');
    buckets[1].push('Value');
    buckets[state.bucketIdx = 2].push('Hash'); // just random
    buckets[2] = [];

    draw();
  }

  // Drawing
  function draw() {
    // Clear
    ctx.fillStyle = '#1e293b'; // Dark bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = '14px monospace';

    // Info text
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`Hash Function: sum(ASCII) % ${bucketCount}`, 20, 30);

    // Draw Buckets (Vertical List)
    for (let i = 0; i < bucketCount; i++) {
      const y = startY + i * (bucketHeight + 15);

      // Bucket Index Label
      ctx.fillStyle = (state.phase !== 'idle' && state.bucketIdx === i) ? '#fbbf24' : '#94a3b8';
      ctx.textAlign = 'right';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`[${i}]`, bucketX - 10, y + bucketHeight/2 + 5);

      // Bucket Box (The "Array slot")
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(bucketX, y, bucketWidth, bucketHeight);

      // Items in bucket (Linked List)
      buckets[i].forEach((item, idx) => {
        const itemX = bucketX + bucketWidth + 30 + idx * 100;

        // Arrow
        ctx.beginPath();
        ctx.moveTo(itemX - 30, y + bucketHeight/2);
        ctx.lineTo(itemX, y + bucketHeight/2);
        ctx.strokeStyle = '#64748b';
        ctx.stroke();

        // Arrow Head
        ctx.beginPath();
        ctx.moveTo(itemX - 5, y + bucketHeight/2 - 3);
        ctx.lineTo(itemX, y + bucketHeight/2);
        ctx.lineTo(itemX - 5, y + bucketHeight/2 + 3);
        ctx.fillStyle = '#64748b';
        ctx.fill();

        // Item Box
        ctx.fillStyle = '#334155';
        ctx.fillRect(itemX, y, 80, bucketHeight);
        ctx.strokeStyle = '#fbbf24';
        if (state.phase === 'inserting' && state.bucketIdx === i && idx === buckets[i].length - 1) {
          ctx.strokeStyle = '#10b981'; // Green for just inserted
        }
        ctx.strokeRect(itemX, y, 80, bucketHeight);

        ctx.fillStyle = '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        ctx.fillText(item, itemX + 40, y + bucketHeight/2 + 4);
      });
    }

    // Animation Overlay
    if (state.animating) {
      handleAnimation();
    }
  }

  function handleAnimation() {
    if (state.phase === 'hashing') {
      // Text flying to hash formula
      state.progress += 0.05;

      // Draw text moving
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      const x = 300;
      const y = 30; // Top
      ctx.fillText(`Hashing "${state.text}" -> Index ${state.bucketIdx}`, x, y + Math.sin(state.progress * 10) * 2);

      if (state.progress > 1) {
        state.phase = 'moving';
        state.progress = 0;
      }
    } else if (state.phase === 'moving') {
      // Moving to bucket
      state.progress += 0.05;
      const targetY = startY + state.bucketIdx * (bucketHeight + 15) + bucketHeight/2;
      const currentX = 300 + (bucketX - 300) * state.progress;
      const currentY = 30 + (targetY - 30) * state.progress;

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 5, 0, Math.PI*2);
      ctx.fill();

      if (state.progress >= 1) {
        state.phase = 'inserting';
        buckets[state.bucketIdx].push(state.text);
        state.progress = 0;
      }
    } else if (state.phase === 'inserting') {
      // Flash effect done by draw() checking phase
      state.progress += 0.05;
      if (state.progress > 0.5) {
        state.animating = false;
        state.phase = 'idle';
        state.progress = 0;
      }
    }

    requestAnimationFrame(draw);
  }

  function animate() {
    if(state.animating) {
      draw();
    }
  }

  // Events
  btnAdd.onclick = () => {
    const val = input.value.trim();
    if (val) {
      insert(val);
      input.value = '';
      input.focus();
    }
  };

  input.onkeypress = (e) => {
    if (e.key === 'Enter') {btnAdd.click();}
  };

  btnReset.onclick = reset;

  // Init with some data
  reset();
  buckets[0] = ['Alice', 'Bob'];
  buckets[2] = ['User'];
  buckets[4] = ['Key'];
  draw();
}

