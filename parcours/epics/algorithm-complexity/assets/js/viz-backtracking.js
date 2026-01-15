/**
 * Visualisation Backtracking : N-Queens
 */
export function initBacktrackingViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  const size = Math.min(container.clientWidth, 400);
  canvas.width = size;
  canvas.height = size;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Config
  const N = 4; // 4x4 is enough for viz, 8 is too long/small
  const CELL_SIZE = size / N;

  let board = Array(N).fill(-1); // board[row] = col
  let isRunning = false;
  const stopSignal = false;

  // Controls
  const controls = document.createElement('div');
  controls.className = 'mt-2 flex gap-2 justify-center';

  const btnRun = document.createElement('button');
  btnRun.textContent = 'Résoudre N=4 (Queens)';
  btnRun.className = 'px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 font-bold text-sm';
  btnRun.onclick = () => solveNQueens();

  const msg = document.createElement('div');
  msg.className = 'text-xs mt-1 ac-text-muted';
  msg.id = 'backtrack-msg';

  controls.append(btnRun);
  container.appendChild(controls);
  container.appendChild(msg);

  function draw(currentR, currentC) {
    ctx.clearRect(0, 0, size, size);

    // Grid
    for(let r=0; r<N; r++) {
      for(let c=0; c<N; c++) {
        const isBlack = (r+c)%2 === 1;
        ctx.fillStyle = isBlack ? '#334155' : '#475569';
        ctx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);

        // Queen
        if (board[r] === c) {
          ctx.fillStyle = '#fff';
          ctx.font = `${CELL_SIZE/2}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♛', c*CELL_SIZE + CELL_SIZE/2, r*CELL_SIZE + CELL_SIZE/2);
        }
      }
    }

    // Highlight current try
    if (currentR !== undefined && currentC !== undefined) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Ghost queen
      ctx.font = `${CELL_SIZE/2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', currentC*CELL_SIZE + CELL_SIZE/2, currentR*CELL_SIZE + CELL_SIZE/2);

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentC*CELL_SIZE, currentR*CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  async function solveNQueens() {
    if (isRunning) {return;}
    isRunning = true;
    board = Array(N).fill(-1);

    const backtrack = async (row) => {
      if (row === N) {
        return true; // Found solution
      }

      for (let col = 0; col < N; col++) {
        if (stopSignal) {return false;}

        // Visualize Try
        draw(row, col);
        document.getElementById('backtrack-msg').innerText = `Essaie Reine sur Ligne ${row}, Col ${col}...`;
        await new Promise(r => setTimeout(r, 200));

        if (isValid(row, col)) {
          board[row] = col; // Place
          document.getElementById('backtrack-msg').innerText = 'Valide ! On descend.';
          await new Promise(r => setTimeout(r, 200));

          if (await backtrack(row + 1)) {return true;}

          // Backtrack
          board[row] = -1; // Remove
          document.getElementById('backtrack-msg').innerText = 'Impasse plus bas. On recule (Backtrack).';
          draw(row, col);
          await new Promise(r => setTimeout(r, 300));
        } else {
          document.getElementById('backtrack-msg').innerText = 'Conflit !';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; // Red flash
          ctx.fillRect(col*CELL_SIZE, row*CELL_SIZE, CELL_SIZE, CELL_SIZE);
          await new Promise(r => setTimeout(r, 100));
        }
      }
      return false;
    };

    function isValid(r, c) {
      for(let i=0; i<r; i++) {
        // Same col or diag
        if (board[i] === c || Math.abs(board[i] - c) === Math.abs(i - r)) {
          return false;
        }
      }
      return true;
    }

    await backtrack(0);
    draw();
    document.getElementById('backtrack-msg').innerText = 'Solution Trouvée !';
    isRunning = false;
  }

  draw();
}
