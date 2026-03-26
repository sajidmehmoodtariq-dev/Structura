import React, { useMemo, useRef, useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

/**
 * RecursionTreeCanvas — Renders a tree visualization of recursive function calls.
 *
 * Builds the tree INCREMENTALLY — only showing nodes that have been reached
 * up to the current step. As you step forward, new nodes appear with animation.
 *
 * Props:
 *   steps       – all execution steps
 *   currentStep – current step index (1-based, 0 = not started)
 */

// Clean return value: strip internal temp var names, only show readable values
const cleanReturnValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const s = String(val);
  // If it contains __ret_temp or other internal markers, hide it
  if (s.includes('__ret_temp') || s.includes('__')) return null;
  // If it's a pure number string
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
};

const RecursionTreeCanvas = ({ steps = [], currentStep = 0 }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Build the tree INCREMENTALLY — only process steps up to currentStep
  const tree = useMemo(() => {
    if (!steps || steps.length === 0 || currentStep === 0) return null;

    const limit = Math.min(currentStep, steps.length);
    let idCounter = 0;
    const root = {
      id: idCounter++, name: 'main', args: [], children: [],
      returnValue: null, stepIndex: -1, returnStepIndex: -1, depth: 0
    };
    const stack = [root];

    for (let i = 0; i < limit; i++) {
      const step = steps[i];

      if (step.type === 'CALL') {
        const parent = stack[stack.length - 1];
        const node = {
          id: idCounter++,
          name: step.data.name,
          args: (step.data.args || []).map(a => a.value ?? a.text),
          children: [],
          returnValue: null,
          stepIndex: i,
          returnStepIndex: -1,
          depth: stack.length,
        };
        parent.children.push(node);
        stack.push(node);
      } else if (step.type === 'RETURN') {
        const current = stack[stack.length - 1];
        if (current && current !== root) {
          // Only set return value if it's a clean readable value
          if (step.data && step.data.value !== undefined) {
            const cleaned = cleanReturnValue(step.data.value);
            if (cleaned !== null) {
              current.returnValue = cleaned;
            }
          }
          if (current.returnValue === null && step.data && step.data.expression) {
            const cleaned = cleanReturnValue(step.data.expression);
            if (cleaned !== null) {
              current.returnValue = cleaned;
            }
          }
        }
      } else if (step.type === 'RETURN_FROM_CALL') {
        const current = stack[stack.length - 1];
        if (current && current !== root) {
          current.returnStepIndex = i;
          stack.pop();
        }
      }
    }

    return root;
  }, [steps, currentStep]);

  // Determine which node is "active" at the current step
  const activeNodeId = useMemo(() => {
    if (!tree || currentStep === 0) return tree?.id ?? -1;

    let idCounter = 0;
    const nodeStack = [idCounter++]; // root id = 0
    let activeId = 0;
    const limit = Math.min(currentStep, steps.length);

    for (let i = 0; i < limit; i++) {
      const step = steps[i];
      if (step.type === 'CALL') {
        const newId = idCounter++;
        nodeStack.push(newId);
        activeId = newId;
      } else if (step.type === 'RETURN_FROM_CALL') {
        nodeStack.pop();
        activeId = nodeStack[nodeStack.length - 1] ?? 0;
      }
    }
    return activeId;
  }, [tree, currentStep, steps]);

  // Determine completed nodes (returnStepIndex < currentStep)
  const completedNodeIds = useMemo(() => {
    if (!tree) return new Set();
    const completed = new Set();
    const collect = (node) => {
      if (node.returnStepIndex >= 0 && node.returnStepIndex < currentStep) {
        completed.add(node.id);
      }
      node.children.forEach(collect);
    };
    collect(tree);
    return completed;
  }, [tree, currentStep]);

  // Flatten tree into positioned nodes for rendering
  const { nodes, edges, treeWidth, treeHeight } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [], treeWidth: 0, treeHeight: 0 };

    const NODE_W = 120;
    const NODE_H = 48;
    const H_GAP = 16;
    const V_GAP = 60;
    const positioned = [];
    const edgeList = [];

    // First pass: compute subtree widths
    const widthOf = (node) => {
      if (node.children.length === 0) return NODE_W;
      let total = 0;
      node.children.forEach((child, idx) => {
        total += widthOf(child);
        if (idx < node.children.length - 1) total += H_GAP;
      });
      return Math.max(NODE_W, total);
    };

    // Second pass: assign positions
    const layout = (node, x, y) => {
      const subtreeW = widthOf(node);
      const cx = x + subtreeW / 2;
      const cy = y + NODE_H / 2;

      positioned.push({ ...node, cx, cy, w: NODE_W, h: NODE_H });

      if (node.children.length > 0) {
        let childX = x;
        const childY = y + NODE_H + V_GAP;
        node.children.forEach((child) => {
          const childW = widthOf(child);
          layout(child, childX, childY);
          const childCx = childX + childW / 2;
          const childCy = childY + NODE_H / 2;
          edgeList.push({
            key: `${node.id}-${child.id}`,
            x1: cx,
            y1: cy + NODE_H / 2,
            x2: childCx,
            y2: childCy - NODE_H / 2,
            completed: completedNodeIds.has(child.id),
          });
          childX += childW + H_GAP;
        });
      }
    };

    layout(tree, 0, 0);
    const maxX = Math.max(...positioned.map(n => n.cx + n.w / 2), 0);
    const maxY = Math.max(...positioned.map(n => n.cy + n.h / 2), 0);

    return { nodes: positioned, edges: edgeList, treeWidth: maxX + 20, treeHeight: maxY + 20 };
  }, [tree, completedNodeIds]);

  if (!tree || nodes.length <= 1) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-[#0d1117]">
        <div className="text-center">
          <div className="text-2xl mb-2 opacity-40">🌳</div>
          <div className="text-gray-500 text-xs">No recursion detected yet</div>
          <div className="text-gray-600 text-[10px] mt-1">Step through a recursive function to build the call tree</div>
        </div>
      </div>
    );
  }

  // Compute offset so tree is centered
  const scale = Math.min(1, (dimensions.width - 32) / treeWidth, (dimensions.height - 32) / treeHeight);
  const offsetX = Math.max(16, (dimensions.width - treeWidth * scale) / 2);
  const offsetY = 16;

  return (
    <div ref={containerRef} className="flex-1 overflow-auto relative bg-[#0d1117]">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#a78bfa 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <svg
        width={Math.max(dimensions.width, treeWidth * scale + 32)}
        height={Math.max(dimensions.height, treeHeight * scale + 32)}
        className="relative z-10"
      >
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
          {/* Edges */}
          {edges.map(edge => (
            <motion.line
              key={edge.key}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.completed ? '#34d399' : '#4b5563'}
              strokeWidth={2}
              strokeDasharray={edge.completed ? 'none' : '4 4'}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          ))}

          {/* Nodes */}
          <AnimatePresence>
            {nodes.map(node => {
              // Root "main" — small label only
              if (node.name === 'main' && node.depth === 0 && node.children.length > 0) {
                return (
                  <g key={node.id}>
                    <text
                      x={node.cx}
                      y={node.cy + 4}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      main()
                    </text>
                  </g>
                );
              }

              const isActive = node.id === activeNodeId;
              const isCompleted = completedNodeIds.has(node.id);
              const argStr = node.args.map(a => String(a)).join(', ');
              const label = `${node.name}(${argStr})`;
              const hasReturnVal = isCompleted && node.returnValue !== null && node.returnValue !== undefined;

              // Colors
              let fill, stroke, textColor;
              if (isActive) {
                fill = 'rgba(59, 130, 246, 0.15)';
                stroke = '#3b82f6';
                textColor = '#93c5fd';
              } else if (isCompleted) {
                fill = 'rgba(16, 185, 129, 0.1)';
                stroke = '#10b981';
                textColor = '#6ee7b7';
              } else {
                fill = 'rgba(55, 65, 81, 0.3)';
                stroke = '#4b5563';
                textColor = '#9ca3af';
              }

              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                >
                  {/* Active glow */}
                  {isActive && (
                    <motion.rect
                      x={node.cx - node.w / 2 - 3}
                      y={node.cy - node.h / 2 - 3}
                      width={node.w + 6}
                      height={node.h + 6}
                      rx={10}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      opacity={0.4}
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  {/* Node box */}
                  <rect
                    x={node.cx - node.w / 2}
                    y={node.cy - node.h / 2}
                    width={node.w}
                    height={node.h}
                    rx={8}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isActive ? 2 : 1}
                  />

                  {/* Function label */}
                  <text
                    x={node.cx}
                    y={node.cy + (hasReturnVal ? -2 : 4)}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                  >
                    {label}
                  </text>

                  {/* Return value — only clean numeric values */}
                  {hasReturnVal && (
                    <text
                      x={node.cx}
                      y={node.cy + 14}
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize={9}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      ↩ {String(node.returnValue)}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
};

export default RecursionTreeCanvas;
