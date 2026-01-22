
/**
 * Visualisation de Tri (Sorting)
 * Rendu Canvas pour Bubble, Quick, Merge et Heap Sort
 */
export function initSortingViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';
  container.style.position = 'relative';

  // Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  // Set actual canvas size slightly after to ensure container layout is done
  setTimeout(() => {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    reset();
  }, 0);

  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Config
  const n = 50;
  let array = [];
  let isSorting = false;
  let stopRequested = false;
  const delay = 20;

  // Helper: Sleep (ms)
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Colors
  const COLOR_DEFAULT = '#3b82f6'; // Blue
  const COLOR_COMPARE = '#f59e0b'; // Amber
  const COLOR_SWAP = '#ef4444'; // Red
  const COLOR_SORTED = '#10b981'; // Green
  const COLOR_PIVOT = '#8b5cf6'; // Purple

  // Init Array
  function reset() {
    if (isSorting) {
      stopRequested = true;
      // The existing loop will catch this and exit
      return;
    }

    // Ensure canvas dims are correct
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    array = [];
    for (let i = 0; i < n; i++) {
      array.push(Math.random() * (canvas.height - 20) + 10);
    }
    draw([], []);
    stopRequested = false;
  }

  // Draw Function
  function draw(compareIndices = [], swapIndices = [], pivotIndex = -1, sortedIndices = []) {
    ctx.fillStyle = '#1e293b'; // Background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / n;

    for (let i = 0; i < n; i++) {
      let color = COLOR_DEFAULT;
      if (sortedIndices.includes(i)) {color = COLOR_SORTED;}
      else if (swapIndices.includes(i)) {color = COLOR_SWAP;}
      else if (compareIndices.includes(i)) {color = COLOR_COMPARE;}
      else if (i === pivotIndex) {color = COLOR_PIVOT;}

      ctx.fillStyle = color;
      const h = array[i];
      ctx.fillRect(i * barWidth, canvas.height - h, barWidth - 2, h);
    }
  }

  // --- ALGORITHMS ---

  // 1. Bubble Sort
  async function bubbleSort() {
    if (isSorting) {return;}
    isSorting = true;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        if (stopRequested) { isSorting = false; return; }

        draw([j, j + 1], [], -1, []); // Compare
        await sleep(delay);

        if (array[j] > array[j + 1]) {
          const temp = array[j];
          array[j] = array[j + 1];
          array[j + 1] = temp;
          draw([], [j, j + 1], -1, []); // Swap
          await sleep(delay);
        }
      }
    }
    draw([], [], -1, Array.from({ length: n }, (_, i) => i)); // All sorted
    isSorting = false;
  }

  // 2. Quick Sort
  async function quickSortStart() {
    if (isSorting) {return;}
    isSorting = true;
    await quickSort(0, array.length - 1);
    if(!stopRequested) {draw([], [], -1, Array.from({ length: n }, (_, i) => i));}
    isSorting = false;
  }

  async function quickSort(start, end) {
    if (start >= end) {return;}
    if (stopRequested) {return;}

    const index = await partition(start, end);
    await Promise.all([
      quickSort(start, index - 1),
      quickSort(index + 1, end),
    ]);
  }

  async function partition(start, end) {
    let pivotIndex = start;
    const pivotValue = array[end];

    for (let i = start; i < end; i++) {
      if (stopRequested) {return;}
      draw([i], [], end, []); // Compare i with pivot
      await sleep(delay);

      if (array[i] < pivotValue) {
        [array[i], array[pivotIndex]] = [array[pivotIndex], array[i]];
        draw([], [i, pivotIndex], end, []); // Swap
        await sleep(delay);
        pivotIndex++;
      }
    }
    [array[pivotIndex], array[end]] = [array[end], array[pivotIndex]];
    return pivotIndex;
  }

  // 3. Merge Sort
  async function mergeSortStart() {
    if (isSorting) {return;}
    isSorting = true;
    await mergeSort(0, array.length - 1);
    if(!stopRequested) {draw([], [], -1, Array.from({ length: n }, (_, i) => i));}
    isSorting = false;
  }

  async function mergeSort(start, end) {
    if (start >= end) {return;}
    if (stopRequested) {return;}

    const mid = Math.floor((start + end) / 2);
    await mergeSort(start, mid);
    await mergeSort(mid + 1, end);
    await merge(start, mid, end);
  }

  async function merge(start, mid, end) {
    const left = array.slice(start, mid + 1);
    const right = array.slice(mid + 1, end + 1);
    let i = 0, j = 0, k = start;

    // Visual only: we can't show "aux array" easily on canvas without complex UI
    // so we highlight the range being merged
    while (i < left.length && j < right.length) {
      if (stopRequested) {return;}
      draw([k], [], -1, []); // Highlighting index k being filled
      await sleep(delay);

      if (left[i] <= right[j]) {
        array[k] = left[i];
        i++;
      } else {
        array[k] = right[j];
        j++;
      }
      k++;
      draw([], [k-1], -1, []); // Show update
      await sleep(delay);
    }

    while (i < left.length) {
      if (stopRequested) {return;}
      array[k] = left[i];
      i++; k++;
      draw([], [k-1], -1, []);
      await sleep(delay);
    }
    while (j < right.length) {
      if (stopRequested) {return;}
      array[k] = right[j];
      j++; k++;
      draw([], [k-1], -1, []);
      await sleep(delay);
    }
  }

  // 4. Heap Sort
  async function heapSort() {
    if (isSorting) {return;}
    isSorting = true;

    // Build heap (rearrange array)
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      await heapify(n, i);
    }

    // One by one extract an element from heap
    for (let i = n - 1; i > 0; i--) {
      if (stopRequested) { isSorting = false; return; }

      // Move current root to end
      [array[0], array[i]] = [array[i], array[0]];
      draw([], [0, i], -1, []);
      await sleep(delay);

      // Call max heapify on the reduced heap
      await heapify(i, 0);
    }

    draw([], [], -1, Array.from({ length: n }, (_, i) => i));
    isSorting = false;
  }

  async function heapify(searchN, i) {
    if (stopRequested) {return;}
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    draw([left, right], [], largest, []); // Inspect children
    await sleep(delay);

    if (left < searchN && array[left] > array[largest]) {largest = left;}
    if (right < searchN && array[right] > array[largest]) {largest = right;}

    if (largest !== i) {
      [array[i], array[largest]] = [array[largest], array[i]];
      draw([], [i, largest], -1, []);
      await sleep(delay);
      await heapify(searchN, largest);
    }
  }


  // Controls UI
  function createControls() {
    const controls = document.createElement('div');
    controls.className = 'absolute bottom-4 left-0 right-0 flex justify-center gap-2 flex-wrap px-4 pointer-events-none';

    const btnClass = 'pointer-events-auto px-3 py-1 bg-[var(--ac-bg-tertiary)] text-[var(--ac-text-primary)] rounded border border-[var(--ac-border)] hover:bg-[var(--ac-accent-blue)] hover:text-white transition text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed';

    const wrapper = (fn, label) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = btnClass;
      btn.onclick = async () => {
        if (isSorting) {
          stopRequested = true;
          // Wait until stopped
          while(isSorting) {await sleep(50);}
        }
        reset(); // Ensure fresh start
        await sleep(50); // slight pause
        fn();
      };
      return btn;
    };

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.className = btnClass.replace('hover:bg-[var(--ac-accent-blue)]', 'hover:bg-red-500');
    resetButton.onclick = () => {
      stopRequested = true;
      setTimeout(() => {
        if(!isSorting) {reset();}
      }, 100);
    };

    controls.appendChild(wrapper(bubbleSort, 'Bubble'));
    controls.appendChild(wrapper(mergeSortStart, 'Merge'));
    controls.appendChild(wrapper(quickSortStart, 'Quick'));
    controls.appendChild(wrapper(heapSort, 'Heap'));
    controls.appendChild(document.createTextNode(' ')); // spacer
    controls.appendChild(resetButton);

    container.appendChild(controls);
  }

  // Initialize
  createControls();

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (!isSorting) {draw();}
  });
}
