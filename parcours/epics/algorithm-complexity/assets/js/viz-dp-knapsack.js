/**
 * Visualisation Knapsack (Sac à Dos) 0/1 - Programmation Dynamique
 */
export function initKnapsackViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';

  // Setup UI
  const wrapper = document.createElement('div');
  wrapper.className = 'w-full flex flex-col items-center gap-4';

  // 1. Items Config
  const header = document.createElement('div');
  header.innerHTML = '<h3 class="text-lg font-bold ac-text-primary">Objets Disponibles</h3>';

  // Items: {id, w: weight, v: value, name, color}
  const items = [
    { id: 1, w: 2, v: 3, name: '📱', color: 'bg-blue-600' },
    { id: 2, w: 3, v: 4, name: '💻', color: 'bg-purple-600' },
    { id: 3, w: 4, v: 5, name: '🎸', color: 'bg-green-600' },
    { id: 4, w: 5, v: 8, name: '💎', color: 'bg-pink-600' },
  ];

  const CAPACITY = 8;

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'flex gap-2 mb-2';
  items.forEach(item => {
    const d = document.createElement('div');
    d.className = `${item.color} p-2 rounded text-white text-xs flex flex-col items-center min-w-[60px]`;
    d.innerHTML = `<span class="text-lg">${item.name}</span><span>Poids:${item.w}</span><span>Val:${item.v}</span>`;
    itemsContainer.appendChild(d);
  });

  // 2. Control & Legend
  const controls = document.createElement('div');
  controls.className = 'flex gap-2 items-center mb-2';

  const btnRun = document.createElement('button');
  btnRun.textContent = 'Lancer Simulation';
  btnRun.className = 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm';

  const info = document.createElement('div');
  info.className = 'text-xs ac-text-muted';
  info.innerHTML = `Capacité du sac: <strong class="text-white">${CAPACITY}</strong>`;

  controls.append(btnRun, info);

  // 3. Grid Visualization
  const gridContainer = document.createElement('div');
  gridContainer.className = 'overflow-x-auto w-full';

  const table = document.createElement('table');
  table.className = 'w-full text-center text-xs border-collapse';
  table.style.fontFamily = 'monospace';

  // Init Grid
  let dp = [];
  // dp[i][w]

  // function to rebuild table skeleton
  function buildTable() {
    table.innerHTML = '';

    // Header Row (Weights)
    const thead = document.createElement('thead');
    const r1 = document.createElement('tr');
    r1.innerHTML = '<th>Obj</th>'; // Corner
    for(let w=0; w<=CAPACITY; w++) {
      const th = document.createElement('th');
      th.className = 'border border-gray-700 bg-gray-800 p-1 w-8';
      th.innerText = w;
      r1.appendChild(th);
    }
    thead.appendChild(r1);
    table.appendChild(thead);

    // Body (Items)
    const tbody = document.createElement('tbody');

    // Row 0 (No items)
    const r0 = document.createElement('tr');
    r0.innerHTML = '<td class="border border-gray-700 bg-gray-800 font-bold p-1">Ø</td>';
    for(let w=0; w<=CAPACITY; w++) {
      const td = document.createElement('td');
      td.id = `cell-0-${w}`;
      td.className = 'border border-gray-700 p-1 text-gray-500';
      td.innerText = '0';
      r0.appendChild(td);
    }
    tbody.appendChild(r0);

    // Rows for items
    items.forEach((item, idx) => {
      const i = idx + 1; // 1-based
      const r = document.createElement('tr');
      // Checkbox/Icon
      r.innerHTML = `<td class="border border-gray-700 bg-gray-800 p-1">${item.name}</td>`;

      for(let w=0; w<=CAPACITY; w++) {
        const td = document.createElement('td');
        td.id = `cell-${i}-${w}`;
        td.className = 'border border-gray-700 p-1';
        td.innerText = '';
        r.appendChild(td);
      }
      tbody.appendChild(r);
    });

    table.appendChild(tbody);
  }

  buildTable();
  gridContainer.appendChild(table);

  const resultDiv = document.createElement('div');
  resultDiv.className = 'mt-2 h-8 text-sm font-bold text-center ac-accent-blue';
  resultDiv.id = 'knap-msg';

  wrapper.append(header, itemsContainer, controls, gridContainer, resultDiv);
  container.appendChild(wrapper);

  // Logic
  let isRunning = false;
  let stopSignal = false;

  async function runSim() {
    if(isRunning) { // Reset if clicked again
      stopSignal = true;
      await new Promise(r => setTimeout(r, 100)); // Wait for loop break
      stopSignal = false;
    }

    isRunning = true;
    buildTable(); // Clear cells
    document.getElementById('knap-msg').innerText = 'Initialisation...';

    // Reset Logic Vars
    dp = Array(items.length + 1).fill().map(() => Array(CAPACITY + 1).fill(0));

    // Anim Loop
    for (let i = 1; i <= items.length; i++) {
      const item = items[i-1];
      const weight = item.w;
      const value = item.v;

      for (let w = 0; w <= CAPACITY; w++) {
        if (stopSignal) { isRunning = false; return; }

        const cell = document.getElementById(`cell-${i}-${w}`);
        cell.classList.add('bg-white', 'text-black'); // Highlight active

        // Logic
        const valWithout = dp[i-1][w];
        let valWith = 0;
        let pick = false;

        if (w >= weight) {
          valWith = value + dp[i-1][w-weight];
        }

        // Highlight parents
        const p1 = document.getElementById(`cell-${i-1}-${w}`); // Above
        const p2 = (w >= weight) ? document.getElementById(`cell-${i-1}-${w-weight}`) : null; // Left

        if(p1) {p1.classList.add('bg-blue-500', 'text-white');}
        if(p2) {p2.classList.add('bg-green-500', 'text-white');}

        let msg = '';
        if (weight > w) {
          dp[i][w] = valWithout;
          msg = `Poids ${weight} > Cap ${w}. On reporte le haut (${valWithout}).`;
        } else {
          if (valWith > valWithout) {
            dp[i][w] = valWith;
            pick = true;
            msg = `Max(Haut=${valWithout}, Pris=${value}+${dp[i-1][w-weight]}=${valWith}) → On PREND !`;
          } else {
            dp[i][w] = valWithout;
            msg = `Max(Haut=${valWithout}, Pris=${valWith}) → On laisse.`;
          }
        }

        document.getElementById('knap-msg').innerText = msg;
        cell.innerText = dp[i][w];

        await new Promise(r => setTimeout(r, 150)); // Speed

        // Cleanup highlights
        cell.classList.remove('bg-white', 'text-black');
        if (pick) {cell.classList.add('bg-green-900', 'text-green-200');} // Picked choice highlight
        else {cell.classList.add('text-white');} // Normal

        if(p1) {p1.classList.remove('bg-blue-500', 'text-white');}
        if(p2) {p2.classList.remove('bg-green-500', 'text-white');}
      }
    }

    // Traceback (Optional or just show max)
    document.getElementById('knap-msg').innerHTML = `Terminé ! Valeur Max = ${dp[items.length][CAPACITY]}`;
    isRunning = false;
  }

  btnRun.onclick = runSim;
}
