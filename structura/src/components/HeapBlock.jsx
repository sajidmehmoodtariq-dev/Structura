import React from 'react';

const HeapBlock = ({ address, data, isLeaked = false }) => {
    const renderValue = () => {
        if (typeof data.value === 'object' && data.value !== null) {
            return (
                <div className="flex flex-col gap-1">
                    {Object.entries(data.value).map(([key, val]) => (
                        <div key={key} className={`flex justify-between text-[10px] border-b last:border-0 pb-0.5 ${isLeaked ? 'border-red-500/20' : 'border-purple-500/20'}`}>
                            <span className={`font-mono ${isLeaked ? 'text-red-300' : 'text-purple-300'}`}>{key}:</span>
                            <span
                                id={`heap-${address}-field-${key}`}
                                className={`font-mono font-bold ${isLeaked ? 'text-red-100' : 'text-purple-100'}`}
                            >
                                {String(val)}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return <span className={`font-mono font-bold text-sm ${isLeaked ? 'text-red-100' : 'text-purple-100'}`}>{String(data.value)}</span>;
    };

    return (
        <div
            id={`heap-${address}`}
            className={`rounded p-2 min-w-[120px] shadow-lg backdrop-blur-sm relative group transition-all duration-300 ${
              isLeaked
                ? 'bg-red-900/40 border border-red-500/60 shadow-red-900/20 hover:border-red-400/80'
                : 'bg-purple-900/30 border border-purple-500/40 shadow-purple-900/10 hover:border-purple-400/60'
            }`}
        >
            {isLeaked && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                LEAKED
              </div>
            )}

            {/* Header: Address & Type */}
            <div className={`flex justify-between items-center mb-2 border-b pb-1 ${isLeaked ? 'border-red-500/40' : 'border-purple-500/30'}`}>
                <span className={`font-mono text-[10px] font-bold ${isLeaked ? 'text-red-400' : 'text-purple-400'}`}>{data.type}</span>
                <span className={`font-mono text-[9px] ${isLeaked ? 'text-red-500/80' : 'text-purple-500/80'}`}>{address}</span>
            </div>

            {/* Body: Value */}
            <div className="text-center">
                {renderValue()}
            </div>

            <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isLeaked ? 'bg-red-500' : 'bg-purple-500'}`} />
        </div>
    );
};

export default HeapBlock;
