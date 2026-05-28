/**
 * TODO: DECOUPLE ENGINE FROM FRONTEND UI (MIGRATION TO EVENT-DRIVEN ARCHITECTURE)
 * 
 * CURRENT ISSUE:
 * The engine directly invokes `render()` at the end of `solveHardyCross()`.
 * This creates a tight coupling (dependency) between the math engine and the 
 * canvas rendering layer. It forces `js/canvas.js` to always be loaded before 
 * the engine, and prevents running this solver in isolated testing environments 
 * (like Node.js or Web Workers) where a canvas context does not exist.
 * 
 * REFACTORING STEPS:
 * 1. Locate the end of the `solveHardyCross()` function in this file.
 * 2. Remove or comment out the line:
 *    `if (typeof render === "function") render();`
 * 3. Replace it with a native global event dispatch:
 *    `window.dispatchEvent(new Event('network-updated'));`
 * 4. Open `js/app.js` (the orchestrator) and add a global listener at the bottom:
 *    `window.addEventListener('network-updated', () => { if (typeof render === "function") render(); });`
 * 5. Also update the `reader.onload` block inside `importNetwork()` in `js/app.js` 
 *    to use `window.dispatchEvent(new Event('network-updated'));` instead of `render();`.
 * 
 * BENEFITS:
 * - Perfectly modular code: The engine processes data and announces updates without caring WHO is listening.
 * - Robust error handling: Eliminates potential `ReferenceError` crashes if script tags are reordered in HTML.
 * - Future-proof: Easily swap out the 2D canvas renderer for a WebGL layer or automated data logging later.
 */

/**
 * Physics & Math Engine
 */

/**
 * HARDY-CROSS SOLVER: "WALK-AROUND" METHOD
 * 1. Find fundamental cycles using spanning tree
 * 2. Walk the loop node-by-node to determine CW/CCW
 * 3. Apply correction based on drawn pipe orientation
 */

function solveHardyCross(iterations = 1) {
    // Diagonstics (v1.0.4)
    const diagnostics = runNetworkDiagnostics();

    // If there are errors, stop everything and warn the user.
    if (diagnostics.length > 0) {
        alert("NETWORK SETUP ERRORS FOUND:\n\n" + diagnostics.join("\n"));
        return;
    }

    console.log("Network is balanced. Running Hardy-Cross...");
    // End of diagonstics

    const cycles = findFundamentalCycles();
    
    if (cycles.length === 0) {
        console.warn("SOLVER: No loops detected in the network.");
        return;
    }

    console.clear();
    console.log(`%c RUNNING HARDY-CROSS: ${cycles.length} LOOP(S) FOUND `, "background: #222; color: #bada55; font-size: 1.2em;");

    for (let i = 0; i < iterations; i++) {
        
        // Create a fresh map to hold pending changes for this iteration step
        const edgeCorrections = new Map();
        state.edges.forEach(e => edgeCorrections.set(e, 0));

        cycles.forEach((loop, loopIdx) => {
            let sumKQ2 = 0;    
            let sum2KQ = 0;    

            loop.forEach(item => {
                const e = item.edge;
                const Q_loop = e.Q * item.dir;
                sumKQ2 += e.K * Q_loop * Math.abs(Q_loop);
                sum2KQ += 2 * e.K * Math.abs(Q_loop);

                // LOGGING THE WALK
                /*
                console.log(
                    `Pipe: [${Math.round(e.from.x)},${Math.round(e.from.y)}] -> [${Math.round(e.to.x)},${Math.round(e.to.y)}]\n` +
                    `  Current Q: ${e.Q}\n` +
                    `  Walk Direction: ${walkDir === 1 ? 'WITH Pipe' : 'AGAINST Pipe'}\n` +
                    `  Relative Q (for math): ${Q_loop}`
                );
                */
            });

            const EPS = 1e-12;

            if (Math.abs(sum2KQ) < EPS) {
                console.warn("Divide by zero error or Loop derivative too small: No flow in loop.");
                return; // Acts as continue. If I ever implement for loop, this will completely exit the solver (CAUTION)
            }

            // Using your exact original sign convention logic here:
            const dQ = -sumKQ2 / sum2KQ; 

            // Instead of mutating item.edge.Q directly, stack the change in our map
            loop.forEach(item => {
                const currentAccumulatedCorrection = edgeCorrections.get(item.edge);
                edgeCorrections.set(item.edge, currentAccumulatedCorrection + (dQ * item.dir));
            });
        });

        // Finally, all loops are evaluated. Apply all corrections simultaneously.
        edgeCorrections.forEach((correction, edge) => {
            edge.Q += correction;
        });
    }
    
    if (typeof render === "function") render();
}

function findFundamentalCycles() {
    const cycles = [];
    const treeEdges = new Set();
    const parentMap = new Map();
    const visited = new Set();

    // 1. Standard Spanning Tree to find chords
    state.nodes.forEach(startNode => {
        if (!visited.has(startNode)) {
            const stack = [startNode];
            visited.add(startNode);
            while (stack.length > 0) {
                const curr = stack.pop();
                state.edges.forEach(edge => {
                    let next = null;
                    if (edge.from === curr) next = edge.to;
                    else if (edge.to === curr) next = edge.from;
                    
                    if (next && !visited.has(next)) {
                        visited.add(next);
                        treeEdges.add(edge);
                        parentMap.set(next, { parent: curr, edge: edge });
                        stack.push(next);
                    }
                });
            }
        }
    });

    const chords = state.edges.filter(e => !treeEdges.has(e));

    chords.forEach(chord => {
        let loop = [];
        let nodesInLoop = [];
        
        // Trace paths to LCA
        let pathA = [], pathB = [];
        let tA = chord.from, tB = chord.to;
        while (tA) { pathA.push(tA); tA = parentMap.get(tA)?.parent; }
        while (tB) { pathB.push(tB); tB = parentMap.get(tB)?.parent; }
        let lca = pathA.find(n => pathB.includes(n));

        // Construct the sequence of nodes: Chord.from -> LCA -> Chord.to -> Chord.from
        let curr = chord.from;
        while (curr !== lca) {
            const info = parentMap.get(curr);
            loop.push({ edge: info.edge, from: curr, to: info.parent });
            curr = info.parent;
        }
        let rightSide = [];
        curr = chord.to;
        while (curr !== lca) {
            const info = parentMap.get(curr);
            rightSide.push({ edge: info.edge, from: info.parent, to: curr });
            curr = info.parent;
        }
        loop.push(...rightSide.reverse());
        loop.push({ edge: chord, from: chord.to, to: chord.from });

        // FINAL STEP: Map the "Walk" to the "Pipe"
        const finalLoop = loop.map(step => {
            // dir is 1 if our walk (step.from -> step.to) matches drawn pipe (edge.from -> edge.to)
            const dir = (step.edge.from === step.from) ? 1 : -1;
            return { edge: step.edge, dir: dir };
        });

        cycles.push(finalLoop);
    });
    return cycles;
}

function getNetworkStats() {
  const nodeCount = state.nodes.length;
  const edgeCount = state.edges.length;
  
  if (nodeCount === 0) return { loops: 0, components: 0 };

  // Track visited nodes to find separate "islands" (components)
  const visited = new Set();
  let components = 0;

  state.nodes.forEach(startNode => {
    if (!visited.has(startNode)) {
      components++;
      // Basic BFS to find all connected nodes in this island
      const queue = [startNode];
      visited.add(startNode);
      
      while (queue.length > 0) {
        const curr = queue.shift();
        // Find neighbors via edges
        state.edges.forEach(edge => {
          let neighbor = null;
          if (edge.from === curr) neighbor = edge.to;
          if (edge.to === curr) neighbor = edge.from;
          
          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
  });

  // Euler's formula for circuit rank: L = E - V + C
  const loopCount = edgeCount - nodeCount + components;
  
  return {
    loops: Math.max(0, loopCount),
    components: components,
    edges: edgeCount,
    nodes: nodeCount
  };
}