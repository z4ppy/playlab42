/**
 * Visualisation du Voyageur de Commerce (TSP)
 * Illustre la différence entre P (Heuristique Gloutonne) et NP-Hard (Brute Force)
 */
export function initTSPViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    const width = Math.min(container.clientWidth, 800);
    const height = 400;
    canvas.width = width;
    canvas.height = height;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    // Config
    let cities = [];
    const NUM_CITIES_SMALL = 6;
    const NUM_CITIES_LARGE = 150;
    
    // State
    let isRunning = false;
    let shouldStop = false;
    let bestOrder = [];
    let bestDist = Infinity;
    
    // Controls
    const controls = document.createElement('div');
    controls.className = 'flex flex-wrap gap-2 mt-4 justify-center items-center';
    
    // Buttons
    const btnRandSmall = createBtn('N=6 (Petit)', 'bg-gray-600', () => resetCities(NUM_CITIES_SMALL));
    const btnRandLarge = createBtn('N=50 (Grand)', 'bg-gray-600', () => resetCities(50));
    const btnBrute = createBtn('Brute Force (Exact)', 'bg-red-600', () => solveBruteForce());
    const btnGreedy = createBtn('Glouton (Approx)', 'bg-green-600', () => solveGreedy());
    const btn2Opt = createBtn('2-Opt (Local Search)', 'bg-blue-600', () => solve2Opt());

    const statusDiv = document.createElement('div');
    statusDiv.className = 'w-full text-center mt-2 font-mono text-sm ac-text-secondary';
    statusDiv.innerHTML = 'Prêt.';

    controls.append(btnRandSmall, btnRandLarge, btnBrute, btnGreedy, btn2Opt, statusDiv);
    container.appendChild(controls);

    function createBtn(text, color, cb) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = `px-3 py-1 ${color} text-white rounded text-sm hover:opacity-90 font-bold`;
        btn.onclick = cb;
        return btn;
    }

    function resetCities(n) {
        shouldStop = true;
        setTimeout(() => {
            isRunning = false;
            shouldStop = false;
            cities = [];
            bestOrder = [];
            bestDist = Infinity;
            
            const margin = 30;
            for(let i=0; i<n; i++) {
                cities.push({
                    x: Math.random() * (width - 2*margin) + margin,
                    y: Math.random() * (height - 2*margin) + margin
                });
            }
            
            // Initial path: 0, 1, 2...
            bestOrder = cities.map((_, i) => i);
            bestDist = 0; // Invalid yet
            statusDiv.innerHTML = `${n} villes générées. <span class="text-xs text-gray-500">Choisir un algo.</span>`;
            draw(bestOrder, null);
        }, 50);
    }
    
    function draw(order, currentCandidate) {
        ctx.clearRect(0, 0, width, height);
        
        // Draw Cities
        ctx.fillStyle = '#fff';
        cities.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw Current Candidate (Red, thin)
        if (currentCandidate) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cities[currentCandidate[0]].x, cities[currentCandidate[0]].y);
            for(let i=1; i<currentCandidate.length; i++) {
                const idx = currentCandidate[i];
                ctx.lineTo(cities[idx].x, cities[idx].y);
            }
            ctx.closePath(); // Return to start
            ctx.stroke();
        }
        
        // Draw Best Path (Green/White, thick)
        if (order && order.length > 0) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cities[order[0]].x, cities[order[0]].y);
            for(let i=1; i<order.length; i++) {
                const idx = order[i];
                ctx.lineTo(cities[idx].x, cities[idx].y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

    function calcDist(order) {
        let sum = 0;
        for(let i=0; i<order.length-1; i++) {
            const a = cities[order[i]];
            const b = cities[order[i+1]];
            sum += Math.hypot(a.x - b.x, a.y - b.y);
        }
        // Return to start
        const last = cities[order[order.length-1]];
        const first = cities[order[0]];
        sum += Math.hypot(last.x - first.x, last.y - first.y);
        return sum;
    }

    function factorial(n) {
        if (n===0 || n===1) return 1;
        return n * factorial(n-1);
    }

    // --- ALGOS ---

    async function solveBruteForce() {
        if (cities.length > 10) {
            statusDiv.innerHTML = '<span class="text-red-400">Erreur: Trop de villes pour Brute Force (Max 10). O(N!) exploserait votre CPU.</span>';
            return;
        }
        if (isRunning) return;
        isRunning = true;
        
        // Lexicographical Permutation order
        let order = cities.map((_, i) => i);
        const n = order.length;
        const totalPerms = factorial(n);
        let count = 0;
        
        bestDist = Infinity;
        
        statusDiv.textContent = 'Brute Force: Test de toutes les permutations...';
        
        const startTime = performance.now();
        
        // Heap's algorithm or iterative permutation
        // Let's use simple recursive for viz step-by-step
        // Actually, Heap's is better for generation
        // But for viz we want an iterative generator to await inside loop easily
        
        // Simple distinct Permutations:
        // Assume start city is 0 fixed to reduce N! to (N-1)! (Cyclic symmetry)
        // But let's do full dumb BF to show slowness
        
        // Helper to swap
        const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };
        
        async function heaps(k, A) {
            if (shouldStop) return;
            
            if (k === 1) {
                const d = calcDist(A);
                count++;
                if (d < bestDist) {
                    bestDist = d;
                    bestOrder = [...A];
                    draw(bestOrder, A);
                } else {
                    if (count % 100 === 0) draw(bestOrder, A); // Don't draw every frame
                }
                
                if (count % 500 === 0) {
                     statusDiv.textContent = `Testé: ${count} / ${totalPerms}`;
                     await new Promise(r => setTimeout(r, 0));
                }
            } else {
                for(let i=0; i<k; i++) {
                    await heaps(k-1, A);
                    if (shouldStop) return;
                    if (k%2 === 0) swap(A, i, k-1);
                    else swap(A, 0, k-1);
                }
            }
        }
        
        await heaps(n, [...order]);
        
        draw(bestOrder, null);
        const dt = (performance.now() - startTime).toFixed(0);
        statusDiv.innerHTML = `<span class="text-green-400">Terminé en ${dt}ms. Distance: ${Math.floor(bestDist)}</span>`;
        isRunning = false;
    }

    async function solveGreedy() {
        if (isRunning) return;
        isRunning = true;
        statusDiv.textContent = 'Glouton: Recherche du voisin le plus proche...';
        
        let unvisited = cities.map((_, i) => i);
        let current = unvisited.shift(); // Start at 0
        let path = [current];
        
        bestDist = 0;
        
        while(unvisited.length > 0) {
             if (shouldStop) break;
             
             let nearest = -1;
             let minDist = Infinity;
             
             // Find nearest
             for(let cityIdx of unvisited) {
                 const d = Math.hypot(cities[current].x - cities[cityIdx].x, cities[current].y - cities[cityIdx].y);
                 
                 // Visualize check
                 // draw(path, [current, cityIdx]); // Too fast to see really
                 
                 if (d < minDist) {
                     minDist = d;
                     nearest = cityIdx;
                 }
             }
             
             // Move to nearest
             path.push(nearest);
             bestDist += minDist;
             unvisited = unvisited.filter(x => x !== nearest);
             current = nearest;
             
             draw(path, null);
             await new Promise(r => setTimeout(r, 100)); // Sleep to show steps
        }
        
        // Close loop
        bestDist = calcDist(path);
        bestOrder = path;
        draw(bestOrder, null);
        
        statusDiv.innerHTML = `<span class="text-green-400">Terminé (Approx). Distance: ${Math.floor(bestDist)}</span>`;
        isRunning = false;
    }
    
    // 2-Opt (Local Search) - Improves existing path
    async function solve2Opt() {
        if (isRunning) return;
        isRunning = true;
        
        statusDiv.textContent = '2-Opt: Amélioration locale (démêlage)...';
        
        // Start with current best or identity
        let path = bestOrder.length ? [...bestOrder] : cities.map((_,i)=>i);
        let improved = true;
        
        while(improved) {
            improved = false;
            if (shouldStop) break;
            
            for (let i = 0; i < path.length - 1; i++) {
                for (let k = i + 1; k < path.length; k++) {
                    // Try reversing segment i...k
                    // Standard 2-opt swap for TSP
                    
                    // Current edges: (i-1)->i and k->(k+1)
                    // New edges: (i-1)->k and i->(k+1)
                    // But simpler: just check if reversing segment reduces total dist
                    
                    const newPath = twoOptSwap(path, i, k);
                    const newDist = calcDist(newPath);
                    const curDist = calcDist(path);
                    
                    if (newDist < curDist) {
                        path = newPath;
                        bestOrder = path;
                        draw(path, null); // Show improvement
                        improved = true;
                        await new Promise(r => setTimeout(r, 20)); // Viz
                        // Restart search after improvement (First Improvement strategy)
                        // Or continue (Best Improvement). First is simpler to code.
                    }
                }
            }
        }
         
        bestDist = calcDist(path);
        statusDiv.innerHTML = `<span class="text-green-400">2-Opt Optimisé. Distance: ${Math.floor(bestDist)}</span>`;
        isRunning = false;
    }
    
    function twoOptSwap(route, i, k) {
        // Take route[0...i-1]
        // Add route[i...k] reversed
        // Add route[k+1...end]
        const prefix = route.slice(0, i);
        const segment = route.slice(i, k + 1).reverse();
        const suffix = route.slice(k + 1);
        return prefix.concat(segment).concat(suffix);
    }

    resetCities(NUM_CITIES_SMALL);
}
