import React, { useMemo, useRef, useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

const cleanReturnValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.includes('__')) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
};

const resolveFormula = (formula, children, params) => {
  let expr = formula;
  for (const child of children) {
    if (!child.tempVarName) continue;
    if (child.returnValue === null || child.returnValue === undefined) return null;
    expr = expr.split(child.tempVarName).join(String(child.returnValue));
  }
  if (params) {
    for (const [name, val] of Object.entries(params)) {
      if (typeof val !== 'number') continue;
      expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    }
  }
  if (/[a-zA-Z_]/.test(expr)) return null;
  let e = expr.trim();
  if (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim();
  return e;
};

const buildNodeLabel = (name, params, args) => {
  const paramVals = Object.values(params);
  const arrParam  = paramVals.find(v => Array.isArray(v));
  const numParams = paramVals.filter(v => typeof v === 'number' && Number.isFinite(v));

  if (arrParam && numParams.length >= 2) {
    const validNums = numParams.filter(v => v >= 0 && v < arrParam.length);
    if (validNums.length >= 2) {
      const l = Math.min(...validNums);
      const r = Math.max(...validNums);
      const slice = arrParam.slice(l, r + 1);
      const sliceStr = slice.length <= 4
        ? `[${slice.join(',')}]`
        : `[${slice[0]},${slice[1]},..,${slice[slice.length - 1]}]`;
      return `${name}(${sliceStr})`;
    }
  }

  const argStr = args.map(a => {
    if (!Array.isArray(a)) return String(a);
    if (a.length <= 4) return `[${a.join(',')}]`;
    return `[${a[0]},${a[1]},..,${a[a.length - 1]}]`;
  }).join(', ');
  return `${name}(${argStr})`;
};

const buildComputation = (node) => {
  if (!node.returnFormula || !node.children?.length) return null;
  return resolveFormula(node.returnFormula, node.children, node.params);
};

const propagateReturnValues = (node) => {
  node.children.forEach(propagateReturnValues);
  if (node.returnValue !== null) return;
  if (node.returnStepIndex < 0 || !node.returnFormula) return;
  const expr = resolveFormula(node.returnFormula, node.children, node.params);
  if (expr === null) return;
  try {
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === 'number' && isFinite(result)) node.returnValue = result;
  } catch { /* ignore */ }
};

// ─── Layout constants ────────────────────────────────────────────────────────
const NODE_W = 150;
const NODE_H = 68;
const H_GAP  = 24;
const V_GAP  = 84;

// ─── HelperFrame ─────────────────────────────────────────────────────────────
const HelperFrame = ({ frame, isTop }) => {
  const scalarParams = Object.entries(frame.params).filter(([, v]) => !Array.isArray(v));
  const arrayEntries = Object.entries(frame.arrays);

  return (
    <div className={`rounded border p-2 transition-colors ${
      isTop
        ? 'border-amber-500/40 bg-amber-950/20 shadow-sm shadow-amber-900/20'
        : 'border-[#1e2d40]/50 bg-[#0c1825]/50'
    }`}>
      {/* Frame name */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
          isTop
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-[#1a2535] text-gray-600 border border-[#1e2d40]'
        }`}>
          {frame.name}()
        </span>
        {isTop && (
          <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse ml-auto" />
        )}
      </div>

      {/* Scalar params */}
      {scalarParams.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {scalarParams.map(([name, val]) => (
            <span
              key={name}
              className="inline-flex items-center gap-0.5 text-[8px] font-mono bg-[#0a1520] border border-[#1a2535] rounded px-1.5 py-0.5"
            >
              <span className={isTop ? 'text-gray-400' : 'text-gray-700'}>{name}</span>
              <span className="text-gray-700">=</span>
              <span className={isTop ? 'text-amber-400' : 'text-gray-600'}>{String(val)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Arrays */}
      {arrayEntries.map(([name, arr]) => (
        <div key={name} className="mt-1">
          <span className="text-[7px] font-mono text-gray-700 mb-0.5 block">{name}[{arr.length}]</span>
          <div className="flex gap-px">
            {arr.map((v, idx) => (
              <div key={idx} className="flex flex-col items-center" style={{ flex: '1 1 0', minWidth: 0 }}>
                <div className={`w-full h-5 flex items-center justify-center text-[7px] font-mono font-bold rounded-sm truncate ${
                  isTop
                    ? 'bg-amber-950/50 border border-amber-900/40 text-amber-300'
                    : 'bg-[#0a1520] border border-[#1a2535] text-gray-700'
                }`}>
                  {v}
                </div>
                <span className="text-[6px] text-gray-800 mt-0.5 leading-none">{idx}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── HelperPanel ─────────────────────────────────────────────────────────────
const HelperPanel = ({ frames }) => {
  const isEmpty = frames.length === 0;

  return (
    <div
      className="w-52 flex flex-col border-l border-[#101c2d] shrink-0"
      style={{ background: '#060f1c' }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#101c2d] flex items-center gap-2 shrink-0">
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="1" width="4.5" height="4.5" rx="1"
            fill={isEmpty ? '#1a2535' : '#f59e0b'} opacity={isEmpty ? 0.3 : 0.85} />
          <rect x="6.5" y="1" width="4.5" height="4.5" rx="1"
            fill={isEmpty ? '#1a2535' : '#f59e0b'} opacity={isEmpty ? 0.15 : 0.4} />
          <rect x="1" y="6.5" width="4.5" height="4.5" rx="1"
            fill={isEmpty ? '#1a2535' : '#f59e0b'} opacity={isEmpty ? 0.08 : 0.18} />
        </svg>
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider"
          style={{ color: isEmpty ? '#1e2d40' : '#f59e0b' }}
        >
          Helper Ops
        </span>
        {!isEmpty && (
          <span
            className="ml-auto text-[8px] font-mono px-1 py-0.5 rounded"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
          >
            {frames.length}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-4">
          <div
            className="w-9 h-9 rounded-full border flex items-center justify-center"
            style={{ borderColor: '#101c2d' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="#1a2535" strokeWidth="1.2" />
              <path d="M6 8h4M8 6v4" stroke="#1a2535" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[9px] font-mono text-center leading-relaxed" style={{ color: '#1a2535' }}>
            No active<br />helper calls
          </p>
          <p className="text-[8px] font-mono text-center leading-relaxed" style={{ color: '#111c2a' }}>
            merge, partition, etc.<br />appear here
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* Innermost (most recent) frame first */}
          {[...frames].reverse().map((frame, i) => (
            <HelperFrame key={`${frame.name}-${i}`} frame={frame} isTop={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
};

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

  // ── Build incremental tree ─────────────────────────────────────────────────
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

    let rootFunctionName = null;
    let skippedDepth = 0;

    for (let i = 0; i < limit; i++) {
      const { type, data } = steps[i];

      if (type === 'CALL') {
        if (skippedDepth > 0) { skippedDepth++; continue; }

        const parent = stack[stack.length - 1];
        const isFirstCall     = parent.name === 'main' && rootFunctionName === null;
        const isSelfRecursive = rootFunctionName !== null && data.name === rootFunctionName;

        if (isFirstCall || isSelfRecursive) {
          if (isFirstCall) rootFunctionName = data.name;
          const node = {
            id: idCounter++,
            name: data.name,
            args: (data.args || []).map(a => a.value ?? a.text),
            children: [],
            returnValue: null,
            stepIndex: i,
            returnStepIndex: -1,
            depth: stack.length,
            tempVarName: data.targetVar || null,
            params: {},
            returnFormula: null,
          };
          parent.children.push(node);
          stack.push(node);
        } else {
          skippedDepth = 1;
        }

      } else if (type === 'PARAM_INIT') {
        if (skippedDepth > 0) continue;
        const cur = stack[stack.length - 1];
        if (cur && cur !== root && data?.name !== undefined) {
          if (Array.isArray(data.value)) {
            cur.params[data.name] = data.value;
          } else {
            const n = Number(data.value);
            if (!isNaN(n)) cur.params[data.name] = n;
          }
        }

      } else if (type === 'UPDATE_ARRAY_ELEMENT') {
        if (skippedDepth > 0) {
          const cur = stack[stack.length - 1];
          if (cur && cur !== root) {
            const arr = cur.params[data.arrayName];
            if (Array.isArray(arr)) {
              const idx = typeof data.index === 'number' ? data.index : parseInt(data.index);
              if (idx >= 0 && idx < arr.length) {
                const updated = [...arr];
                updated[idx] = data.value;
                cur.params[data.arrayName] = updated;
              }
            }
          }
        }

      } else if (type === 'RETURN') {
        if (skippedDepth > 0) continue;
        const cur = stack[stack.length - 1];
        if (cur && cur !== root) {
          const cleaned = cleanReturnValue(data?.value) ?? cleanReturnValue(data?.expression);
          if (cleaned !== null) cur.returnValue = cleaned;
          if (data?.expression?.includes('__ret_temp')) cur.returnFormula = data.expression;
        }

      } else if (type === 'RETURN_FROM_CALL') {
        if (skippedDepth > 0) { skippedDepth--; continue; }
        const cur = stack[stack.length - 1];
        if (cur && cur !== root) {
          cur.returnStepIndex = i;
          stack.pop();
        }
      }
    }

    propagateReturnValues(root);
    return root;
  }, [steps, currentStep]);

  // ── Active node tracking ───────────────────────────────────────────────────
  const activeNodeId = useMemo(() => {
    if (!tree || currentStep === 0) return tree?.id ?? -1;

    let rootFuncName = null;
    let skippedDepth = 0;
    let idCounter    = 0;
    const nodeStack  = [idCounter++];
    let activeId     = 0;

    for (let i = 0; i < Math.min(currentStep, steps.length); i++) {
      const { type, data } = steps[i];

      if (type === 'CALL') {
        if (skippedDepth > 0) { skippedDepth++; continue; }
        const parentId        = nodeStack[nodeStack.length - 1];
        const isFirstCall     = parentId === 0 && rootFuncName === null;
        const isSelfRecursive = rootFuncName !== null && data?.name === rootFuncName;
        if (isFirstCall || isSelfRecursive) {
          if (isFirstCall) rootFuncName = data.name;
          const id = idCounter++;
          nodeStack.push(id);
          activeId = id;
        } else {
          skippedDepth = 1;
        }
      } else if (type === 'RETURN_FROM_CALL') {
        if (skippedDepth > 0) { skippedDepth--; continue; }
        nodeStack.pop();
        activeId = nodeStack[nodeStack.length - 1] ?? 0;
      }
    }

    return activeId;
  }, [tree, currentStep, steps]);

  // ── Completed nodes ────────────────────────────────────────────────────────
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

  // ── Helper call stack ──────────────────────────────────────────────────────
  // Mirrors the tree-builder's skip logic but collects helper frames instead.
  const helperStack = useMemo(() => {
    if (!steps?.length || currentStep === 0) return [];
    const limit = Math.min(currentStep, steps.length);

    let rootFunctionName = null;
    let skippedDepth = 0;
    const stack = []; // active helper frames

    for (let i = 0; i < limit; i++) {
      const { type, data } = steps[i];

      if (type === 'CALL') {
        if (skippedDepth > 0) {
          skippedDepth++;
          stack.push({ name: data?.name || '?', params: {}, arrays: {} });
          continue;
        }
        const isFirstCall     = rootFunctionName === null;
        const isSelfRecursive = rootFunctionName !== null && data?.name === rootFunctionName;
        if (isFirstCall || isSelfRecursive) {
          if (isFirstCall) rootFunctionName = data?.name || '?';
          // recursive call — not a helper, don't push
        } else {
          skippedDepth = 1;
          stack.push({ name: data?.name || '?', params: {}, arrays: {} });
        }

      } else if (type === 'PARAM_INIT') {
        if (skippedDepth > 0 && stack.length > 0) {
          const frame = stack[stack.length - 1];
          if (data?.name !== undefined) {
            if (Array.isArray(data.value)) {
              frame.params[data.name] = [...data.value];
              frame.arrays[data.name] = [...data.value];
            } else {
              frame.params[data.name] = data.value;
            }
          }
        }

      } else if (type === 'SET_VARIABLE') {
        if (skippedDepth > 0 && stack.length > 0 && data?.name) {
          stack[stack.length - 1].params[data.name] = data.value;
        }

      } else if (type === 'UPDATE_ARRAY_ELEMENT') {
        if (skippedDepth > 0 && stack.length > 0) {
          // Propagate update through all frames that have this array
          for (let j = stack.length - 1; j >= 0; j--) {
            const arr = stack[j].arrays[data?.arrayName];
            if (arr) {
              const updated = [...arr];
              const idx = typeof data.index === 'number' ? data.index : parseInt(data.index);
              if (idx >= 0 && idx < updated.length) {
                updated[idx] = data.value;
                for (let k = j; k < stack.length; k++) {
                  if (k === j || stack[k].arrays[data.arrayName]) {
                    stack[k].arrays[data.arrayName] = updated;
                  }
                }
              }
              break;
            }
          }
        }

      } else if (type === 'RETURN_FROM_CALL') {
        if (skippedDepth > 0) {
          skippedDepth--;
          if (stack.length > 0) stack.pop();
        }
      }
    }

    return stack;
  }, [steps, currentStep]);

  // ── Layout ─────────────────────────────────────────────────────────────────
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
          x1: cx, y1, x2: childCx, y2,
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
    const maxY = Math.max(...positioned.map(n => n.cy + NODE_H / 2 + 28), 0);
    return { nodes: positioned, edges: edgeList, treeWidth: maxX + 24, treeHeight: maxY + 24 };
  }, [tree, completedNodeIds]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!tree || nodes.length <= 1) {
    return (
      <div className="flex-1 flex overflow-hidden">
        <div ref={containerRef} className="flex-1 flex items-center justify-center" style={{ background: '#060c17' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.06) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
          <div className="text-center select-none relative z-10">
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
        <HelperPanel frames={helperStack} />
      </div>
    );
  }

  const scale   = Math.min(1, (dimensions.width - 48) / treeWidth, (dimensions.height - 48) / treeHeight);
  const offsetX = Math.max(24, (dimensions.width  - treeWidth  * scale) / 2);
  const offsetY = 24;

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Recursion tree ──────────────────────────────────────────────── */}
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
            <marker id="rc-arrow-green" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M1,1 L1,6 L7,3.5 z" fill="#10b981" />
            </marker>
            <marker id="rc-arrow-gray" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M1,1 L1,6 L7,3.5 z" fill="#1e293b" />
            </marker>
            <marker id="rc-arrow-cyan" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M1,1 L1,6 L7,3.5 z" fill="#22d3ee" />
            </marker>
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

            {/* Edges */}
            {edges.map(edge => {
              const { x1, y1, x2, y2 } = edge;
              const dy    = y2 - y1;
              const pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.48}, ${x2} ${y2 - dy * 0.48}, ${x2} ${y2}`;
              const valStr = edge.childReturnValue !== null && edge.childReturnValue !== undefined
                ? String(edge.childReturnValue) : null;
              const pillW = valStr ? Math.max(28, valStr.length * 8 + 12) : 28;

              return (
                <g key={edge.key}>
                  <motion.path
                    d={pathD}
                    fill="none"
                    stroke={edge.completed ? '#10b981' : '#1e293b'}
                    strokeWidth={edge.completed ? 1.5 : 1.2}
                    strokeDasharray={edge.completed ? undefined : '5 4'}
                    markerEnd={edge.completed ? 'url(#rc-arrow-green)' : 'url(#rc-arrow-gray)'}
                    initial={edge.completed ? { pathLength: 0, opacity: 0 } : { opacity: 0 }}
                    animate={edge.completed ? { pathLength: 1, opacity: 1 } : { opacity: 1 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                  {edge.completed && valStr !== null && (
                    <motion.g
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                      <rect
                        x={edge.midX - pillW / 2} y={edge.midY - 9.5}
                        width={pillW} height={19} rx={9.5}
                        fill="rgba(16,185,129,0.13)" stroke="#10b981" strokeWidth={0.9}
                      />
                      <text
                        x={edge.midX} y={edge.midY + 4.5}
                        textAnchor="middle" fill="#34d399"
                        fontSize={8.5} fontFamily="JetBrains Mono, monospace" fontWeight="700"
                      >
                        {valStr}
                      </text>
                    </motion.g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            <AnimatePresence>
              {nodes.map(node => {

                if (node.name === 'main' && node.depth === 0) {
                  return (
                    <motion.g key={node.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                      <text x={node.cx} y={node.cy + 4} textAnchor="middle"
                        fill="#374151" fontSize={10} fontFamily="JetBrains Mono, monospace">
                        main()
                      </text>
                    </motion.g>
                  );
                }

                const isActive    = node.id === activeNodeId;
                const isCompleted = completedNodeIds.has(node.id);
                const isPending   = !isActive && !isCompleted;

                const label      = buildNodeLabel(node.name, node.params, node.args);
                const hasReturn  = isCompleted && node.returnValue !== null;
                const computation = isCompleted ? buildComputation(node) : null;
                const hasCompute  = computation !== null && hasReturn;

                const labelY  = hasReturn ? node.cy - 10 : node.cy + 4;
                const returnY = node.cy + 12;

                const C = isActive ? {
                  fill:   'rgba(6,182,212,0.11)', stroke: '#22d3ee',
                  text:   '#a5f3fc', retText: '#67e8f9',
                  filter: 'url(#rc-glow-cyan)', accent: '#22d3ee',
                } : isCompleted ? {
                  fill:   'rgba(16,185,129,0.09)', stroke: '#10b981',
                  text:   '#6ee7b7', retText: '#34d399',
                  filter: 'url(#rc-glow-green)', accent: '#10b981',
                } : {
                  fill:   'rgba(15,23,42,0.55)', stroke: '#1e293b',
                  text:   '#334155', retText: '#334155',
                  filter: undefined, accent: '#1e293b',
                };

                return (
                  <motion.g
                    key={node.id}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    {isActive && (
                      <motion.rect
                        x={node.cx - NODE_W / 2 - 5} y={node.cy - NODE_H / 2 - 5}
                        width={NODE_W + 10} height={NODE_H + 10} rx={14}
                        fill="none" stroke="#22d3ee" strokeWidth={1}
                        animate={{ opacity: [0.12, 0.45, 0.12] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    <rect
                      x={node.cx - NODE_W / 2} y={node.cy - NODE_H / 2}
                      width={NODE_W} height={NODE_H} rx={9}
                      fill={C.fill} stroke={C.stroke}
                      strokeWidth={isActive ? 1.5 : isPending ? 0.8 : 1}
                      filter={C.filter}
                    />
                    {!isPending && (
                      <line
                        x1={node.cx - NODE_W / 2 + 12} y1={node.cy - NODE_H / 2 + 1.5}
                        x2={node.cx + NODE_W / 2 - 12} y2={node.cy - NODE_H / 2 + 1.5}
                        stroke={C.accent} strokeWidth={1.5} strokeLinecap="round" opacity={0.55}
                      />
                    )}
                    <text
                      x={node.cx} y={labelY} textAnchor="middle"
                      fill={C.text} fontSize={10}
                      fontFamily="JetBrains Mono, monospace" fontWeight="600" letterSpacing="0.25"
                    >
                      {label}
                    </text>
                    {hasReturn && (
                      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                        <text
                          x={node.cx} y={returnY} textAnchor="middle"
                          fill={C.retText} fontSize={9.5}
                          fontFamily="JetBrains Mono, monospace" fontWeight="700"
                        >
                          {`↩ ${node.returnValue}`}
                        </text>
                      </motion.g>
                    )}
                    {hasCompute && (
                      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.22 }}>
                        <ellipse
                          cx={node.cx} cy={node.cy + NODE_H / 2 + 14}
                          rx={Math.min(60, computation.length * 4 + 20)} ry={8}
                          fill="rgba(251,191,36,0.06)" filter="url(#rc-glow-amber)"
                        />
                        <text
                          x={node.cx} y={node.cy + NODE_H / 2 + 17}
                          textAnchor="middle" fill="#f59e0b" fontSize={8.5}
                          fontFamily="JetBrains Mono, monospace" fontWeight="500" letterSpacing="0.4"
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

      {/* ── Helper ops panel ────────────────────────────────────────────── */}
      <HelperPanel frames={helperStack} />

    </div>
  );
};

export default RecursionTreeCanvas;
