/**
 * Visualisation complète de Pathfinding (BFS, DFS, Dijkstra, A*)
 * Sur une grille 2D.
 */
export function initPathfindingViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    // Responsive width, fixed height enough for grid
    const width = Math.min(container.clientWidth, 800);
    const height = 300;
    canvas.width = width;
    canvas.height = height;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    // Grid Config
    const COLS = 30;
    const ROWS = 15;
    const CELL_SIZE = width / COLS;
    
    // Nodes
    let grid = [];
    let startNode = { c: 2, r: 7 };
    let endNode = { c: 27, r: 7 };
    
    // Controls UI
    const controls = document.createElement('div');
    controls.className = 'flex flex-wrap gap-2 mt-4 justify-center';
    
    const algos = [
        { id: 'bfs', label: 'BFS (Largeur)', color: 'bg-blue-600' },
        { id: 'dfs', label: 'DFS (Profondeur)', color: 'bg-purple-600' },
        { id: 'dijkstra', label: 'Dijkstra', color: 'bg-green-600' },
        { id: 'astar', label: 'A* (A-Star)', color: 'bg-pink-600' },
    ];
    
    const btnReset = document.createElement('button');
    btnReset.textContent = 'Réinitialiser / Murs';
    btnReset.className = 'px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 font-bold';
    btnReset.onclick = resetGrid;
    controls.appendChild(btnReset);

    let isRunning = false;
    let shouldStop = false;

    algos.forEach(algo => {
        const btn = document.createElement('button');
        btn.textContent = algo.label;
        btn.className = `px-3 py-1 ${algo.color} text-white rounded text-sm hover:opacity-90 font-bold`;
        btn.onclick = () => runAlgo(algo.id);
        controls.appendChild(btn);
    });
    
    container.appendChild(controls);
    
    // Logic
    class Node {
        constructor(c, r) {
            this.c = c;
            this.r = r;
            this.wall = false;
            this.visited = false;
            this.path = false;
            this.cost = Infinity;
            this.heuristic = 0;
            this.parent = null;
        }
    }
    
    function resetGrid() {
        if (isRunning) {
            shouldStop = true;
            setTimeout(resetGrid, 100);
            return;
        }
        
        grid = [];
        for(let r=0; r<ROWS; r++) {
            const row = [];
            for(let c=0; c<COLS; c++) {
                const node = new Node(c, r);
                // Random walls
                if (Math.random() < 0.25 && !(c===startNode.c && r===startNode.r) && !(c===endNode.c && r===endNode.r)) {
                    node.wall = true;
                }
                row.push(node);
            }
            grid.push(row);
        }
        draw();
    }
    
    function draw() {
        ctx.clearRect(0,0, width, height);
        
        // Draw Grid
        for(let r=0; r<ROWS; r++) {
            for(let c=0; c<COLS; c++) {
                const n = grid[r][c];
                const x = c * CELL_SIZE;
                const y = r * CELL_SIZE;
                
                ctx.strokeStyle = '#334155';
                ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
                
                if (n.wall) {
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                } else if (c === startNode.c && r === startNode.r) {
                    ctx.fillStyle = '#10b981'; // Start Green
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('A', x + CELL_SIZE/2, y + CELL_SIZE/2 + 4);
                } else if (c === endNode.c && r === endNode.r) {
                    ctx.fillStyle = '#ef4444'; // End Red
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('B', x + CELL_SIZE/2, y + CELL_SIZE/2 + 4);
                } else if (n.path) {
                    ctx.fillStyle = '#f59e0b'; // Path Yellow
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                } else if (n.visited) {
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Visited Blue
                    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }
    
    function getNeighbors(node) {
        const neighbors = [];
        const dirs = [[0,1], [1,0], [0,-1], [-1,0]]; // 4 directions (Manhattan)
        for(let d of dirs) {
            const nc = node.c + d[0];
            const nr = node.r + d[1];
            if(nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
                const neighbor = grid[nr][nc];
                if(!neighbor.wall) neighbors.push(neighbor);
            }
        }
        return neighbors;
    }
    
    async function reconstructPath(curr) {
        while(curr.parent) {
            curr.path = true;
            curr = curr.parent;
            draw();
            await new Promise(r => setTimeout(r, 20));
        }
        draw();
    }
    
    async function runAlgo(type) {
        if(isRunning) return;
        
        // Reset state but keep walls
        for(let r=0; r<ROWS; r++) {
            for(let c=0; c<COLS; c++) {
                grid[r][c].visited = false;
                grid[r][c].path = false;
                grid[r][c].parent = null;
                grid[r][c].cost = Infinity;
            }
        }
        
        isRunning = true;
        shouldStop = false;
        
        const start = grid[startNode.r][startNode.c];
        const end = grid[endNode.r][endNode.c];
        
        // Collections
        let openSet = []; // For Queue/Stack logic
        
        // Init
        start.cost = 0;
        
        if (type === 'bfs') {
            openSet.push(start);
            start.visited = true;
            
            while(openSet.length > 0) {
                if(shouldStop) break;
                
                const curr = openSet.shift(); // FIFO
                if(curr === end) { await reconstructPath(curr); break; }
                
                // Anim
                draw();
                await new Promise(r => setTimeout(r, 10)); // Speed
                
                for(let n of getNeighbors(curr)) {
                    if(!n.visited) {
                        n.visited = true;
                        n.parent = curr;
                        openSet.push(n);
                    }
                }
            }
        } else if (type === 'dfs') {
            openSet.push(start);
            start.visited = true;
             
             // Iterative DFS
            while(openSet.length > 0) {
                if(shouldStop) break;
                
                const curr = openSet.pop(); // LIFO
                
                // Note: Standard DFS marking visited on pop allows exploring paths, but for grid viz, better mark on push or strictly track. 
                // Let's stick to simple "visited" to avoid loops.
                // In DFS grid, if we don't mark visited, we loop.
                // If we mark visited, we get ONE path, not necessarily shortest.
                
                if(curr === end) { await reconstructPath(curr); break; }
                
                // Mark visited on expansion to draw correctly
                if (!curr.visited && curr !== start) curr.visited = true; 

                draw();
                await new Promise(r => setTimeout(r, 10));

                const neighbors = getNeighbors(curr);
                // Shuffle neighbors to make DFS look "random" and not just diagonal zig-zag
                // or just reverse to keep consistent direction
                
                for(let n of neighbors) {
                    if(!n.visited) {
                        n.visited = true;
                        n.parent = curr;
                        openSet.push(n);
                    }
                }
            }
        } else if (type === 'dijkstra') {
            // Priority Queue simulated by sorting
             openSet.push(start);
             
             while(openSet.length > 0) {
                 if(shouldStop) break;
                 
                 // Sort by cost (simplest generic PQ)
                 openSet.sort((a,b) => a.cost - b.cost);
                 const curr = openSet.shift();
                 
                 if(curr.visited) continue; // Setup for lazy Dijkstra
                 curr.visited = true;
                 
                 if(curr === end) { await reconstructPath(curr); break; }
                 
                 draw();
                 // Dijkstra on unweighted grid is basically BFS but let's visualize it expanding
                 
                 // Dynamic speed based on openSet size?
                 if (openSet.length % 5 === 0) await new Promise(r => setTimeout(r, 10));

                 for(let n of getNeighbors(curr)) {
                     const newCost = curr.cost + 1; // Weight 1
                     if(newCost < n.cost) {
                         n.cost = newCost;
                         n.parent = curr;
                         openSet.push(n);
                     }
                 }
             }
        } else if (type === 'astar') {
             start.heuristic = Math.abs(start.c - end.c) + Math.abs(start.r - end.r); // Manhattan
             openSet.push(start);
             
             while(openSet.length > 0) {
                 if(shouldStop) break;
                 
                 // Sort by f = g + h
                 openSet.sort((a,b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
                 const curr = openSet.shift();
                 
                 if(curr.visited) continue;
                 curr.visited = true;
                 
                 if(curr === end) { await reconstructPath(curr); break; }
                 
                 draw();
                 if (openSet.length % 5 === 0) await new Promise(r => setTimeout(r, 10));
                 
                 for(let n of getNeighbors(curr)) {
                     const newCost = curr.cost + 1;
                     if(newCost < n.cost) {
                         n.cost = newCost;
                         n.heuristic = Math.abs(n.c - end.c) + Math.abs(n.r - end.r);
                         n.parent = curr;
                         openSet.push(n);
                     }
                 }
             }
        }
        
        isRunning = false;
    }

    resetGrid();
}
