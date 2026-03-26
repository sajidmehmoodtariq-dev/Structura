import React, { useMemo, useState } from 'react';
import PointerArrow from './PointerArrow';
import HeapBlock from './HeapBlock';
import ArrayCanvas from './ArrayCanvas';
import RecursionTreeCanvas from './RecursionTreeCanvas';

// Variable names that are commonly used as array indices in sorting/search algorithms
const INDEX_VAR_NAMES = new Set([
  'i', 'j', 'k', 'l', 'p', 'q',
  'low', 'high', 'mid', 'left', 'right',
  'start', 'end', 'pivot', 'min_idx', 'max_idx',
  'minIdx', 'maxIdx', 'lo', 'hi',
]);

const VIZ_MODES = [
  { key: 'stack-heap', label: 'Stack & Heap', icon: '⬛' },
  { key: 'recursion-tree', label: 'Recursion Tree', icon: '🌳' },
];

const MemoryVisualization = ({ vizState, arrayAnimState = {}, steps = [], currentStep = 0, totalSteps: _totalSteps = 0 }) => {
  const [hoveredVar, setHoveredVar] = useState(null);
  const [vizMode, setVizMode] = useState('stack-heap');

  // Calculate all arrows
  const arrows = useMemo(() => {
    const newArrows = [];
    // Loop through Stack variables (existing logic)
    if (vizState.stack.length > 0) {
      [...vizState.stack].reverse().forEach((frame) => {
        Object.entries(frame.variables).forEach(([name, varData]) => {
          if (!varData.type.includes('*')) return;

          let targetId = null;
          // ... (existing logic for targetId calculation) ...

          if (varData.value) {
            const valueStr = String(varData.value);

            // Pattern 1: Pointer to array element - arr[2]
            const arrayMatch = valueStr.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
              targetId = `var-${arrayMatch[1]}-${arrayMatch[2]}`;
            }

            // Pattern 2: Pointer to variable - &pArr
            if (!targetId) {
              const varRefMatch = valueStr.match(/^&(\w+)$/);
              if (varRefMatch) {
                targetId = `var-${varRefMatch[1]}`;
              }
            }

            // Pattern 3: Address-based lookup (Heap or Stack)
            if (!targetId) {
              // Check if it's in Heap
              if (vizState.heap && vizState.heap[varData.value]) {
                targetId = `heap-${varData.value}`;
              }
              // Check if it's a Stack variable address
              else {
                // Check stack variables by address
                const allVars = frame.variables; // Simplified scoping
                const targetVarEntry = Object.entries(allVars).find(([, v]) => v.address === varData.value);
                if (targetVarEntry) {
                  targetId = `var-${targetVarEntry[0]}`;
                }
              }
            }
          }

          if (targetId) {
            newArrows.push({
              key: `arrow-stack-${frame.id}-${name}-to-${targetId}`,
              start: `anchor-${name}`,
              end: targetId,
              sourceVar: name // Store variable name for hover check
            });
          }
        });
      });
    }

    // NEW: Loop through Heap objects for Heap-to-Heap pointers (e.g. Node->next)
    if (vizState.heap) {
      Object.entries(vizState.heap).forEach(([address, heapBlock]) => {
        // Check if it's a struct with fields
        if (heapBlock.value && typeof heapBlock.value === 'object') {
          Object.entries(heapBlock.value).forEach(([key, val]) => {
            // Check if value looks like a pointer address (0x...)
            if (typeof val === 'string' && val.startsWith('0x')) {
              // Check if this address exists in heap
              if (vizState.heap[val]) {
                newArrows.push({
                  key: `arrow-heap-${address}-${key}-to-${val}`,
                  start: `heap-${address}-field-${key}`, // Start from the field span
                  end: `heap-${val}`, // End at the target heap block
                  sourceVar: null // Optional: could link to parent var?
                });
              }
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
      <div className="bg-[#161b22] border-b border-[#30363d] px-2 py-1.5 flex items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-xs font-bold text-white">Memory Visualization</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {vizMode === 'stack-heap' ? 'Real-time Stack & Heap' : 'Recursive Call Tree'}
          </p>
        </div>

        {/* Viz Mode Toggle Buttons */}
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

      {/* Recursion Tree View */}
      {vizMode === 'recursion-tree' && (
        <RecursionTreeCanvas steps={steps} currentStep={currentStep} />
      )}

      {/* Memory Layout with Arrow Container */}
      {vizMode === 'stack-heap' && (
      <div id="arrow-container" className="flex-1 flex overflow-hidden relative">
        {/* Stack Memory Zone - 40% width (reduced to give more space to heap) */}
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
                <StackFrame
                  key={frame.id}
                  frame={frame}
                  frameIdx={frameIdx}
                  onHoverVar={setHoveredVar}
                  arrayAnimState={arrayAnimState}
                />
              ))}
            </div>
          )}
        </div>

        {/* Heap Memory Zone - 60% width */}
        <div className="w-[60%] bg-[#0d1117] p-2 overflow-y-auto relative z-0">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />

          <div className="flex items-center gap-1.5 mb-4 pb-1 border-b border-[#30363d] sticky top-0 bg-[#0d1117]/90 backdrop-blur-sm z-20">
            <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
            </svg>
            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Heap (Dynamic Memory)</h3>
          </div>

          <div className="relative z-10 min-h-[200px]">
            {Object.keys(vizState.heap || {}).length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center justify-center h-full opacity-50">
                <div className="w-12 h-12 border-2 border-dashed border-gray-700 rounded-lg mb-2 flex items-center justify-center">
                  <span className="text-gray-700 text-xl font-mono">NULL</span>
                </div>
                <div className="text-gray-600 text-xs italic">No dynamic allocations</div>
              </div>
            ) : (
              <div className="flex flex-wrap content-start gap-4 p-2">
                {Object.entries(vizState.heap).map(([address, data]) => (
                  <HeapBlock key={address} address={address} data={data} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SVG Overlay for Arrows - Inside arrow-container */}
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

const StackFrame = ({ frame, frameIdx, onHoverVar, arrayAnimState = {} }) => {
  // Derive pointer badges: detect which integer vars are array indices
  const arrayPointers = useMemo(() => {
    const pointers = {}; // { arrayName: { varLabel: index } }
    const arrays = {};
    const intVars = {};

    // Separate arrays from integer variables
    Object.entries(frame.variables).forEach(([name, varData]) => {
      if (name === '__return__') return;
      if (Array.isArray(varData.value)) {
        arrays[name] = varData.value.length;
        pointers[name] = {};
      } else if (typeof varData.value === 'number' && INDEX_VAR_NAMES.has(name)) {
        intVars[name] = varData.value;
      }
    });

    // Assign integer vars to matching arrays (value must be within bounds)
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

  return (
    <div
      className="bg-linear-to-br from-indigo-950/[0.4] to-purple-950/[0.2] rounded-md border border-indigo-500/[0.3] overflow-hidden shadow-sm hover:shadow-indigo-500/10 transition-shadow duration-300"
      style={{ animationDelay: `${frameIdx * 100}ms` }}
    >
      {/* Frame Header */}
      <div className="bg-indigo-900/[0.4] px-2 py-1.5 border-b border-indigo-500/[0.2] flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-indigo-200">
          {frame.name}()
        </span>
        <span className="text-[9px] text-indigo-400/[0.6] font-mono tracking-wide">FRAME {frame.id.toString().slice(-4)}</span>
      </div>

      {/* Variables */}
      <div className="p-2.5">
        {Object.entries(frame.variables).filter(([n]) => n !== '__return__').length === 0 && !frame.variables.__return__ ? (
          <div className="text-[10px] text-gray-600 italic text-center py-2">
            No variables
          </div>
        ) : (
          <>
            {/* Regular variables - horizontal wrap */}
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(frame.variables)
                .filter(([name, varData]) => name !== '__return__' && !Array.isArray(varData.value))
                .map(([name, varData]) => (
                  <RegularVariable
                    key={name}
                    name={name}
                    varData={varData}
                    onHover={() => onHoverVar(name)}
                    onLeave={() => onHoverVar(null)}
                  />
                ))}
            </div>
            {/* Arrays - full width, stacked, using animated ArrayCanvas */}
            <div className="space-y-2">
              {Object.entries(frame.variables)
                .filter(([name, varData]) => name !== '__return__' && Array.isArray(varData.value))
                .map(([name, varData]) => {
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
            {/* Return value indicator */}
            {frame.variables.__return__ && (
              <ReturnValue varData={frame.variables.__return__} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ReturnValue = ({ varData }) => {
  const expression = varData.address; // expression stored in address field
  return (
    <div className="mt-2 bg-emerald-950/40 rounded border border-emerald-500/30 px-2.5 py-1.5 flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
      <span className="text-emerald-400 text-xs">↩</span>
      <span className="font-mono text-[10px] font-bold text-emerald-300">return</span>
      {expression && (
        <span className="font-mono text-[10px] text-emerald-400/60">
          {expression}
        </span>
      )}
      <span className="text-emerald-500/60 text-[10px]">=</span>
      <span className="font-mono text-sm font-bold text-emerald-300">
        {String(varData.value)}
      </span>
    </div>
  );
};

const RegularVariable = ({ name, varData, onHover, onLeave }) => {
  const isPointer = varData.type.includes('*');

  return (
    <div
      id={`var-${name}`}
      className="relative group inline-block"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="bg-[#0d1117]/80 rounded border border-[#30363d] hover:border-cyan-500/40 px-2 py-1 transition-all duration-200 shadow-sm cursor-default">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[7px] font-mono text-orange-300 bg-orange-950/[0.5] px-1 py-0.5 rounded font-semibold border border-orange-900/50">
            {varData.type}
          </span>
          <span className="font-mono font-bold text-gray-100 text-[10px]">
            {name}
          </span>
          {varData.address && (
            <span className="text-[7px] font-mono text-gray-600 ml-auto pl-2">
              {varData.address}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 relative">
          {isPointer && (
            <div
              id={`anchor-${name}`}
              className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
            />
          )}
          <span className="text-gray-500 text-[9px]">=</span>
          <span className={`font-mono font-bold text-[11px] ${isPointer ? 'text-cyan-400' : 'text-emerald-400'}`}>
            {/* Clean up display value - remove & prefix for pointers to variables */}
            {typeof varData.value === 'string' && varData.value.startsWith('&')
              ? varData.value.substring(1)  // Show pArr instead of &pArr
              : String(varData.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryVisualization;
