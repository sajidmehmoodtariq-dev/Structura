import React, { useMemo, useState } from 'react';
import PointerArrow from './PointerArrow';
import HeapBlock from './HeapBlock';
import ArrayCanvas from './ArrayCanvas';
import RecursionTreeCanvas from './RecursionTreeCanvas';
import DataStructureView from './DataStructureView';

const INDEX_VAR_NAMES = new Set([
  'i', 'j', 'k', 'l', 'p', 'q',
  'low', 'high', 'mid', 'left', 'right',
  'start', 'end', 'pivot', 'min_idx', 'max_idx',
  'minIdx', 'maxIdx', 'lo', 'hi',
]);

const VIZ_MODES = [
  { key: 'stack-heap', label: 'Stack & Heap', icon: '⬛' },
  { key: 'ds-view',    label: 'DS View',      icon: '⟨⟩' },
  { key: 'recursion-tree', label: 'Recursion Tree', icon: '🌳' },
];

// ── Step explanation (Feature: "Why" context panel) ───────────────────────────

function explainStep(step) {
  if (!step) return null;
  const { type, data } = step;
  switch (type) {
    case 'SET_VARIABLE':
      if (data.value?.__stl === 'vector')
        return `A ${data.type} named "${data.name}" is created on the stack. It starts ${data.value.size === 0 ? 'empty' : `with ${data.value.size} element(s)`}. Its backing array lives on the heap at ${data.value.heapAddr}.`;
      if (Array.isArray(data.value))
        return `Array "${data.name}" is allocated on the stack with ${data.value.length} slot(s). The entire array lives inside this stack frame.`;
      if (data.type?.includes('*'))
        return `Pointer "${data.name}" is set to ${data.value}. It holds a memory address — follow the arrow to see what it points to.`;
      return `Variable "${data.name}" (${data.type}) is assigned ${JSON.stringify(data.value)} at stack address ${data.address}.`;

    case 'UPDATE_ARRAY_ELEMENT':
      return `${data.arrayName}[${data.index}] = ${data.value}. Element at index ${data.index} is overwritten. The array stays at the same memory address — only the slot's contents change.`;

    case 'PUSH_FRAME':
      return `A new stack frame is pushed for ${data.name}(). Every local variable declared inside will live here until the function returns.`;

    case 'POP_FRAME':
      return `${data.name}() has finished. Its stack frame is destroyed and all its local variables disappear from memory instantly.`;

    case 'CALL':
      return `${data.name}() is called. Execution jumps to the function definition and arguments are copied into the new frame's parameters.`;

    case 'PARAM_INIT':
      return `Parameter "${data.name}" receives ${JSON.stringify(data.value)} copied from the caller's argument. This is an independent copy — changes here won't affect the caller's variable.`;

    case 'RETURN':
      if (data.expression)
        return `The function evaluates "${data.expression}" as its return value, then begins unwinding its stack frame.`;
      return `The function is returning. Its stack frame will be popped next.`;

    case 'RETURN_FROM_CALL':
      return data.targetVar
        ? `Control returns to the caller. The return value is stored in "${data.targetVar}".`
        : `Control returns to the caller. Execution resumes at the line after the function call.`;

    case 'IF_STATEMENT':
      return `The condition "${data.condition}" is evaluated. One branch will run — the other is skipped entirely.`;

    case 'SWITCH_STATEMENT':
      return `The value of "${data.variable}" is matched against each case label. Only the matching case body executes.`;

    case 'ALLOCATE_HEAP':
      return `\`new\` reserves space on the heap at ${data.address}. Unlike stack variables, heap memory persists until you explicitly call \`delete\` — it won't disappear when functions return.`;

    case 'FREE_HEAP':
      return `\`delete ${data.ptrName}\` releases the heap block. That memory is now available for reuse. Accessing it afterward is undefined behavior.`;

    case 'LOG_OUTPUT':
      return `A \`cout\` statement executes, appending text to the console. The values are read from variables at this exact moment in time.`;

    case 'STL_OP':
      if (data.op === 'push_back')
        return `${data.name}.push_back(${data.value}) appends ${data.value} to the end of the vector. If size would exceed capacity, the vector allocates a new, larger heap buffer (typically 2× the old capacity) and copies all elements over.`;
      if (data.op === 'pop_back')
        return `${data.name}.pop_back() removes the last element, shrinking size by 1. The capacity does not change — no reallocation occurs.`;
      if (data.op === 'clear')
        return `${data.name}.clear() drops all elements, setting size to 0. Capacity is unchanged — the heap buffer is still reserved.`;
      return `STL operation on "${data.name}".`;

    default:
      return null;
  }
}

const WhyPanel = ({ steps, currentStep }) => {
  const step = steps[currentStep - 1] ?? null;
  const explanation = explainStep(step);
  if (!explanation) return null;
  return (
    <div className="bg-[#0d1117] border-b border-[#30363d] px-3 py-2 flex gap-2 items-start shrink-0">
      <span className="text-yellow-400 text-xs mt-0.5 shrink-0">💡</span>
      <p className="text-[11px] text-gray-300 leading-relaxed">{explanation}</p>
    </div>
  );
};

// ── Vector widget (Feature: STL Visualizations) ───────────────────────────────

const VectorWidget = ({ name, vec }) => {
  const { elements, size, capacity, elemType, heapAddr } = vec;
  const slots = Math.max(capacity, size, 1);

  return (
    <div className="w-full bg-[#0d1117]/80 rounded border border-emerald-500/30 p-2 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-mono text-emerald-400 bg-emerald-950/50 px-1 py-0.5 rounded border border-emerald-900/50 font-semibold">
            vector&lt;{elemType}&gt;
          </span>
          <span className="font-mono font-bold text-gray-100 text-[10px]">{name}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-gray-500">size <span className="text-emerald-400 font-bold">{size}</span></span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-500">cap <span className="text-cyan-400 font-bold">{capacity}</span></span>
        </div>
      </div>

      {/* Capacity bar — shows elements vs reserved space */}
      <div className="flex gap-0.5 mb-1.5 flex-wrap">
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < size;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-6 h-5 rounded-sm border text-[8px] font-mono font-bold flex items-center justify-center transition-all duration-200 ${
                  filled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-[#161b22] border-[#30363d] text-gray-700'
                }`}
              >
                {filled ? String(elements[i] ?? '') : '·'}
              </div>
              <span className="text-[7px] text-gray-600 font-mono">{i}</span>
            </div>
          );
        })}
      </div>

      {/* Heap address */}
      {heapAddr && (
        <div className="flex items-center gap-1 text-[8px] font-mono text-gray-600 mt-0.5">
          <span className="text-cyan-600">heap→</span>
          <span>{heapAddr}</span>
        </div>
      )}
    </div>
  );
};

// ── Memory Visualization ──────────────────────────────────────────────────────

const MemoryVisualization = ({ vizState, arrayAnimState = {}, steps = [], currentStep = 0, totalSteps: _totalSteps = 0 }) => {
  const [hoveredVar, setHoveredVar] = useState(null);
  const [vizMode, setVizMode] = useState('stack-heap');

  const hasMemoryLeaks = vizState.status === 'COMPLETED' && Object.keys(vizState.heap || {}).length > 0;

  const arrows = useMemo(() => {
    const newArrows = [];
    if (vizState.stack.length > 0) {
      [...vizState.stack].reverse().forEach((frame) => {
        Object.entries(frame.variables).forEach(([name, varData]) => {
          if (!varData.type.includes('*')) return;
          let targetId = null;
          if (varData.value) {
            const valueStr = String(varData.value);
            const arrayMatch = valueStr.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) targetId = `var-${arrayMatch[1]}-${arrayMatch[2]}`;
            if (!targetId) {
              const varRefMatch = valueStr.match(/^&(\w+)$/);
              if (varRefMatch) targetId = `var-${varRefMatch[1]}`;
            }
            if (!targetId) {
              if (vizState.heap && vizState.heap[varData.value]) {
                targetId = `heap-${varData.value}`;
              } else {
                const targetVarEntry = Object.entries(frame.variables).find(([, v]) => v.address === varData.value);
                if (targetVarEntry) targetId = `var-${targetVarEntry[0]}`;
              }
            }
          }
          if (targetId) {
            newArrows.push({
              key: `arrow-stack-${frame.id}-${name}-to-${targetId}`,
              start: `anchor-${name}`,
              end: targetId,
              sourceVar: name
            });
          }
        });
      });
    }
    if (vizState.heap) {
      Object.entries(vizState.heap).forEach(([address, heapBlock]) => {
        if (heapBlock.value && typeof heapBlock.value === 'object') {
          Object.entries(heapBlock.value).forEach(([key, val]) => {
            if (typeof val === 'string' && val.startsWith('0x') && vizState.heap[val]) {
              newArrows.push({
                key: `arrow-heap-${address}-${key}-to-${val}`,
                start: `heap-${address}-field-${key}`,
                end: `heap-${val}`,
                sourceVar: null
              });
            }
          });
        }
      });
    }
    return newArrows;
  }, [vizState]);

  return (
    <div className="flex-1 bg-[#0d1117] flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-2 py-1.5 flex items-center gap-3 shrink-0">
        <div className="mr-auto">
          <h2 className="text-xs font-bold text-white">Memory Visualization</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {vizMode === 'stack-heap' ? 'Real-time Stack & Heap' : vizMode === 'ds-view' ? 'Stack / Queue Visualizer' : 'Recursive Call Tree'}
          </p>
        </div>
        <div className="flex rounded-md border border-[#30363d] overflow-hidden">
          {VIZ_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => setVizMode(mode.key)}
              className={`px-2.5 py-1 text-[10px] font-mono transition-colors flex items-center gap-1.5 ${
                vizMode === mode.key
                  ? 'bg-cyan-500/15 text-cyan-400 border-r border-cyan-500/30'
                  : 'bg-[#0d1117] text-gray-500 hover:text-gray-300 hover:bg-[#161b22] border-r border-[#30363d]'
              } last:border-r-0`}
              title={mode.label}
            >
              <span className="text-xs">{mode.icon}</span>
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Why Panel — shown for all non-tree modes when a step is active */}
      {vizMode !== 'recursion-tree' && (
        <WhyPanel steps={steps} currentStep={currentStep} />
      )}

      {/* Recursion Tree View */}
      {vizMode === 'recursion-tree' && (
        <RecursionTreeCanvas steps={steps} currentStep={currentStep} />
      )}

      {/* DS View */}
      {vizMode === 'ds-view' && (
        <div id="arrow-container" className="flex-1 flex overflow-hidden relative">
          <div className="w-[35%] bg-[#161b22] border-r border-[#30363d] p-2 overflow-y-auto flex flex-col gap-2 relative z-10 shadow-xl shadow-black/20">
            <div className="flex items-center gap-1.5 pb-1 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-20">
              <svg className="w-3 h-3 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Call Stack</h3>
            </div>
            {vizState.stack.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-gray-600 text-xs italic">Stack is empty</div>
                <div className="text-gray-700 text-[10px] mt-1">Press Run</div>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {[...vizState.stack].reverse().map((frame, frameIdx) => (
                  <StackFrame key={frame.id} frame={frame} frameIdx={frameIdx} onHoverVar={setHoveredVar} arrayAnimState={arrayAnimState} />
                ))}
              </div>
            )}
          </div>
          <DataStructureView vizState={vizState} />
        </div>
      )}

      {/* Stack & Heap View */}
      {vizMode === 'stack-heap' && (
        <div id="arrow-container" className="flex-1 flex overflow-hidden relative">
          {/* Stack */}
          <div className="w-[40%] bg-[#161b22] border-r border-[#30363d] p-2 overflow-y-auto flex flex-col gap-2 relative z-10 shadow-xl shadow-black/20">
            <div className="flex items-center gap-1.5 pb-1 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-20">
              <svg className="w-3 h-3 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Stack</h3>
            </div>
            {vizState.stack.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-gray-600 text-xs italic">Stack is empty</div>
                <div className="text-gray-700 text-[10px] mt-1">Press Run</div>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {[...vizState.stack].reverse().map((frame, frameIdx) => (
                  <StackFrame key={frame.id} frame={frame} frameIdx={frameIdx} onHoverVar={setHoveredVar} arrayAnimState={arrayAnimState} />
                ))}
              </div>
            )}
          </div>

          {/* Heap */}
          <div className="w-[60%] bg-[#0d1117] p-2 overflow-y-auto relative z-0">
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />
            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-[#30363d] sticky top-0 bg-[#0d1117]/90 backdrop-blur-sm z-20">
              <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
              <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Heap (Dynamic Memory)</h3>
              {hasMemoryLeaks && (
                <span className="ml-auto text-[9px] font-bold text-red-400 bg-red-900/30 border border-red-500/40 px-1.5 py-0.5 rounded animate-pulse">
                  ⚠ MEMORY LEAK
                </span>
              )}
            </div>

            {/* Memory leak warning banner */}
            {hasMemoryLeaks && (
              <div className="mb-2 bg-red-900/20 border border-red-500/40 rounded-md px-3 py-2 relative z-10">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="text-red-300 text-[11px] font-semibold">Memory Leak Detected</p>
                    <p className="text-red-400/70 text-[10px] mt-0.5 leading-relaxed">
                      {Object.keys(vizState.heap).length} heap block{Object.keys(vizState.heap).length > 1 ? 's were' : ' was'} never freed with <code className="font-mono bg-red-900/40 px-0.5 rounded">delete</code>.
                      These allocations persist until the process exits, wasting memory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative z-10 min-h-50">
              {Object.keys(vizState.heap || {}).length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center h-full opacity-50">
                  <div className="w-12 h-12 border-2 border-dashed border-gray-700 rounded-lg mb-2 flex items-center justify-center">
                    <span className="text-gray-700 text-xl font-mono">NULL</span>
                  </div>
                  <div className="text-gray-600 text-xs italic">No dynamic allocations</div>
                </div>
              ) : (
                <div className="flex flex-wrap content-start gap-4 p-2 pt-4">
                  {Object.entries(vizState.heap).map(([address, data]) => (
                    <HeapBlock key={address} address={address} data={data} isLeaked={hasMemoryLeaks} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SVG arrow overlay */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none sticky-svg"
            style={{ zIndex: 50, overflow: 'visible' }}
          >
            {arrows.map(arrow => (
              <PointerArrow
                key={arrow.key}
                startId={arrow.start}
                endId={arrow.end}
                color="#d946ef"
                isHovered={hoveredVar === arrow.sourceVar}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

// ── Stack Frame ───────────────────────────────────────────────────────────────

const StackFrame = ({ frame, frameIdx, onHoverVar, arrayAnimState = {} }) => {
  const arrayPointers = useMemo(() => {
    const pointers = {};
    const arrays = {};
    const intVars = {};
    Object.entries(frame.variables).forEach(([name, varData]) => {
      if (name === '__return__') return;
      if (Array.isArray(varData.value)) {
        arrays[name] = varData.value.length;
        pointers[name] = {};
      } else if (typeof varData.value === 'number' && INDEX_VAR_NAMES.has(name)) {
        intVars[name] = varData.value;
      }
    });
    Object.entries(intVars).forEach(([varName, val]) => {
      Object.entries(arrays).forEach(([arrName, arrLen]) => {
        if (val >= 0 && val < arrLen) {
          if (!pointers[arrName]) pointers[arrName] = {};
          pointers[arrName][varName] = val;
        }
      });
    });
    return pointers;
  }, [frame.variables]);

  const regularVars   = Object.entries(frame.variables).filter(([n, d]) => n !== '__return__' && !Array.isArray(d.value) && !d.value?.__stl);
  const arrayVars     = Object.entries(frame.variables).filter(([n, d]) => n !== '__return__' && Array.isArray(d.value));
  const vectorVars    = Object.entries(frame.variables).filter(([n, d]) => n !== '__return__' && d.value?.__stl === 'vector');
  const hasReturnVar  = !!frame.variables.__return__;

  return (
    <div
      className="bg-linear-to-br from-indigo-950/40 to-purple-950/20 rounded-md border border-indigo-500/30 overflow-hidden shadow-sm hover:shadow-indigo-500/10 transition-shadow duration-300"
      style={{ animationDelay: `${frameIdx * 100}ms` }}
    >
      <div className="bg-indigo-900/40 px-2 py-1.5 border-b border-indigo-500/20 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-indigo-200">{frame.name}()</span>
        <span className="text-[9px] text-indigo-400/60 font-mono tracking-wide">FRAME {frame.id.toString().slice(-4)}</span>
      </div>

      <div className="p-2.5">
        {regularVars.length === 0 && arrayVars.length === 0 && vectorVars.length === 0 && !hasReturnVar ? (
          <div className="text-[10px] text-gray-600 italic text-center py-2">No variables</div>
        ) : (
          <>
            {/* Regular scalar/pointer variables */}
            {regularVars.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {regularVars.map(([name, varData]) => (
                  <RegularVariable
                    key={name}
                    name={name}
                    varData={varData}
                    onHover={() => onHoverVar(name)}
                    onLeave={() => onHoverVar(null)}
                  />
                ))}
              </div>
            )}

            {/* std::vector variables */}
            {vectorVars.length > 0 && (
              <div className="space-y-2 mb-2">
                {vectorVars.map(([name, varData]) => (
                  <VectorWidget key={name} name={name} vec={varData.value} />
                ))}
              </div>
            )}

            {/* Raw arrays */}
            {arrayVars.length > 0 && (
              <div className="space-y-2">
                {arrayVars.map(([name, varData]) => {
                  const swapInfo = arrayAnimState.swap;
                  const swapPair = (swapInfo && swapInfo.arrayName === name) ? swapInfo.pair : null;
                  return (
                    <ArrayCanvas
                      key={name}
                      name={name}
                      varData={varData}
                      pointers={arrayPointers[name] || {}}
                      swapPair={swapPair}
                      onHover={() => onHoverVar(name)}
                      onLeave={() => onHoverVar(null)}
                    />
                  );
                })}
              </div>
            )}

            {hasReturnVar && <ReturnValue varData={frame.variables.__return__} />}
          </>
        )}
      </div>
    </div>
  );
};

const ReturnValue = ({ varData }) => {
  const expression = varData.address;
  return (
    <div className="mt-2 bg-emerald-950/40 rounded border border-emerald-500/30 px-2.5 py-1.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
      <span className="text-emerald-400 text-xs">↩</span>
      <span className="font-mono text-[10px] font-bold text-emerald-300">return</span>
      {expression && <span className="font-mono text-[10px] text-emerald-400/60">{expression}</span>}
      <span className="text-emerald-500/60 text-[10px]">=</span>
      <span className="font-mono text-sm font-bold text-emerald-300">{String(varData.value)}</span>
    </div>
  );
};

const RegularVariable = ({ name, varData, onHover, onLeave }) => {
  const isPointer = varData.type.includes('*');
  return (
    <div id={`var-${name}`} className="relative group inline-block" onMouseEnter={onHover} onMouseLeave={onLeave}>
      <div className="bg-[#0d1117]/80 rounded border border-[#30363d] hover:border-cyan-500/40 px-2 py-1 transition-all duration-200 shadow-sm cursor-default">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[7px] font-mono text-orange-300 bg-orange-950/50 px-1 py-0.5 rounded font-semibold border border-orange-900/50">
            {varData.type}
          </span>
          <span className="font-mono font-bold text-gray-100 text-[10px]">{name}</span>
          {varData.address && (
            <span className="text-[7px] font-mono text-gray-600 ml-auto pl-2">{varData.address}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 relative">
          {isPointer && (
            <div id={`anchor-${name}`} className="w-2 h-2 bg-cyan-400 rounded-full shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          )}
          <span className="text-gray-500 text-[9px]">=</span>
          <span className={`font-mono font-bold text-[11px] ${isPointer ? 'text-cyan-400' : 'text-emerald-400'}`}>
            {typeof varData.value === 'string' && varData.value.startsWith('&')
              ? varData.value.substring(1)
              : String(varData.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryVisualization;
