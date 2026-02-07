import React from 'react';

const HeapBlock = ({ address, data }) => {
    // data can be an object { type, value } or just a value
    // We need to handle different types of data visualization

    const renderValue = () => {
        if (typeof data.value === 'object' && data.value !== null) {
            // It's a struct/class object (like Node)
            return (
                <div className="flex flex-col gap-1">
                    {Object.entries(data.value).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-[10px] border-b border-purple-500/20 last:border-0 pb-0.5">
                            <span className="text-purple-300 font-mono">{key}:</span>
                            <span
                                id={`heap-${address}-field-${key}`}
                                className="text-purple-100 font-mono font-bold"
                            >
                                {String(val)}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        // Primitive or simple value
        return <span className="text-purple-100 font-mono font-bold text-sm">{String(data.value)}</span>;
    };

    return (
        <div
            id={`heap-${address}`}
            className="bg-purple-900/30 border border-purple-500/40 rounded p-2 min-w-[120px] shadow-lg shadow-purple-900/10 backdrop-blur-sm relative group hover:border-purple-400/60 transition-all duration-300"
        >
            {/* Header: Address & Type */}
            <div className="flex justify-between items-center mb-2 border-b border-purple-500/30 pb-1">
                <span className="font-mono text-[10px] text-purple-400 font-bold">{data.type}</span>
                <span className="font-mono text-[9px] text-purple-500/80">{address}</span>
            </div>

            {/* Body: Value */}
            <div className="text-center">
                {renderValue()}
            </div>

            {/* Anchor point for incoming arrows (optional visual cue, but ID is on parent) */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};

export default HeapBlock;
