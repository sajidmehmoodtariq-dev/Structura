import React from 'react';

const ControlPanel = ({
  currentStep,
  totalSteps,
  isPlaying,
  isPaused,
  parserReady,
  onReset,
  onStepBack,
  onPlayPause,
  onStepForward
}) => {
  return (
    <div className="bg-[#161b22] border-t border-[#30363d] p-1.5">
      <div className="flex items-center justify-center gap-3">
        {/* Reset Button */}
        <button
          onClick={onReset}
          className="p-1 hover:bg-[#30363d] rounded transition-colors group"
          title="Reset"
        >
          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Step Back */}
        <button
          onClick={onStepBack}
          disabled={currentStep === 0 || isPlaying}
          className={`p-1 rounded transition-colors group ${currentStep > 0 && !isPlaying
            ? 'hover:bg-[#30363d] text-gray-400 hover:text-white'
            : 'text-gray-700 cursor-not-allowed'
            }`}
          title="Step Back"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          disabled={!parserReady}
          className={`p-2 rounded transition-all ${parserReady
            ? 'bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
            : 'bg-gray-700 cursor-not-allowed'
            }`}
          title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Run'}
        >
          {isPlaying && !isPaused ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Step Forward */}
        <button
          onClick={onStepForward}
          disabled={currentStep >= totalSteps || isPlaying}
          className={`p-1 rounded transition-colors group ${currentStep < totalSteps && !isPlaying
            ? 'hover:bg-[#30363d] text-gray-400 hover:text-white'
            : 'text-gray-700 cursor-not-allowed'
            }`}
          title="Step Forward"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-[#30363d]"></div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-[10px] font-mono text-gray-500">
            Step {currentStep}/{totalSteps}
          </span>
          <div className="w-24 h-1 bg-[#30363d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
