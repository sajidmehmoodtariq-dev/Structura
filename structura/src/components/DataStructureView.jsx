import React, { useMemo } from 'react';

// ─── Detection ────────────────────────────────────────────────────────────────

function detectDS(vizState) {
  if (!vizState?.stack?.length) return { type: null };

  const allVars = {};
  vizState.stack.forEach(f =>
    Object.entries(f.variables).forEach(([k, v]) => { if (k !== '__return__') allVars[k] = v; })
  );

  const arrays = Object.entries(allVars).filter(([, v]) => Array.isArray(v.value));
  const nums   = Object.fromEntries(
    Object.entries(allVars).filter(([, v]) => typeof v.value === 'number').map(([k, v]) => [k, v.value])
  );

  // Queue: front + rear
  const fKey = ['front','head','f'].find(k => k in nums);
  const rKey = ['rear','tail','back','r'].find(k => k in nums);
  if (fKey && rKey && arrays.length) {
    const arr = arrays.find(([n]) => /queue|buf|data|arr/i.test(n)) ?? arrays[0];
    return { type: 'queue', arrName: arr[0], arrVal: arr[1].value, front: nums[fKey], rear: nums[rKey], fKey, rKey };
  }

  // Stack: top / size / sp
  const tKey = ['top','size','sp','tos','len'].find(k => k in nums);
  if (tKey && arrays.length) {
    const arr = arrays.find(([n]) => /stack|stk|data|arr|s/i.test(n)) ?? arrays[0];
    return { type: 'stack', arrName: arr[0], arrVal: arr[1].value, top: nums[tKey], tKey };
  }

  return { type: null };
}

// ─── Stack Bucket ─────────────────────────────────────────────────────────────

const StackBucket = ({ arrName, arrVal, top, tKey }) => {
  const capacity = arrVal.length;
  const size     = Math.max(0, top + 1);
  const isEmpty  = top < 0;
  const isFull   = top >= capacity - 1;

  // Visual slots — index 0 at BOTTOM, index `top` at TOP
  const slots = useMemo(() => {
    const s = [];
    for (let i = capacity - 1; i >= 0; i--) {
      s.push({ idx: i, val: arrVal[i], active: i <= top, isTop: i === top });
    }
    return s;
  }, [arrVal, top, capacity]);

  const fillPct = capacity > 0 ? (size / capacity) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">

      {/* Title */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-amber-500/70">
          Stack — {arrName}
        </span>
        <span className="text-[9px] font-mono text-gray-600">{tKey} = {top}</span>
      </div>

      <div className="flex gap-10 items-center">

        {/* ── Bucket ── */}
        <div className="relative flex flex-col items-center">

          {/* TOP arrow — tracks the top element */}
          <div
            className="flex items-center gap-1.5 mb-1.5 transition-all duration-500"
            style={{ opacity: isEmpty ? 0.2 : 1 }}
          >
            <span className="text-[9px] font-mono font-bold text-amber-400 uppercase">{tKey}</span>
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
              <path d="M0 5 H12 M8 1 L14 5 L8 9" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Bucket walls + cells */}
          <div className="relative" style={{ width: 140 }}>

            {/* Left wall */}
            <div
              className="absolute top-0 bottom-4 left-0 w-[2px] rounded-sm"
              style={{
                background: 'linear-gradient(to bottom, #fbbf24aa, #92400e88)',
                clipPath: 'polygon(0 0, 100% 2%, 100% 100%, 0 100%)',
              }}
            />
            {/* Right wall */}
            <div
              className="absolute top-0 bottom-4 right-0 w-[2px] rounded-sm"
              style={{
                background: 'linear-gradient(to bottom, #fbbf24aa, #92400e88)',
                clipPath: 'polygon(0 2%, 100% 0, 100% 100%, 0 100%)',
              }}
            />

            {/* Cells */}
            <div className="flex flex-col gap-[2px] px-3 pt-0 pb-1">
              {slots.map(({ idx, val, active, isTop }) => (
                <div
                  key={idx}
                  className="relative flex items-center justify-between rounded-sm overflow-hidden transition-all duration-500"
                  style={{ height: 28 }}
                >
                  {/* Fill glow */}
                  {isTop && (
                    <div
                      className="absolute inset-0 opacity-25 blur-sm"
                      style={{ background: 'radial-gradient(ellipse, #fbbf24, transparent 70%)' }}
                    />
                  )}

                  {/* Cell background */}
                  <div
                    className="absolute inset-0 rounded-sm transition-all duration-500"
                    style={{
                      background: isTop
                        ? 'linear-gradient(90deg, #78350f60, #f59e0b30, #78350f60)'
                        : active
                          ? '#78350f40'
                          : '#0d111780',
                      border: isTop
                        ? '1px solid #fbbf2470'
                        : active
                          ? '1px solid #92400e50'
                          : '1px solid #1f293750',
                    }}
                  />

                  {/* Index label */}
                  <span className="relative z-10 text-[8px] font-mono text-gray-700 pl-1">[{idx}]</span>

                  {/* Value */}
                  <span
                    className="relative z-10 font-mono font-bold transition-all duration-300 pr-2"
                    style={{
                      fontSize: 13,
                      color: isTop ? '#fde68a' : active ? '#d97706' : '#1f2937',
                      textShadow: isTop ? '0 0 12px #fbbf24' : 'none',
                    }}
                  >
                    {active ? val : ''}
                  </span>

                  {/* TOP badge */}
                  {isTop && !isEmpty && (
                    <div
                      className="absolute -right-14 flex items-center gap-0.5"
                      style={{ animation: 'pulse 2s infinite' }}
                    >
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M10 4 H2 M5 1 L1 4 L5 7" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[7px] font-mono font-bold text-amber-400 uppercase">TOP</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bucket bottom */}
            <div
              className="mx-3 h-[3px] rounded-full"
              style={{ background: 'linear-gradient(90deg, #92400e, #fbbf24, #92400e)' }}
            />

            {/* Fill level bar (inside bucket, on left wall) */}
            <div
              className="absolute left-[3px] bottom-[3px] w-[2px] transition-all duration-700"
              style={{
                height: `${fillPct}%`,
                maxHeight: 'calc(100% - 16px)',
                background: 'linear-gradient(to top, #92400e, #fbbf2460)',
                opacity: 0.5,
              }}
            />
          </div>

          {/* Bottom label */}
          <span className="mt-2 text-[8px] text-amber-900 font-mono uppercase tracking-widest">bottom</span>
        </div>

        {/* ── Stats ── */}
        <div className="flex flex-col gap-3">
          {/* Status badge */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-gray-600 uppercase tracking-wider">Status</span>
            <span
              className="text-xs font-bold font-mono"
              style={{
                color: isEmpty ? '#ef4444' : isFull ? '#f97316' : '#4ade80',
                textShadow: isEmpty ? 'none' : isFull ? '0 0 8px #f97316' : '0 0 8px #4ade8060',
              }}
            >
              {isEmpty ? '○ EMPTY' : isFull ? '● FULL' : '◉ ACTIVE'}
            </span>
          </div>

          {[
            ['Size',     `${size} / ${capacity}`],
            ['Top idx',  isEmpty ? '—' : top],
            ['Top val',  isEmpty ? '—' : arrVal[top]],
          ].map(([label, val]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[8px] text-gray-600 uppercase tracking-wider">{label}</span>
              <span className="text-[11px] font-mono font-bold text-amber-300">{val}</span>
            </div>
          ))}

          {/* Fill bar */}
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[8px] text-gray-600 uppercase tracking-wider">Fill</span>
            <div className="w-16 h-1.5 rounded-full bg-[#1c1c1c] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${fillPct}%`,
                  background: isFull
                    ? 'linear-gradient(90deg, #92400e, #f97316)'
                    : 'linear-gradient(90deg, #78350f, #fbbf24)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Operations hint */}
      <div className="flex gap-4 text-[9px] font-mono text-gray-700">
        <span>PUSH → {tKey}++ then write</span>
        <span className="text-gray-800">·</span>
        <span>POP → read then {tKey}--</span>
      </div>
    </div>
  );
};

// ─── Queue Tube ───────────────────────────────────────────────────────────────

const QueueTube = ({ arrName, arrVal, front, rear, fKey, rKey }) => {
  const capacity = arrVal.length;
  const isEmpty  = rear < front;
  const size     = isEmpty ? 0 : rear - front + 1;
  const isFull   = size === capacity;

  const CELL_W = 56;
  const CELL_H = 56;
  const tubeW  = capacity * CELL_W;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">

      {/* Title */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-500/70">
          Queue — {arrName}
        </span>
        <span className="text-[9px] font-mono text-gray-600">
          {fKey} = {front} &nbsp;·&nbsp; {rKey} = {rear}
        </span>
      </div>

      {/* ── Tube assembly ── */}
      <div className="flex flex-col items-center gap-2">

        {/* Direction labels */}
        <div className="flex items-center justify-between" style={{ width: tubeW + 80 }}>
          <div className="flex items-center gap-1">
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <path d="M20 5 H6 M10 1 L4 5 L10 9" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">dequeue</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-cyan-600/80 uppercase tracking-wider">enqueue</span>
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <path d="M0 5 H14 M10 1 L16 5 L10 9" stroke="#0891b2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Tube row */}
        <div className="flex items-center">

          {/* Left cap (FRONT opening) */}
          <svg width="24" height={CELL_H + 4} viewBox={`0 0 24 ${CELL_H + 4}`} fill="none">
            <path
              d={`M24,2 L6,2 Q2,2 2,${(CELL_H + 4)/2} Q2,${CELL_H+2} 6,${CELL_H+2} L24,${CELL_H+2}`}
              stroke="#22d3ee88"
              strokeWidth="2"
              fill="none"
            />
          </svg>

          {/* Cells */}
          <div
            className="relative flex"
            style={{
              width: tubeW,
              height: CELL_H + 4,
              borderTop: '2px solid #22d3ee44',
              borderBottom: '2px solid #22d3ee44',
            }}
          >
            {arrVal.map((val, i) => {
              const active   = i >= front && i <= rear;
              const isFront  = i === front && active;
              const isRear   = i === rear  && active;

              return (
                <div
                  key={i}
                  className="relative flex flex-col items-center justify-center transition-all duration-500"
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    borderRight: i < capacity - 1 ? '1px solid #164e6320' : 'none',
                  }}
                >
                  {/* Cell fill */}
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      background: isFront
                        ? 'linear-gradient(135deg, #083344 0%, #164e6380 100%)'
                        : isRear
                          ? 'linear-gradient(135deg, #164e6380 0%, #0c4a6e40 100%)'
                          : active
                            ? '#0c4a6e30'
                            : '#0d111760',
                      borderTop: isFront || isRear
                        ? '1px solid #22d3ee50'
                        : active ? '1px solid #0e749440' : '1px solid transparent',
                      borderBottom: isFront || isRear
                        ? '1px solid #22d3ee50'
                        : active ? '1px solid #0e749440' : '1px solid transparent',
                    }}
                  />

                  {/* Glow on front/rear */}
                  {(isFront || isRear) && (
                    <div
                      className="absolute inset-0 opacity-20 blur-md"
                      style={{ background: isFront ? '#22d3ee' : '#0891b2' }}
                    />
                  )}

                  {/* Value */}
                  <span
                    className="relative z-10 font-mono font-bold transition-all duration-300"
                    style={{
                      fontSize: 14,
                      color: isFront ? '#cffafe' : isRear ? '#a5f3fc' : active ? '#0891b2' : '#1e293b',
                      textShadow: isFront ? '0 0 10px #22d3ee80' : 'none',
                    }}
                  >
                    {active ? val : ''}
                  </span>

                  {/* Index */}
                  <span className="relative z-10 text-[7px] font-mono text-gray-700 mt-0.5">[{i}]</span>

                  {/* FRONT / REAR pin */}
                  {(isFront || isRear) && (
                    <div
                      className="absolute -top-5 flex flex-col items-center"
                      style={{ left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <span
                        className="text-[7px] font-mono font-bold uppercase"
                        style={{ color: isFront ? '#22d3ee' : '#0891b2' }}
                      >
                        {isFront ? fKey : rKey}
                      </span>
                      <div className="w-[1px] h-2 bg-current opacity-50" style={{ color: isFront ? '#22d3ee' : '#0891b2', background: isFront ? '#22d3ee' : '#0891b2' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right cap (REAR opening) */}
          <svg width="24" height={CELL_H + 4} viewBox={`0 0 24 ${CELL_H + 4}`} fill="none">
            <path
              d={`M0,2 L18,2 Q22,2 22,${(CELL_H + 4)/2} Q22,${CELL_H+2} 18,${CELL_H+2} L0,${CELL_H+2}`}
              stroke="#0891b288"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        {/* Index ruler */}
        <div className="flex" style={{ marginLeft: 24, width: tubeW }}>
          {arrVal.map((_, i) => (
            <div key={i} className="flex flex-col items-center" style={{ width: CELL_W }}>
              <div className="w-[1px] h-1 bg-gray-800" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-7 items-start">
        {[
          ['Status',    isEmpty ? '○ EMPTY' : isFull ? '● FULL' : '◉ ACTIVE',
                        isEmpty ? '#ef4444' : isFull ? '#f97316' : '#4ade80'],
          ['Size',      `${size} / ${capacity}`, '#22d3ee'],
          ['Front val', isEmpty ? '—' : arrVal[front], '#cffafe'],
          ['Rear val',  isEmpty ? '—' : arrVal[rear],  '#a5f3fc'],
        ].map(([label, val, color]) => (
          <div key={label} className="flex flex-col gap-0.5 items-center">
            <span className="text-[8px] text-gray-600 uppercase tracking-wider">{label}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Operations hint */}
      <div className="flex gap-4 text-[9px] font-mono text-gray-700">
        <span>ENQUEUE → {rKey}++ then write</span>
        <span className="text-gray-800">·</span>
        <span>DEQUEUE → read then {fKey}++</span>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
    <div className="relative">
      {/* Stylized bucket icon */}
      <svg width="52" height="60" viewBox="0 0 52 60" fill="none" className="opacity-20">
        <path d="M8 12 L44 12 L40 52 L12 52 Z" stroke="#64748b" strokeWidth="2" fill="none" strokeLinejoin="round"/>
        <path d="M4 12 L48 12" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 4 Q26 1 34 4" stroke="#64748b" strokeWidth="2" strokeLinecap="round" fill="none"/>
      </svg>
    </div>
    <div>
      <div className="text-xs font-mono text-gray-600 mb-2">No data structure detected</div>
      <div className="text-[9px] text-gray-700 leading-relaxed font-mono">
        Use <span className="text-gray-500">top</span> for stack &nbsp;·&nbsp;
        Use <span className="text-gray-500">front</span> + <span className="text-gray-500">rear</span> for queue
      </div>
    </div>
  </div>
);

// ─── Main Export ──────────────────────────────────────────────────────────────

const DataStructureView = ({ vizState }) => {
  const ds = useMemo(() => detectDS(vizState), [vizState]);

  if (ds.type === 'stack') {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0a0c10]"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #78350f08 0%, transparent 60%)' }}>
        <StackBucket
          arrName={ds.arrName}
          arrVal={ds.arrVal}
          top={ds.top}
          tKey={ds.tKey}
        />
      </div>
    );
  }

  if (ds.type === 'queue') {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0a0c10]"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #083344 0%, transparent 60%)' }}>
        <QueueTube
          arrName={ds.arrName}
          arrVal={ds.arrVal}
          front={ds.front}
          rear={ds.rear}
          fKey={ds.fKey}
          rKey={ds.rKey}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-[#0a0c10]">
      <EmptyState />
    </div>
  );
};

export default DataStructureView;
