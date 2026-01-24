import React from 'react';
import PointerArrow from './PointerArrow';

const MemoryVisualization = ({ vizState }) => {
  // Calculate all arrows
  const arrows = [];
  if (vizState.stack.length > 0) {
    [...vizState.stack].reverse().forEach((frame) => {
      Object.entries(frame.variables).forEach(([name, varData]) => {
        if (!varData.type.includes('*')) return;
        
        let targetId = null;
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
          
          // Pattern 3: Address-based lookup (fallback)
          if (!targetId) {
            const targetVar = Object.entries(frame.variables).find(
              ([, v]) => v.address === varData.value
            );
            if (targetVar) {
              targetId = `var-${targetVar[0]}`;
            }
          }
        }
        
        if (targetId) {
          arrows.push({
            key: `arrow-${frame.id}-${name}`,
            start: `anchor-${name}`,
            end: targetId
          });
        }
      });
    });
  }

  return (
    <div className="flex-1 bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-2 py-1.5">
        <h2 className="text-xs font-bold text-white">Memory Visualization</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">Real-time Stack & Heap</p>
      </div>

      {/* Memory Layout with Arrow Container */}
      <div id="arrow-container" className="flex-1 flex overflow-hidden relative">
          {/* Stack Memory Zone - 50% width */}
          <div className="w-1/2 bg-[#161b22] border-r border-[#30363d] p-2 overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-[#30363d]">
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
              <div className="space-y-2">
                {[...vizState.stack].reverse().map((frame, frameIdx) => (
                  <StackFrame key={frame.id} frame={frame} frameIdx={frameIdx} />
                ))}
              </div>
            )}
          </div>

          {/* Heap Memory Zone - 50% width */}
          <div className="w-1/2 bg-[#0d1117] p-2">
            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-[#30363d]">
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
              <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Heap</h3>
            </div>
            <div className="text-center py-4 text-gray-600 text-xs italic">
              No allocations
            </div>
          </div>

          {/* SVG Overlay for Arrows - Inside arrow-container */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          >
            {arrows.map(arrow => (
              <PointerArrow
                key={arrow.key}
                startId={arrow.start}
                endId={arrow.end}
                color="#06b6d4"
              />
            ))}
          </svg>
        </div>
    </div>
  );
};

const StackFrame = ({ frame, frameIdx }) => {
  return (
    <div
      className="bg-linear-to-br from-indigo-950/[0.4] to-purple-950/[0.2] rounded border border-indigo-500/[0.4] overflow-hidden"
      style={{ animationDelay: `${frameIdx * 100}ms` }}
    >
      {/* Frame Header */}
      <div className="bg-indigo-900/[0.6] px-2 py-1 border-b border-indigo-500/[0.3] flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-indigo-200">
          {frame.name}()
        </span>
        <span className="text-[10px] text-indigo-400/[0.6] font-mono">Frame</span>
      </div>

      {/* Variables */}
      <div className="p-2">
        {Object.entries(frame.variables).length === 0 ? (
          <div className="text-[10px] text-gray-600 italic text-center py-1">
            No variables
          </div>
        ) : (
          <>
            {/* Regular variables - horizontal wrap */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {Object.entries(frame.variables)
                .filter(([, varData]) => !Array.isArray(varData.value))
                .map(([name, varData]) => (
                  <RegularVariable key={name} name={name} varData={varData} />
                ))}
            </div>
            {/* Arrays - full width, stacked */}
            <div className="space-y-1.5">
              {Object.entries(frame.variables)
                .filter(([, varData]) => Array.isArray(varData.value))
                .map(([name, varData]) => (
                  <ArrayVariable key={name} name={name} varData={varData} />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ArrayVariable = ({ name, varData }) => {
  return (
    <div className="relative group">
      <div className="bg-[#0d1117] rounded border border-[#30363d] p-1">
        {/* Array Header */}
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[8px] font-mono text-amber-400 bg-amber-950/[0.8] px-1 py-0.5 rounded font-semibold">
            {varData.type}
          </span>
          <span className="font-mono font-bold text-white text-[10px]">
            {name}
          </span>
          {varData.address && (
            <span className="text-[8px] font-mono text-gray-500 ml-auto">
              {varData.address}
            </span>
          )}
        </div>
        {/* Array Cells */}
        <div className="flex gap-0.5">
          {varData.value.map((val, idx) => (
            <div key={idx} className="flex flex-col items-center">
              {/* Anchor dot for arrow targeting */}
              <div
                id={`var-${name}-${idx}`}
                className="w-1.5 h-1.5 bg-cyan-400 rounded-full mb-0.5"
              />
              <span className="text-[7px] text-gray-500">{idx}</span>
              <div
                className="bg-amber-950/[0.3] border border-amber-600/[0.4] px-1 py-0.5 min-w-5 flex items-center justify-center"
              >
                <span className="font-mono text-[10px] text-amber-300 font-bold">{val}</span>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
  );
};

const RegularVariable = ({ name, varData }) => {
  const isPointer = varData.type.includes('*');

  return (
    <div
      id={`var-${name}`}
      className="relative group inline-block"
    >
      <div className="bg-[#0d1117] rounded border border-[#30363d] hover:border-cyan-500/[0.6] px-1.5 py-0.5 transition-all duration-200">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[7px] font-mono text-orange-400 bg-orange-950/[0.8] px-0.5 rounded font-semibold">
            {varData.type}
          </span>
          <span className="font-mono font-bold text-white text-[9px]">
            {name}
          </span>
          {varData.address && (
            <span className="text-[7px] font-mono text-gray-600 ml-auto">
              {varData.address}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 relative">
          {isPointer && (
            <div
              id={`anchor-${name}`}
              className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"
            />
          )}
          <span className="text-gray-500 text-[8px]">=</span>
          <span className={`font-mono font-bold text-[10px] ${isPointer ? 'text-cyan-400' : 'text-emerald-400'}`}>
            {/* Clean up display value - remove & prefix for pointers to variables */}
            {String(varData.value).startsWith('&') 
              ? String(varData.value).substring(1)  // Show pArr instead of &pArr
              : String(varData.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryVisualization;
