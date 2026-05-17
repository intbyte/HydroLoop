/**
 * Graphics, Rendering & Canvas Inputs
 */

const canvas = document.getElementById("canvas"), ctx = canvas.getContext("2d");
const container = document.getElementById("canvas-container");

function init() {
  window.onresize = () => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; };
  window.onresize();

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('dblclick', handleDoubleClick);
  canvas.oncontextmenu = (e) => e.preventDefault();

  requestAnimationFrame(render);
}

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Converts raw screen pixels into absolute coordinate grid points (For panning v1.0.2)
function toWorld(screenPos) {
    return {
        x: screenPos.x - state.camera.x,
        y: screenPos.y - state.camera.y
    };
}

function findAt(x, y) {
  const node = state.nodes.find(n => Math.hypot(n.x - x, n.y - y) < 15);
  if (node) return { type: 'node', obj: node };
  const edge = state.edges.find(e => {
    const {x: x1, y: y1} = e.from, {x: x2, y: y2} = e.to, l2 = Math.hypot(x2-x1, y2-y1)**2;
    if (l2 === 0) return false;
    let t = Math.max(0, Math.min(1, ((x-x1)*(x2-x1) + (y-y1)*(y2-y1)) / l2));
    return Math.hypot(x - (x1 + t*(x2-x1)), y - (y1 + t*(y2-y1))) < 10;
  });
  return edge ? { type: 'edge', obj: edge } : null;
}

function handleDoubleClick(e) {
  const screenPos = getPos(e);
  const {x, y} = toWorld(screenPos);
  const hit = findAt(x, y);

  if (!hit) {
    // Normal behavior: Create isolated node
    const newNode = { x, y, demand: 0 };
    state.nodes.push(newNode);
    select('node', newNode);
  } else if (hit.type === 'edge') {
    // EDGE SPLIT LOGIC
    const originalEdge = hit.obj;
    
    // Create the new junction node at click position
    const midNode = { x, y, demand: 0 };
    state.nodes.push(midNode);
    
    // Create two new pipes connecting through the midNode
    // We copy the K value from the original pipe for both new segments
    const segmentA = { from: originalEdge.from, to: midNode, K: originalEdge.K, Q: originalEdge.Q };
    const segmentB = { from: midNode, to: originalEdge.to, K: originalEdge.K, Q: originalEdge.Q };
    
    state.edges.push(segmentA, segmentB);
    
    // Remove the old long pipe
    state.edges = state.edges.filter(ed => ed !== originalEdge);
    
    // Select the new node
    select('node', midNode);
  } else if (hit.type === 'node') {
    // Already a node here, maybe just select it
    select('node', hit.obj);
  }
}

function handleMouseDown(e) {
    const screenPos = getPos(e);
    const worldPos = toWorld(screenPos); // Translate mouse position to the world grid

    if (e.button === 1) { // Middle Mouse Button Clicked
        canvas.classList.add('panning-active');
        state.isPanning = true;
        // Track where the drag started relative to the current camera offset
        state.panStart = { x: screenPos.x - state.camera.x, y: screenPos.y - state.camera.y };
        return; // Bypass normal node selection logic while panning
    }

    if (e.button === 0) { // Left Click
        const hit = findAt(worldPos.x, worldPos.y); // Use world coordinates
        if (hit) {
            select(hit.type, hit.obj);
            if (hit.type === 'node') { state.isDragging = true; state.dragTarget = hit.obj; }
        } else {
            select(null);
        }
    } 
    else if (e.button === 2) { // Right Click
        state.rightMouseDownPos = worldPos; // Store world position
        state.hasMovedSignificantly = false;
        const hit = findAt(worldPos.x, worldPos.y);
        if (hit?.type === 'node') {
            state.edgeDraft = { from: hit.obj, to: { x: worldPos.x, y: worldPos.y } };
        }
    }
}

/*
function handleMouseDown(e) {
  const {x, y} = getPos(e);
  const hit = findAt(x, y);

  if (e.button === 0) { // Left
    if (hit) {
      select(hit.type, hit.obj);
      if (hit.type === 'node') { state.isDragging = true; state.dragTarget = hit.obj; }
    } else {
      select(null);
    }
  } 
  else if (e.button === 2) { // Right
    state.rightMouseDownPos = {x, y};
    state.hasMovedSignificantly = false;
    if (hit?.type === 'node') {
      state.edgeDraft = { from: hit.obj, to: { x, y } };
    }
  }
}
*/

function handleMouseMove(e) {
    const screenPos = getPos(e);
    const worldPos = toWorld(screenPos); // Translate mouse position to world grid

    if (state.isPanning) {
        // Calculate shifted camera positions
        state.camera.x = screenPos.x - state.panStart.x;
        state.camera.y = screenPos.y - state.panStart.y;
        
        // Offset the background CSS dots so they shift fluidly with the grid
        container.style.backgroundPosition = `${state.camera.x}px ${state.camera.y}px`;
        return;
    }

    if (state.isDragging && state.dragTarget) {
        state.dragTarget.x = worldPos.x; // Drag nodes using absolute world coordinates
        state.dragTarget.y = worldPos.y;
    }
    if (state.edgeDraft) {
        state.edgeDraft.to = { x: worldPos.x, y: worldPos.y };
        if (Math.hypot(worldPos.x - state.rightMouseDownPos.x, worldPos.y - state.rightMouseDownPos.y) > 10) {
            state.hasMovedSignificantly = true;
        }
    }
}

/*
function handleMouseMove(e) {
  const {x, y} = getPos(e);
  if (state.isDragging && state.dragTarget) {
    state.dragTarget.x = x; state.dragTarget.y = y;
  }
  if (state.edgeDraft) {
    state.edgeDraft.to = {x, y};
    if (Math.hypot(x - state.rightMouseDownPos.x, y - state.rightMouseDownPos.y) > 10) {
      state.hasMovedSignificantly = true;
    }
  }
}
*/

function handleMouseUp(e) {
    if (e.button === 1) { // Middle Mouse Button Released
        canvas.classList.remove('panning-active');
        state.isPanning = false;
        return;
    }

    const screenPos = getPos(e);
    const { x, y } = toWorld(screenPos); // Extract final coordinates in World Space

    if (e.button === 2) { // Right Click
        if (state.edgeDraft) {
            if (state.hasMovedSignificantly) {
                const endNode = state.nodes.find(n => Math.hypot(n.x - x, n.y - y) < 15);
                const exists = endNode && state.edges.find(ed => 
                    (ed.from === state.edgeDraft.from && ed.to === endNode) ||
                    (ed.from === endNode && ed.to === state.edgeDraft.from)
                );

                if (endNode && endNode !== state.edgeDraft.from && !exists) {
                    state.edges.push({ from: state.edgeDraft.from, to: endNode, K: 1.0, Q: 0 });
                }
            } else {
                const hit = findAt(x, y);
                if (hit) {
                    if (hit.type === 'node') {
                        state.edges = state.edges.filter(ed => ed.from !== hit.obj && ed.to !== hit.obj);
                        state.nodes = state.nodes.filter(n => n !== hit.obj);
                    } else {
                        state.edges = state.edges.filter(ed => ed !== hit.obj);
                    }
                    if (state.selected?.obj === hit.obj) select(null);
                }
            }
        } else {
            const hit = findAt(x, y);
            if (hit && hit.type === 'edge') {
                state.edges = state.edges.filter(ed => ed !== hit.obj);
                if (state.selected?.obj === hit.obj) select(null);
            }
        }
    }

    state.isDragging = false;
    state.dragTarget = null;
    state.edgeDraft = null;
    state.rightMouseDownPos = null;
    state.hasMovedSignificantly = false;
}

/*
function handleMouseUp(e) {
  const { x, y } = getPos(e);

  if (e.button === 2) { // Right Click
    if (state.edgeDraft) {
      if (state.hasMovedSignificantly) {
        // ACTION A: FINISH DRAWING PIPE
        const endNode = state.nodes.find(n => Math.hypot(n.x - x, n.y - y) < 15);
        
        // Prevent self-loop and duplicates
        const exists = endNode && state.edges.find(ed => 
          (ed.from === state.edgeDraft.from && ed.to === endNode) ||
          (ed.from === endNode && ed.to === state.edgeDraft.from)
        );

        if (endNode && endNode !== state.edgeDraft.from && !exists) {
          state.edges.push({ from: state.edgeDraft.from, to: endNode, K: 1.0, Q: 0 });
        }
      } else {
        // ACTION B: DELETE (Only runs if the mouse DID NOT move)
        const hit = findAt(x, y);
        if (hit) {
          if (hit.type === 'node') {
            state.edges = state.edges.filter(ed => ed.from !== hit.obj && ed.to !== hit.obj);
            state.nodes = state.nodes.filter(n => n !== hit.obj);
          } else {
            state.edges = state.edges.filter(ed => ed !== hit.obj);
          }
          if (state.selected?.obj === hit.obj) select(null);
        }
      }
    } else {
      // Handle right-click deletion for edges when not starting from a node
      const hit = findAt(x, y);
      if (hit && hit.type === 'edge') {
        state.edges = state.edges.filter(ed => ed !== hit.obj);
        if (state.selected?.obj === hit.obj) select(null);
      }
    }
  }

  // Reset all interaction states
  state.isDragging = false;
  state.dragTarget = null;
  state.edgeDraft = null;
  state.rightMouseDownPos = null;
  state.hasMovedSignificantly = false;
}

*/

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();   // these 2 lines added v1.0.2
  ctx.translate(state.camera.x, state.camera.y);

  state.edges.forEach(e => {
    const isSelected = state.selected?.obj === e;
    ctx.beginPath();
    ctx.moveTo(e.from.x, e.from.y);
    ctx.lineTo(e.to.x, e.to.y);
    ctx.strokeStyle = isSelected ? varToHex('--accent') : "#888";
    ctx.lineWidth = isSelected ? 5 : 3;
    ctx.stroke();

    const angle = Math.atan2(e.to.y - e.from.y, e.to.x - e.from.x);
    const mx = (e.from.x + e.to.x)/2, my = (e.from.y + e.to.y)/2;
    drawArrow(e.from.x + Math.cos(angle)*25, e.from.y + Math.sin(angle)*25, angle, 10, isSelected ? varToHex('--accent') : "#bbb");
    // drawText(`K:${e.K} Q:${e.Q}`, mx, my - 14, isSelected ? varToHex('--accent') : "#000");
    drawText(`K:${e.K} Q:${e.Q.toFixed(2)}`, mx, my - 14, isSelected ? varToHex('--accent') : varToHex('--text'));
  });

  if (state.edgeDraft) {
    ctx.setLineDash([5,5]); ctx.beginPath();
    ctx.moveTo(state.edgeDraft.from.x, state.edgeDraft.from.y);
    ctx.lineTo(state.edgeDraft.to.x, state.edgeDraft.to.y);
    ctx.strokeStyle = varToHex('--accent'); ctx.stroke(); ctx.setLineDash([]);
  }

  state.nodes.forEach(n => {
    const isSelected = state.selected?.obj === n;
    ctx.fillStyle = isSelected ? varToHex('--accent') : "white";
    ctx.strokeStyle = "black"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(n.x - 8, n.y - 8, 16, 16);
    ctx.fill(); ctx.stroke();
    if(n.demand !== 0) drawText(`${n.demand}`, n.x, n.y - 20, isSelected ? varToHex('--accent') : "#1a1a1a");
  });

  ctx.restore();    // added v1.0.2

  requestAnimationFrame(render);
}

function drawText(txt, x, y, color) {
  ctx.font = "bold 14px Consolas";
  const w = ctx.measureText(txt).width;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(x - w/2 - 2, y - 9, w + 4, 12);
  ctx.fillStyle = color; ctx.textAlign = "center";
  ctx.fillText(txt, x, y);
}

function drawArrow(x, y, angle, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(0, -size/2); ctx.lineTo(0, size/2);
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

function varToHex(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }