/**
 * Visualisation Graph Traversal (BFS)
 */
export function initGraphViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = 300;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // Simple graph
    // A connected to B, C
    // B connected to D, E
    // C connected to F
    const nodes = {
        'A': { x: 200, y: 50, neighbors: ['B', 'C'], state: 'unvisited' },
        'B': { x: 100, y: 150, neighbors: ['D', 'E'], state: 'unvisited' },
        'C': { x: 300, y: 150, neighbors: ['F'], state: 'unvisited' },
        'D': { x: 50, y: 250, neighbors: [], state: 'unvisited' },
        'E': { x: 150, y: 250, neighbors: [], state: 'unvisited' },
        'F': { x: 350, y: 250, neighbors: [], state: 'unvisited' }
    };

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Edges
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        Object.entries(nodes).forEach(([id, node]) => {
            node.neighbors.forEach(nid => {
                const neighbor = nodes[nid];
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(neighbor.x, neighbor.y);
                ctx.stroke();
            });
        });

        // Nodes
        Object.entries(nodes).forEach(([id, node]) => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
            
            if (node.state === 'active') ctx.fillStyle = '#f59e0b';
            else if (node.state === 'visited') ctx.fillStyle = '#10b981';
            else ctx.fillStyle = '#1f2937';

            ctx.fill();
            ctx.strokeStyle = '#9ca3af';
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(id, node.x, node.y);
        });
    }

    draw();

    const controls = document.createElement('div');
    controls.className = 'absolute bottom-2 left-0 w-full flex justify-center gap-2';
    
    const btnParam = document.createElement('button');
    btnParam.textContent = 'Lancer BFS (Largeur)';
    btnParam.className = 'px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500';
    
    btnParam.onclick = async () => {
        // Reset
        Object.values(nodes).forEach(n => n.state = 'unvisited');
        draw();
        
        const queue = ['A'];
        nodes['A'].state = 'active';
        draw();
        await new Promise(r => setTimeout(r, 600));

        while (queue.length > 0) {
            const currentId = queue.shift();
            nodes[currentId].state = 'visited';
            draw();

            for (const neighborId of nodes[currentId].neighbors) {
                 if (nodes[neighborId].state === 'unvisited') {
                      nodes[neighborId].state = 'active';
                      draw();
                      await new Promise(r => setTimeout(r, 600));
                      queue.push(neighborId);
                 }
            }
        }
    };
    
    const btnReset = document.createElement('button');
    btnReset.textContent = 'Reset';
    btnReset.className = 'px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600';
    btnReset.onclick = () => {
        Object.values(nodes).forEach(n => n.state = 'unvisited');
        draw();
    };


    controls.appendChild(btnReset);
    controls.appendChild(btnParam);
    container.appendChild(controls);
}
