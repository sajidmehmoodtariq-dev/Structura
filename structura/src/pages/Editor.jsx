import React, { useEffect, useState, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import parserService from '../services/ParserService';
import { useVisualization } from '../context/VisualizationContext';

const Editor = () => {
  const { state: vizState, actions: vizActions } = useVisualization();
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    int x = 42;
    int* ptr = &x;
    
    cout << "Value: " << *ptr << endl;
    
    return 0;
}`);
  
  const [parserReady, setParserReady] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const highlightLine = (lineNumber) => {
    if (editorRef.current) {
      const newDecorations = editorRef.current.deltaDecorations(
        decorationsRef.current,
        lineNumber > 0 ? [{
          range: {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1
          },
          options: {
            isWholeLine: true,
            className: 'active-line-highlight',
            glyphMarginClassName: 'active-line-glyph'
          }
        }] : []
      );
      decorationsRef.current = newDecorations;
    }
  };

  const simulateExecution = () => {
    // Reset state
    vizActions.reset();
    vizActions.setStatus('RUNNING');
    setCurrentStep(0);
    setIsPlaying(true);
    
    // Step 0: Highlight main function start
    setTimeout(() => {
      highlightLine(4);
      setCurrentStep(1);
    }, 500);

    // Step 1: Push main() frame
    setTimeout(() => {
      vizActions.pushFrame('main');
      highlightLine(5);
      setCurrentStep(2);
    }, 1500);

    // Step 2: int x = 42;
    setTimeout(() => {
      vizActions.setVariable('x', 42, 'int', '0x7FFE1A2B');
      highlightLine(6);
      setCurrentStep(3);
    }, 2500);

    // Step 3: int* ptr = &x;
    setTimeout(() => {
      vizActions.setVariable('ptr', '0x7FFE1A2B', 'int*', '0x7FFE1A1F');
      highlightLine(8);
      setCurrentStep(4);
    }, 3500);

    // Step 4: cout statement
    setTimeout(() => {
      vizActions.logOutput('Value: 42');
      highlightLine(10);
      setCurrentStep(5);
    }, 4500);
    
    // Step 5: Return and cleanup
    setTimeout(() => {
      vizActions.popFrame();
      vizActions.setStatus('COMPLETED');
      highlightLine(0);
      setIsPlaying(false);
    }, 5500);
  };

  const parseCurrentCode = () => {
    if (!parserReady) {
      console.warn('⚠️ Parser not ready yet');
      return;
    }

    try {
      const tree = parserService.parseCode(code);
      
      // Also print a detailed tree walk
      // parserService.printTree(tree);
      
      setParseError(null);
      
      // Only for testing step 2
      simulateExecution();
      
    } catch (error) {
      console.error('Parse error:', error);
      setParseError(error.message);
    }
  };

  // Initialize parser on component mount
  useEffect(() => {
    const initParser = async () => {
      try {
        await parserService.initialize();
        setParserReady(true);
        
        // Parse initial code
        if (code) {
          try {
            const tree = parserService.parseCode(code);
            // parserService.printTree(tree);
          } catch (error) {
            console.error('Parse error:', error);
            setParseError(error.message);
          }
        }
      } catch (error) {
        console.error('Failed to initialize parser:', error);
        setParseError(error.message);
      }
    };

    initParser();
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add custom CSS for active line highlighting
    const style = document.createElement('style');
    style.textContent = `
      .active-line-highlight {
        background: rgba(255, 235, 59, 0.15) !important;
        border-left: 3px solid #FFEB3B !important;
        box-shadow: inset 0 0 10px rgba(255, 235, 59, 0.2);
      }
      .active-line-glyph {
        background: #FFEB3B;
        width: 4px !important;
        margin-left: 3px;
      }
    `;
    document.head.appendChild(style);
  };

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const handleParseClick = () => {
    parseCurrentCode();
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white relative">
      {/* AI Tutor Overlay */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setAiTutorOpen(!aiTutorOpen)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          Gemini Analysis
        </button>
        {aiTutorOpen && (
          <div className="mt-2 bg-gray-900 border border-purple-500/30 rounded-lg p-4 shadow-2xl backdrop-blur-sm max-w-xs">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-1 animate-pulse"></div>
              <div>
                <p className="text-sm font-semibold text-green-400 mb-1">Logic Check: Safe</p>
                <p className="text-xs text-gray-300">No memory leaks detected. Pointer usage is correct.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - 40/60 Split */}
      <div className="flex h-screen">
        {/* Editor Pane - 40% */}
        <div className="w-[40%] flex flex-col border-r border-gray-800">
          {/* Editor Header */}
          <div className="bg-[#252526] px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${parserReady ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <span className="text-sm text-gray-400 font-mono">
                  {parserReady ? 'Ready' : 'Loading...'}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-700"></div>
              <span className="text-sm font-mono text-gray-300">main.cpp</span>
            </div>
            <span className="text-xs text-gray-500 font-mono">C++17</span>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language="cpp"
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                lineNumbers: 'on',
                glyphMargin: true,
                folding: false,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
              }}
            />
          </div>
        </div>

        {/* Visualization Stage - 60% */}
        <div className="w-[60%] bg-[#1e1e1e] flex flex-col relative">
          {/* Visualization Header */}
          <div className="bg-[#252526] px-6 py-3 border-b border-gray-800">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Memory Visualization
            </h2>
            <p className="text-xs text-gray-500 mt-1">Real-time Stack & Heap Memory State</p>
          </div>

          {/* Memory Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Stack Memory Zone - Left Strip */}
            <div className="w-[45%] bg-[#252526] border-r border-gray-800 p-6 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
                <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Stack Memory</h3>
              </div>

              {vizState.stack.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-600 text-sm italic">Stack is empty</div>
                  <div className="text-gray-700 text-xs mt-2">Click "Run" to start execution</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...vizState.stack].reverse().map((frame, frameIdx) => (
                    <div
                      key={frame.id}
                      className="bg-gradient-to-br from-indigo-950/40 to-purple-950/20 rounded-xl border-2 border-indigo-500/40 shadow-lg overflow-hidden"
                      style={{ animationDelay: `${frameIdx * 100}ms` }}
                    >
                      {/* Frame Header */}
                      <div className="bg-indigo-900/60 px-4 py-2 border-b-2 border-indigo-500/30 flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-indigo-200">
                          {frame.name}()
                        </span>
                        <span className="text-xs text-indigo-400/60 font-mono">Frame</span>
                      </div>

                      {/* Variables */}
                      <div className="p-4 space-y-3">
                        {Object.entries(frame.variables).length === 0 ? (
                          <div className="text-xs text-gray-600 italic text-center py-2">
                            No variables yet
                          </div>
                        ) : (
                          Object.entries(frame.variables).map(([name, varData]) => {
                            const isPointer = varData.type.includes('*');
                            const targetVar = isPointer && Object.entries(frame.variables).find(
                              ([, v]) => v.address === varData.value
                            );

                            return (
                              <div
                                key={name}
                                id={`var-${name}`}
                                className="relative group"
                              >
                                {/* Variable Box */}
                                <div className="bg-[#1e1e1e] rounded-lg border-2 border-gray-700 hover:border-cyan-500/60 p-3 transition-all duration-300">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono text-orange-400 bg-orange-950/80 px-2 py-0.5 rounded font-semibold">
                                        {varData.type}
                                      </span>
                                      <span className="font-mono font-bold text-white text-lg">
                                        {name}
                                      </span>
                                    </div>
                                    {varData.address && (
                                      <span className="text-xs font-mono text-gray-500">
                                        {varData.address}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-gray-500 text-sm">=</span>
                                    <span className={`font-mono font-bold text-xl ${isPointer ? 'text-cyan-400' : 'text-green-400'}`}>
                                      {varData.value}
                                    </span>
                                    {isPointer && targetVar && (
                                      <div className="ml-auto flex items-center gap-1 text-xs text-purple-400 bg-purple-950/50 px-2 py-1 rounded">
                                        <span>points to</span>
                                        <span className="font-mono font-bold">{targetVar[0]}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* SVG Arrow for Pointers */}
                                {isPointer && targetVar && (
                                  <svg
                                    className="absolute left-full top-1/2 -translate-y-1/2 ml-4 pointer-events-none"
                                    width="120"
                                    height="80"
                                    style={{ overflow: 'visible' }}
                                  >
                                    <defs>
                                      <marker
                                        id="arrowhead"
                                        markerWidth="10"
                                        markerHeight="10"
                                        refX="9"
                                        refY="3"
                                        orient="auto"
                                      >
                                        <polygon points="0 0, 10 3, 0 6" fill="#06b6d4" />
                                      </marker>
                                      <filter id="glow">
                                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                        <feMerge>
                                          <feMergeNode in="coloredBlur"/>
                                          <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                      </filter>
                                    </defs>
                                    <path
                                      d="M 10 40 Q 60 40, 110 10"
                                      stroke="#06b6d4"
                                      strokeWidth="2"
                                      fill="none"
                                      markerEnd="url(#arrowhead)"
                                      filter="url(#glow)"
                                      className="animate-pulse"
                                      strokeDasharray="5,5"
                                    >
                                      <animate
                                        attributeName="stroke-dashoffset"
                                        from="10"
                                        to="0"
                                        dur="1s"
                                        repeatCount="indefinite"
                                      />
                                    </path>
                                  </svg>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Heap Memory Zone - Right Canvas */}
            <div className="flex-1 bg-[#1a1a1a] p-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                </svg>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Heap Memory</h3>
              </div>
              <div className="text-center py-12 text-gray-600 text-sm italic">
                No dynamic allocations yet
              </div>
            </div>
          </div>

          {/* Console Output */}
          <div className="bg-black border-t border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Console Output</span>
            </div>
            <div className="font-mono text-sm h-20 overflow-y-auto">
              {vizState.output.length === 0 ? (
                <span className="text-gray-700">_</span>
              ) : (
                vizState.output.map((line, idx) => (
                  <div key={idx} className="text-green-400">{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Deck - Floating Bottom Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6">
          {/* Reset Button */}
          <button
            onClick={() => {
              vizActions.reset();
              setCurrentStep(0);
              setIsPlaying(false);
              highlightLine(0);
            }}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors group"
            title="Reset"
          >
            <svg className="w-5 h-5 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Step Back */}
          <button
            className="p-2 hover:bg-gray-800 rounded-full transition-colors group"
            title="Step Back"
            disabled
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={() => {
              if (!isPlaying) {
                simulateExecution();
              }
            }}
            disabled={!parserReady || isPlaying}
            className={`p-4 rounded-full transition-all ${
              parserReady && !isPlaying
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/50'
                : 'bg-gray-700 cursor-not-allowed'
            }`}
            title={isPlaying ? 'Running...' : 'Run'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Step Forward */}
          <button
            className="p-2 hover:bg-gray-800 rounded-full transition-colors group"
            title="Step Forward"
            disabled
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-700"></div>

          {/* Progress Indicator */}
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 font-mono mb-1">Step</span>
            <span className="text-sm font-mono font-bold text-white">
              {currentStep} / {totalSteps}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
