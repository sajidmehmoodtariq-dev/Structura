import React from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

/**
 * ArrayCanvas — Animated array visualization with:
 *  - Smooth index pointer (i, j, pivot) badge sliding
 *  - Animated swap transitions using framer-motion layout
 *  - Cell highlighting during comparisons and swaps
 *
 * Props:
 *   name       – variable name (e.g. "arr")
 *   varData    – { value: number[], type: string, address: string }
 *   pointers   – { [label]: index } e.g. { i: 2, j: 5, pivot: 4 }
 *   swapPair   – [indexA, indexB] | null  – currently swapping pair
 *   comparePair – [indexA, indexB] | null – currently comparing pair
 *   onHover / onLeave – hover callbacks
 */
const ArrayCanvas = ({
  name,
  varData,
  pointers = {},
  swapPair = null,
  comparePair = null,
  onHover,
  onLeave,
}) => {
  const values = varData.value || [];

  // Build a map of index → pointer labels for the badge zone
  const indexToPointers = {};
  Object.entries(pointers).forEach(([label, idx]) => {
    if (idx == null || idx < 0 || idx >= values.length) return;
    if (!indexToPointers[idx]) indexToPointers[idx] = [];
    indexToPointers[idx].push(label);
  });

  // Pointer badge color map
  const badgeColors = {
    i:     { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', glow: 'shadow-yellow-500/20' },
    j:     { bg: 'bg-sky-500/20',    text: 'text-sky-400',    border: 'border-sky-500/40',    glow: 'shadow-sky-500/20' },
    k:     { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40', glow: 'shadow-violet-500/20' },
    pivot: { bg: 'bg-rose-500/20',   text: 'text-rose-400',   border: 'border-rose-500/40',   glow: 'shadow-rose-500/20' },
    low:   { bg: 'bg-teal-500/20',   text: 'text-teal-400',   border: 'border-teal-500/40',   glow: 'shadow-teal-500/20' },
    high:  { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', glow: 'shadow-orange-500/20' },
    key:   { bg: 'bg-pink-500/20',   text: 'text-pink-400',   border: 'border-pink-500/40',   glow: 'shadow-pink-500/20' },
    mid:   { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20' },
    temp:  { bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/40',   glow: 'shadow-gray-500/20' },
  };
  const defaultBadge = { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40', glow: 'shadow-cyan-500/20' };

  const getCellState = (idx) => {
    if (swapPair && (idx === swapPair[0] || idx === swapPair[1])) return 'swap';
    if (comparePair && (idx === comparePair[0] || idx === comparePair[1])) return 'compare';
    return 'idle';
  };

  const cellVariants = {
    idle: {
      borderColor: 'rgba(100, 116, 139, 0.3)',
      backgroundColor: 'rgba(120, 53, 15, 0.15)',
      scale: 1,
    },
    compare: {
      borderColor: 'rgba(59, 130, 246, 0.6)',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      scale: 1.05,
    },
    swap: {
      borderColor: 'rgba(16, 185, 129, 0.7)',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      scale: 1.08,
    },
  };

  return (
    <div
      className="relative group"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="bg-[#0d1117]/80 rounded-lg border border-[#30363d] p-2 hover:border-amber-500/30 transition-colors">
        {/* Array Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[8px] font-mono text-amber-400 bg-amber-950/50 px-1.5 py-0.5 rounded font-semibold border border-amber-900/50">
            {varData.type}
          </span>
          <span className="font-mono font-bold text-gray-200 text-[10px]">
            {name}
          </span>
          <span className="text-[8px] font-mono text-gray-600 ml-1">
            [{values.length}]
          </span>
          {varData.address && (
            <span className="text-[8px] font-mono text-gray-600 ml-auto">
              {varData.address}
            </span>
          )}
        </div>

        {/* Array Cells Row */}
        <LayoutGroup id={`array-${name}`}>
          <div className="flex gap-0.5 overflow-x-auto pb-1 scrollbar-thin relative">
            {values.map((val, idx) => {
              const cellState = getCellState(idx);
              const pointersHere = indexToPointers[idx] || [];

              return (
                <div key={idx} className="flex flex-col items-center relative" style={{ minWidth: 36 }}>
                  {/* Index label */}
                  <span className="text-[7px] text-gray-500 font-mono mb-0.5 select-none">{idx}</span>

                  {/* The cell — uses layout animation for smooth reorder on swap */}
                  <motion.div
                    layout
                    layoutId={`cell-${name}-val-${idx}`}
                    className="rounded-[3px] px-1.5 py-1.5 min-w-8 flex items-center justify-center cursor-default relative overflow-hidden"
                    style={{ border: '1px solid' }}
                    variants={cellVariants}
                    animate={cellState}
                    transition={{
                      layout: { type: 'spring', stiffness: 300, damping: 28, duration: 0.5 },
                      backgroundColor: { duration: 0.3 },
                      borderColor: { duration: 0.3 },
                      scale: { type: 'spring', stiffness: 400, damping: 20 },
                    }}
                    id={`var-${name}-${idx}`}
                  >
                    {/* Swap glow effect */}
                    {cellState === 'swap' && (
                      <motion.div
                        className="absolute inset-0 rounded-[3px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 0.6, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)' }}
                      />
                    )}
                    {/* Compare glow effect */}
                    {cellState === 'compare' && (
                      <motion.div
                        className="absolute inset-0 rounded-[3px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.3, 0.15] }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)' }}
                      />
                    )}
                    {/* Value */}
                    <motion.span
                      className="font-mono text-[11px] font-bold relative z-10"
                      animate={{
                        color: cellState === 'swap' ? '#34d399' : cellState === 'compare' ? '#60a5fa' : '#fbbf24',
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {val}
                    </motion.span>
                  </motion.div>

                  {/* Pointer Badge Zone */}
                  <div className="h-5 mt-1 flex items-start justify-center gap-0.5 relative">
                    <AnimatePresence mode="popLayout">
                      {pointersHere.map((label) => {
                        const colors = badgeColors[label] || defaultBadge;
                        return (
                          <motion.div
                            key={label}
                            layoutId={`ptr-badge-${name}-${label}`}
                            className={`${colors.bg} ${colors.border} border rounded px-1 py-px shadow-sm ${colors.glow}`}
                            initial={{ opacity: 0, y: -6, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.8 }}
                            transition={{
                              layout: { type: 'spring', stiffness: 350, damping: 25 },
                              opacity: { duration: 0.15 },
                              scale: { duration: 0.15 },
                            }}
                          >
                            <span className={`font-mono text-[8px] font-bold ${colors.text} select-none`}>
                              {label}
                            </span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
};

export default ArrayCanvas;
