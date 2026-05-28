/**
 * Main Architecture State & UI Bridge
 */

const state = {
  nodes: [],
  edges: [],
  selected: null, // { type: 'node'|'edge', obj: ref }
  isDragging: false,
  dragTarget: null,
  edgeDraft: null,
  rightMouseDownPos: null,
  hasMovedSignificantly: false,
  filename: "untitled-network",

  // Pan
  isPanning: false,
  panStart: { x: 0, y: 0 },
  camera: { x: 0, y: 0 }
};

function select(type, obj) {
  state.selected = type ? { type, obj } : null;
  updateUI();
}

function updateUI() {
  const ui = document.getElementById("selection-ui");
  if (!state.selected) {
    ui.innerHTML = `<div class="empty-state">Select an object to edit properties</div>`;
    return;
  }

  const { type, obj } = state.selected;
  const isNode = type === 'node';

  ui.innerHTML = `
    <div style="font-size:10px; font-weight:bold; margin-bottom:20px; color:var(--accent)">
      EDITING_${type.toUpperCase()}
    </div>
    <div class="prop-group">
      <label>${isNode ? 'DEMAND (L/S)' : 'RESISTANCE (K)'}</label>
      <input type="number" step="0.1" value="${isNode ? obj.demand : obj.K}" 
             oninput="syncVal(this.value, '${isNode ? 'demand' : 'K'}')">
    </div>
    ${!isNode ? `
    <div class="prop-group">
      <label>INITIAL FLOW (Q)</label>
      <input type="number" step="0.1" value="${obj.Q}" 
             oninput="syncVal(this.value, 'Q')">
    </div>` : ''}
    <button class="btn-danger" onclick="deleteSelected()">DELETE ${type.toUpperCase()}</button>
  `;
}

function syncVal(val, key) {
  if (state.selected) {
    state.selected.obj[key] = parseFloat(val) || 0;
  }
}

function deleteSelected() {
  if (!state.selected) return;
  const { type, obj } = state.selected;
  if (type === 'node') {
    state.edges = state.edges.filter(ed => ed.from !== obj && ed.to !== obj);
    state.nodes = state.nodes.filter(n => n !== obj);
  } else {
    state.edges = state.edges.filter(ed => ed !== obj);
  }
  select(null);
}

function exportNetwork() {
  // Create an object containing all data needed to rebuild the network
  const dataStr = JSON.stringify({
    nodes: state.nodes,
    edges: state.edges.map(e => ({
      // Map edges to save ID references of nodes instead of full objects
      fromIndex: state.nodes.indexOf(e.from),
      toIndex: state.nodes.indexOf(e.to),
      K: e.K,
      Q: e.Q
    }))
  }, null, 2); // The '2' spaces it nicely so it's readable if opened in notepad

  // Create a temporary link element to trigger the download
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.href = url;
  //link.download = "pipe-network.json"; // Name of the downloaded file
  link.download = `${state.filename}.json`;
  link.click();
  
  // Clean up memory
  URL.revokeObjectURL(url);
}

function importNetwork(event) {
  const file = event.target.files[0];
  if (!file) return;

  const nameWithoutExtension = file.name.replace(/\.json$/i, '');
  state.filename = nameWithoutExtension;
  document.getElementById('project-name-input').value = nameWithoutExtension;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      
      // Restore nodes
      state.nodes = imported.nodes;
      
      // Re-link edges back to their actual node objects in memory
      state.edges = imported.edges.map(savedEdge => ({
        from: state.nodes[savedEdge.fromIndex],
        to: state.nodes[savedEdge.toIndex],
        K: savedEdge.K,
        Q: savedEdge.Q
      }));

      // Clear any active selections and redraw the canvas
      state.selected = null;
      if (typeof render === "function") render();
      console.log("Network imported successfully!");

      centerCameraOnNetwork();  // to recenter
      
    } catch (err) {
      alert("Error parsing file. Ensure it is a valid HydroLoop save file.");
    }
  };
  
  reader.readAsText(file);
}

function updateFilename(newName) {
  // Clean up the string: replace spaces with dashes, remove illegal file characters
  state.filename = newName.trim().replace(/[^a-zA-Z0-9-_]/g, '-') || "untitled-network";
  document.getElementById('project-name-input').value = state.filename;
}

// DEBUG TOOL: Check for hardware "chatter"
/*
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) console.log("%c RIGHT DOWN ", "background: #222; color: #bada55");
});
canvas.addEventListener('mouseup', (e) => {
  if (e.button === 2) console.log("%c RIGHT UP ", "background: #222; color: #ff0000");
});
*/

// Global System Ignition
init();

function centerCameraOnNetwork() {
    // Safety Net: If the grid is empty, reset the camera tracking to dead center zero
    if (state.nodes.length === 0) {
        state.camera = { x: 0, y: 0 };
        const container = document.getElementById("canvas-container");
        if (container) container.style.backgroundPosition = "0px 0px";
        return;
    }

    // Gather all unique node positions
    const xs = state.nodes.map(n => n.x);
    const ys = state.nodes.map(n => n.y);
    
    // Compute the minimum and maximum boundaries of your pipe network
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // Pinpoint the dead geometric center of your pipe installation
    const networkCenterX = (minX + maxX) / 2;
    const networkCenterY = (minY + maxY) / 2;

    // Calculate the offset needed to match the network center with the browser window center
    const canvasEl = document.getElementById("canvas");
    state.camera.x = (canvasEl.width / 2) - networkCenterX;
    state.camera.y = (canvasEl.height / 2) - networkCenterY;
    
    // Update the CSS dot grid alignment to matches the shift seamlessly
    const container = document.getElementById("canvas-container");
    if (container) {
        container.style.backgroundPosition = `${state.camera.x}px ${state.camera.y}px`;
    }
}

// Initialize Theme Control System safely during startup
(function initTheme() {
  const savedTheme = localStorage.getItem('hydroloop-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Make sure the button state matches the theme after the DOM finishes cooking
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = savedTheme === 'dark' ? 'LIGHT' : 'DARK';
  });
})();

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('hydroloop-theme', newTheme);
  
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = newTheme === 'dark' ? 'LIGHT' : 'DARK';
}

function runNetworkDiagnostics() {
  let errors = [];
  const tolerance = 0.001; // Prevents false positives from JS decimal math

  // System-Wide Mass Balance
  let totalSystemFlow = 0;
  state.nodes.forEach(n => {
    // (+) Positive = Supply (water entering the network)
    // (-) Negative = Demand (water leaving the network)
    totalSystemFlow += (n.demand || 0); 
  });

  // If the total isn't zero, the system is fundamentally broken
  if (Math.abs(totalSystemFlow) > tolerance) {
    const imbalanceType = totalSystemFlow > 0 ? "Excess Supply" : "Excess Demand";
    errors.push(`System Imbalance: Total supply and demand do not match. Net difference: ${totalSystemFlow.toFixed(3)} (${imbalanceType})`);
  }

  // Nodal Continuity (Are initial Qs assigned correctly?)
  state.nodes.forEach((node, index) => {
    const nodeName = node.name || `Node ${index + 1}`;
    
    // Start the nodal balance with the external supply/demand at this junction
    let nodalBalance = (node.demand || 0); 

    state.edges.forEach(edge => {
      // If water is flowing to this node from a pipe, it ADDS water to the junction (+)
      if (edge.to === node) {
        nodalBalance += (edge.Q || 0);
      }
      // If water is flowing FROM this node into a pipe, it REMOVES water from the junction (-)
      if (edge.from === node) {
        nodalBalance -= (edge.Q || 0);
      }
    });

    // If the water entering minus the water leaving doesn't perfectly equal zero, a leak!
    if (Math.abs(nodalBalance) > tolerance) {
      errors.push(`Continuity Error at ${nodeName}: Pipe flows do not match external supply/demand. Off by ${nodalBalance.toFixed(3)}`);
    }
  });

  return errors;
}