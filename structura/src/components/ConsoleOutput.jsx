import React from 'react';

const ConsoleOutput = ({ output }) => {
  return (
    <div className="bg-[#161b22] border-t border-[#30363d] flex flex-col h-32">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#30363d] bg-[#0d1117]">
        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
        <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Console</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
        {output.length === 0 ? (
          <div className="text-gray-600 italic">No output yet</div>
        ) : (
          output.map((line, idx) => (
            <div key={idx} className="text-emerald-300">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsoleOutput;
