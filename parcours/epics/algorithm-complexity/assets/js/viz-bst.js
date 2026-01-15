/**
 * Visualisation Arbre Binaire de Recherche (BST)
 * Gère l'insertion animée.
 */
export function initBSTViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';
  container.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth || 600;
  canvas.height = 300;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // UI Controls
  const controls = document.createElement('div');
  controls.className = 'absolute top-3 right-3 flex gap-2';

  const input = document.createElement('input');
  input.type = 'number';
  input.placeholder = 'Val?';
  input.className = 'w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm';

  const btnAdd = document.createElement('button');
  btnAdd.textContent = '+';
  btnAdd.className = 'px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 font-bold';

  const btnReset = document.createElement('button');
  btnReset.textContent = '↺';
  btnReset.className = 'px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600';

  controls.append(input, btnAdd, btnReset);
  container.appendChild(controls);

  // Tree Structure
  // Node: { val: number, left: Node, right: Node, x: number, y: number, highlight: boolean }
  let root = null;
  let animating = false;

  class Node {
    constructor(val) {
      this.val = val;
      this.left = null;
      this.right = null;
      this.x = 0;
      this.y = 0;
      this.highlight = false;
    }
  }

  // Helper: Insert
  async function insert(val) {
    if (animating) {return;}
    animating = true;

    if (!root) {
      root = new Node(val);
      animating = false;
      updatePositions();
      draw();
      return;
    }

    let current = root;
    while (true) {
      // Visual step: Highlight current
      current.highlight = true;
      draw();
      await new Promise(r => setTimeout(r, 400));
      current.highlight = false;

      if (val === current.val) {
        // No duplicate for sim
        animating = false;
        draw();
        return;
      }

      if (val < current.val) {
        if (!current.left) {
          current.left = new Node(val);
          break;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = new Node(val);
          break;
        }
        current = current.right;
      }
    }

    animating = false;
    updatePositions();
    draw();
  }

  function reset() {
    root = null;
    animating = false;
    // Seed
    [50, 30, 70, 20, 40].forEach(v => {
      if(!root) {root = new Node(v);}
      else {
        let curr = root;
        while(true) {
          if(v<curr.val) { if(!curr.left) { curr.left = new Node(v); break;} curr = curr.left; }
          else { if(!curr.right) { curr.right = new Node(v); break;} curr = curr.right; }
        }
      }
    });
    updatePositions();
    draw();
  }

  // Layout Logic (Simple recursive separation)
  function updatePositions() {
    if (!root) {return;}
    const width = canvas.width;

    const setPos = (node, x, y, level) => {
      if (!node) {return;}
      node.x = x;
      node.y = y;

      const offset = width / (Math.pow(2, level + 2));
      setPos(node.left, x - offset, y + 50, level + 1);
      setPos(node.right, x + offset, y + 50, level + 1);
    };

    setPos(root, width / 2, 40, 0);
  }

  // Draw
  function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ctx.fillStyle = '#1e293b';
    // ctx.fillRect(0,0, canvas.width, canvas.height); // Transparent bg logic? Or default?
    // Let's use clean transparent if background is handled by CSS, or explicit for Canvas consistency

    if (!root) {return;}

    // Draw edges first
    const drawEdges = (node) => {
      if (!node) {return;}
      if (node.left) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.left.x, node.left.y);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
        drawEdges(node.left);
      }
      if (node.right) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.right.x, node.right.y);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
        drawEdges(node.right);
      }
    };
    drawEdges(root);

    // Draw nodes
    const drawNodes = (node) => {
      if (!node) {return;}

      ctx.beginPath();
      ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = node.highlight ? '#fbbf24' : '#334155';
      ctx.fill();
      ctx.strokeStyle = node.highlight ? '#f59e0b' : '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(node.val, node.x, node.y);

      drawNodes(node.left);
      drawNodes(node.right);
    };
    drawNodes(root);
  }

  // Interaction
  btnAdd.onclick = () => {
    const v = parseInt(input.value);
    if (!isNaN(v)) {
      insert(v);
      input.value = '';
      input.focus();
    }
  };
  btnReset.onclick = reset;
  input.onkeypress = (e) => { if (e.key === 'Enter') {btnAdd.click();} };

  // Init
  reset();

  // Resize
  window.addEventListener('resize', () => {
    canvas.width = container.clientWidth;
    updatePositions();
    draw();
  });
}
