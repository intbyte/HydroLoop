# HydroLoop 💧
An interactive, browser-based Hydraulic Network Solver using the Hardy Cross Method.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features
- **Interactive Canvas:** Draw nodes and pipes with intuitive mouse controls.
- **Dynamic Topology:** Double-click pipes to create junctions (Edge Splitting).
- **Hardy-Cross Solver:** Real-time balancing of head loss and flow rates.
- **Visual Feedback:** Directional arrows and flow magnitude labels.

## How It Works
HydroLoop uses the **Newton-Raphson** approach to iteratively solve for flow corrections ($\Delta Q$):
$$\Delta Q = -\frac{\sum K Q |Q|}{\sum 2 K |Q|}$$

The engine automatically detects fundamental cycles using a Spanning Tree algorithm and standardizes loop "walks" for consistent math.

## Usage
1. **Double-Click** on empty space to create a Node.
2. **Right-Drag** from node to node to draw a Pipe.
3. **Double-Click** a Pipe to split it with a new junction.
4. **Input Demands:** Select a node to set its inlet/outlet value.
5. **Run:** Click 'Run Iterations' to balance the network.

## License
Distributed under the MIT License. See `LICENSE` for more information.