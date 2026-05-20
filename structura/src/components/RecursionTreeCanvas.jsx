import React, { useMemo, useRef, useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

/**
 * RecursionTreeCanvas — Renders a tree visualization of recursive function calls.
 *
 * Builds the tree INCREMENTALLY — only showing nodes that have been reached
 * up to the current step. As you step forward, new nodes appear with animation.
 *
 * Features:
 *  - Return value bubbles on edges (shows value flowing back up)
 *  - Computation annotations (shows HOW the result was calculated, e.g. "1 + 1 = 2")
 *  - Works dynamically for any recursive operation (fibonacci, factorial, etc.)
 *  - Curved bezier edges with arrowheads
 *
 * Props:
 *   steps       – all execution steps
 *   currentStep – current step index (1-based, 0 = not started)
 */

const cleanReturnValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.includes('__')) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
};

/**
 * Attempts to substitute temp-var placeholders and param names in a formula.
 * Returns the resolved arithmetic string (e.g. "1 + 1" or "5 * 24"),
 * or null if any identifier cannot be resolved yet.
 */
const resolveFormula = (formula, children, params) => {
  let expr = formula;
  for (const child of children) {
    if (!child.tempVarName) continue;
    if (child.returnValue === null || child.returnValue === undefined) return null;
    expr = expr.split(child.tempVarName).join(String(child.returnValue));
  }
  if (params) {
    for (const [name, val] of Object.entries(params)) {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    }
  }
  if (/[a-zA-Z_]/.test(expr)) return null;
  let e = expr.trim();
  if (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim();
  return e;
};

/** Convenience wrapper used at render time. */
const buildComputation = (node) => {
  if (!node.returnFormula || !node.children?.length) return null;
  return resolveFormula(node.returnFormula, node.children, node.params);
};

/**
 * Bottom-up pass: fills in returnValue for completed intermediate nodes
 * whose return value couldn't be read directly from step data (because the
 * RETURN step stores a temp-var expression at generation time, not a number).
 * Safe to call because it only writes to nodes whose returnStepIndex is set.
 */
const propagateReturnValues = (node) => {
  node.children.forEach(propagateReturnValues);
  if (node.returnValue !== null) return;
  if (node.returnStepIndex < 0 || !node.returnFormula) return;
  const expr = resolveFormula(node.returnFormula, node.children, node.params);
  if (expr === null) return;
  try {
    // Guard: only evaluate pure arithmetic (no identifiers remain after resolveFormula)
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === 'number' && isFinite(result)) node.returnValue = result;
  } catch { /* ignore eval errors */ }
};

// ─── Layout constants ────────────────────────────────────────────────────────
const NODE_W = 150;
const NODE_H = 68;
const H_GAP  = 24;
const V_GAP  = 84;

// ─── Component ───────────────────────────────────────────────────────────────
const RecursionTreeCanvas = ({ steps = [], currentStep = 0 }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Build incremental tree from steps ──────────────────────────────────────
  const tree = useMemo(() => {
    if (!steps?.length || currentStep === 0) return null;
    const limit = Math.min(currentStep, steps.length);
    let idCounter = 0;

    const root = {
      id: idCounter++, name: 'main', args: [], children: [],
      returnValue: null, stepIndex: -1, returnStepIndex: -1, depth: 0,
      tempVarName: null, params: {}, returnFormula: null,
    };
    const stack = [root];

    for (let i = 0; i < limit; i++) {
      const { type, data } = steps[i];

      if (type === 'CALL') {
        const parent = stack[stack.length - 1];
        const node = {
          id: idCounter++,
          name: data.name,
          args: (data.args || []).map(a => a.value ?? a.text),
          children: [],
          returnValue: null,
          stepIndex: i,
          returnStepIndex: -1,
          depth: stack.length,
          // If this call was spawned from a return expression, targetVar = '__ret_temp_X_Y'
          tempVarName: data.targetVar || null,
          params: {},
          returnFormula: null,
        };
        parent.children.push(node);
        stack.push(node);

      } else if (type === 'PARAM_INIT') {
        const cur = stack[stack.length - 1];
        if (cur && cur !== root && data?.name !== undefined) {
          const n = Number(data.value);
          if (!isNaN(n)) cur.params[data.name] = n;
        }

      } else if (type === 'RETURN') {
        const cur = stack[stack.length - 1];
        if (cur && cur !== root) {
          const cleaned = cleanReturnValue(data?.value) ?? cleanReturnValue(data?.expression);
          if (cleaned !== null) cur.returnValue = cleaned;
          // Store the templated formula (e.g. "__ret_temp_1_0 + __ret_temp_1_1")
          if (data?.expression?.includes('__ret_temp')) cur.returnFormula = data.expression;
        }

      } else if (type === 'RETURN_FROM_CALL') {
        const cur = stack[stack.length - 1];
        if (cur && cur !== root) {
          cur.returnStepIndex = i;
          stack.pop();
        }
      }
    }

    // Propagate return values bottom-up so intermediate nodes
    // (whose RETURN step carries a temp-var expression, not a number)
    // get their resolved numeric returnValue filled in.
    propagateReturnValues(root);

    return root;
  }, [steps, currentStep]);

  // ── Which node is currently executing ─────────────────────────────────────
  const activeNodeId = useMemo(() => {
    if (!tree || currentStep === 0) return tree?.id ?? -1;
    let idCounter = 0;
    const nodeStack = [idCounter++];
    let activeId = 0;
    for (let i = 0; i < Math.min(currentStep, steps.length); i++) {
      const { type } = steps[i];
      if (type === 'CALL') { const id = idCounter++; nodeStack.push(id); activeId = id; }
      else if (type === 'RETURN_FROM_CALL') { nodeStack.pop(); activeId = nodeStack[nodeStack.length - 1] ?? 0; }
    }
    return activeId;
  }, [tree, currentStep, steps]);

  // ── Which nodes have fully returned ───────────────────────────────────────
  const completedNodeIds = useMemo(() => {
    if (!tree) return new Set();
    const s = new Set();
    const walk = (n) => {
      if (n.returnStepIndex >= 0 && n.returnStepIndex < currentStep) s.add(n.id);
      n.children.forEach(walk);
    };
    walk(tree);
    return s;
  }, [tree, currentStep]);

  // ── Layout: compute node positions and edges ───────────────────────────────
  const { nodes, edges, treeWidth, treeHeight } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [], treeWidth: 0, treeHeight: 0 };

    const positioned = [];
    const edgeList   = [];

    const widthOf = (n) => {
      if (!n.children.length) return NODE_W;
      return Math.max(
        NODE_W,
        n.children.reduce((sum, c, i) => sum + widthOf(c) + (i ? H_GAP : 0), 0),
      );
    };

    const layout = (node, x, y) => {
      const sw = widthOf(node);
      const cx = x + sw / 2;
      const cy = y + NODE_H / 2;
      positioned.push({ ...node, cx, cy });

      let cx2 = x;
      node.children.forEach(child => {
        const cw = widthOf(child);
        layout(child, cx2, y + NODE_H + V_GAP);
        const childCx = cx2 + cw / 2;
        const childCy = y + NODE_H + V_GAP + NODE_H / 2;
        const y1 = cy + NODE_H / 2;
        const y2 = childCy - NODE_H / 2;
        edgeList.push({
          key: `${node.id}-${child.id}`,
          x1: cx, y1,
          x2: childCx, y2,
          midX: (cx + childCx) / 2,
          midY: (y1 + y2) / 2,
          childId: child.id,
          childReturnValue: child.returnValue,
          completed: completedNodeIds.has(child.id),
        });
        cx2 += cw + H_GAP;
      });
    };

    layout(tree, 0, 0);
    const maxX = Math.max(...positioned.map(n => n.cx + NODE_W / 2), 0);
    // Extra 28px below each node for the computation label
    const maxY = Math.max(...positioned.map(n => n.cy + NODE_H / 2 + 28), 0);
    return { nodes: positioned, edges: edgeList, treeWidth: maxX + 24, treeHeight: maxY + 24 };
  }, [tree, completedNodeIds]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!tree || nodes.length <= 1) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center" style={{ background: '#060c17' }}>
        <div className="text-center select-none">
          <svg width="52" height="44" viewBox="0 0 52 44" className="mx-auto mb-3 opacity-30">
            <circle cx="26" cy="8"  r="6" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
            <circle cx="10" cy="36" r="6" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <circle cx="42" cy="36" r="6" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <path d="M22 13 Q16 24 14 30" fill="none" stroke="#334155" strokeWidth="1.2" strokeDasharray="3 3" />
            <path d="M30 13 Q36 24 38 30" fill="none" stroke="#334155" strokeWidth="1.2" strokeDasharray="3 3" />
          </svg>
          <p className="text-gray-600 text-xs font-mono">No recursion detected yet</p>
          <p className="text-gray-700 text-[10px] mt-1 font-mono">Step through a recursive function to build the call tree</p>
        </div>
      </div>
    );
  }

  const scale   = Math.min(1, (dimensions.width - 48) / treeWidth, (dimensions.height - 48) / treeHeight);
  const offsetX = Math.max(24, (dimensions.width  - treeWidth  * scale) / 2);
  const offsetY = 24;

  return (
    <div ref={containerRef} className="flex-1 overflow-auto relative" style={{ background: '#060c17' }}>

      {/* Dot-grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.08) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }} />

      {/* Radial vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 75% 75% at 50% 40%, transparent 35%, rgba(6,12,23,0.75) 100%)',
      }} />

      <svg
        width={Math.max(dimensions.width,  treeWidth  * scale + 48)}
        height={Math.max(dimensions.height, treeHeight * scale + 48)}
        className="relative z-10"
      >
        <defs>
          {/* Arrow markers */}
          <marker id="rc-arrow-green" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M1,1 L1,6 L7,3.5 z" fill="#10b981" />
          </marker>
          <marker id="rc-arrow-gray" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M1,1 L1,6 L7,3.5 z" fill="#1e293b" />
          </marker>
          <marker id="rc-arrow-cyan" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <path d="M1,1 L1,6 L7,3.5 z" fill="#22d3ee" />
          </marker>

          {/* Glow filters */}
          <filter id="rc-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rc-glow-green" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rc-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>

          {/* ── Edges ────────────────────────────────────────────────────── */}
          {edges.map(edge => {
            const { x1, y1, x2, y2 } = edge;
            const dy    = y2 - y1;
            const pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.48}, ${x2} ${y2 - dy * 0.48}, ${x2} ${y2}`;
            const valStr    = edge.childReturnValue !== null && edge.childReturnValue !== undefined
              ? String(edge.childReturnValue) : null;
            const pillW = valStr ? Math.max(28, valStr.length * 8 + 12) : 28;

            return (
              <g key={edge.key}>
                {/* Edge path */}
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke={edge.completed ? '#10b981' : '#1e293b'}
                  strokeWidth={edge.completed ? 1.5 : 1.2}
                  strokeDasharray={edge.completed ? undefined : '5 4'}
                  markerEnd={edge.completed ? 'url(#rc-arrow-green)' : 'url(#rc-arrow-gray)'}
                  // pathLength animates completed edges; pending use opacity only (avoids dasharray conflict)
                  initial={edge.completed ? { pathLength: 0, opacity: 0 } : { opacity: 0 }}
                  animate={edge.completed ? { pathLength: 1, opacity: 1 } : { opacity: 1 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                />

                {/* Return value pill — appears when child has completed */}
                {edge.completed && valStr !== null && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <rect
                      x={edge.midX - pillW / 2}
                      y={edge.midY - 9.5}
                      width={pillW}
                      height={19}
                      rx={9.5}
                      fill="rgba(16,185,129,0.13)"
                      stroke="#10b981"
                      strokeWidth={0.9}
                    />
                    <text
                      x={edge.midX}
                      y={edge.midY + 4.5}
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize={8.5}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                    >
                      {valStr}
                    </text>
                  </motion.g>
                )}
              </g>
            );
          })}

          {/* ── Nodes ────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {nodes.map(node => {

              // Root "main()" — just a label
              if (node.name === 'main' && node.depth === 0) {
                return (
                  <motion.g key={node.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    <text
                      x={node.cx} y={node.cy + 4}
                      textAnchor="middle"
                      fill="#374151"
                      fontSize={10}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      main()
                    </text>
                  </motion.g>
                );
              }

              const isActive    = node.id === activeNodeId;
              const isCompleted = completedNodeIds.has(node.id);
              const isPending   = !isActive && !isCompleted;

              const argStr      = node.args.map(String).join(', ');
              const label       = `${node.name}(${argStr})`;
              const hasReturn   = isCompleted && node.returnValue !== null;
              const computation = isCompleted ? buildComputation(node) : null;
              const hasCompute  = computation !== null && hasReturn;

              // Vertical text positions inside the node box
              const labelY  = hasReturn ? node.cy - 10 : node.cy + 4;
              const returnY = node.cy + 12;

              // Color scheme
              const C = isActive ? {
                fill:    'rgba(6,182,212,0.11)',
                stroke:  '#22d3ee',
                text:    '#a5f3fc',
                retText: '#67e8f9',
                marker:  'url(#rc-arrow-cyan)',
                filter:  'url(#rc-glow-cyan)',
                accent:  '#22d3ee',
              } : isCompleted ? {
                fill:    'rgba(16,185,129,0.09)',
                stroke:  '#10b981',
                text:    '#6ee7b7',
                retText: '#34d399',
                marker:  'url(#rc-arrow-green)',
                filter:  'url(#rc-glow-green)',
                accent:  '#10b981',
              } : {
                fill:    'rgba(15,23,42,0.55)',
                stroke:  '#1e293b',
                text:    '#334155',
                retText: '#334155',
                marker:  'url(#rc-arrow-gray)',
                filter:  undefined,
                accent:  '#1e293b',
              };

              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                >

                  {/* Active pulse ring */}
                  {isActive && (
                    <motion.rect
                      x={node.cx - NODE_W / 2 - 5}
                      y={node.cy - NODE_H / 2 - 5}
                      width={NODE_W + 10}
                      height={NODE_H + 10}
                      rx={14}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={1}
                      animate={{ opacity: [0.12, 0.45, 0.12] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {/* Node box */}
                  <rect
                    x={node.cx - NODE_W / 2}
                    y={node.cy - NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={9}
                    fill={C.fill}
                    stroke={C.stroke}
                    strokeWidth={isActive ? 1.5 : isPending ? 0.8 : 1}
                    filter={C.filter}
                  />

                  {/* Top accent line (active / completed only) */}
                  {!isPending && (
                    <line
                      x1={node.cx - NODE_W / 2 + 12}
                      y1={node.cy - NODE_H / 2 + 1.5}
                      x2={node.cx + NODE_W / 2 - 12}
                      y2={node.cy - NODE_H / 2 + 1.5}
                      stroke={C.accent}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      opacity={0.55}
                    />
                  )}

                  {/* Function label */}
                  <text
                    x={node.cx}
                    y={labelY}
                    textAnchor="middle"
                    fill={C.text}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                    letterSpacing="0.25"
                  >
                    {label}
                  </text>

                  {/* Return value */}
                  {hasReturn && (
                    <motion.g
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.35 }}
                    >
                      <text
                        x={node.cx}
                        y={returnY}
                        textAnchor="middle"
                        fill={C.retText}
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="700"
                      >
                        {`↩ ${node.returnValue}`}
                      </text>
                    </motion.g>
                  )}

                  {/* Computation formula — displayed below the node box */}
                  {hasCompute && (
                    <motion.g
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.22 }}
                    >
                      {/* Amber glow blob behind formula */}
                      <ellipse
                        cx={node.cx}
                        cy={node.cy + NODE_H / 2 + 14}
                        rx={Math.min(60, computation.length * 4 + 20)}
                        ry={8}
                        fill="rgba(251,191,36,0.06)"
                        filter="url(#rc-glow-amber)"
                      />
                      <text
                        x={node.cx}
                        y={node.cy + NODE_H / 2 + 17}
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize={8.5}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="500"
                        letterSpacing="0.4"
                      >
                        {`${computation} = ${node.returnValue}`}
                      </text>
                    </motion.g>
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
