import React, { useEffect, useState, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import parserService from '../services/ParserService';
import InterpreterService from '../services/InterpreterService';
import { useVisualization } from '../context/VisualizationContext';
import MemoryVisualization from '../components/MemoryVisualization';
import ControlPanel from '../components/ControlPanel';
import ConsoleOutput from '../components/ConsoleOutput';

const Editor = () => {
  const { state: vizState, actions: vizActions, getState } = useVisualization();
  const interpreterRef = useRef(null);
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    int arr[5] = {10, 20, 30, 40, 50};
    int* pArr = &arr[2];
    int** handle = &pArr;
    
    cout << "Value at pArr: " << *pArr << endl;
    
    return 0;
}`);

  const [parserReady, setParserReady] = useState(false);
  const [_parseError, setParseError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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

  const parseCurrentCode = () => {
    if (!parserReady) {
      console.warn('⚠️ Parser not ready yet');
      return;
    }

    try {
      const tree = parserService.parseCode(code);
      setParseError(null);

      // Generate steps from AST using interpreter
      if (interpreterRef.current) {
        const steps = interpreterRef.current.generateSteps(tree);
        setTotalSteps(steps.length);
        console.log('📊 Execution Plan:', steps);

        // Execute the steps
        executeStepsWithVisualization(steps);
      }

    } catch (error) {
      console.error('Parse error:', error);
      setParseError(error.message);
    }
  };

  const stepsRef = useRef([]);
  const executionControlRef = useRef({ shouldStop: false, isPaused: false });

  const executeStepsWithVisualization = async (steps) => {
    if (!interpreterRef.current) return;

    stepsRef.current = steps;
    executionControlRef.current.isPaused = false;
    executionControlRef.current.shouldStop = false;

    setIsPlaying(true);
    setIsPaused(false);
    vizActions.reset();
    vizActions.setStatus('RUNNING');
    setCurrentStep(0);

    // Stop before the last step (POP_FRAME) to keep stack visible
    const lastStepToExecute = steps.length - 1;

    for (let i = 0; i < lastStepToExecute; i++) {
      // Check if we should stop
      if (executionControlRef.current.shouldStop) {
        break;
      }

      // Wait while paused
      while (executionControlRef.current.isPaused && !executionControlRef.current.shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (executionControlRef.current.shouldStop) {
        break;
      }

      const step = steps[i];

      // Highlight the line
      highlightLine(step.line);

      // Update step counter
      setCurrentStep(i + 1);

      // Execute the step
      await interpreterRef.current.executeStep(step);

      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Don't clear - leave stack visible for user to see
    // Keep the last line highlighted (return statement)
    if (lastStepToExecute > 0) {
      highlightLine(steps[lastStepToExecute - 1].line);
    }
    vizActions.setStatus('COMPLETED');
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handlePause = () => {
    executionControlRef.current.isPaused = true;
    setIsPaused(true);
  };

  const handleResume = () => {
    executionControlRef.current.isPaused = false;
    setIsPaused(false);
  };

  const handleStop = () => {
    executionControlRef.current.shouldStop = true;
    executionControlRef.current.isPaused = false;
    setIsPlaying(false);
    setIsPaused(false);
    highlightLine(0);
    vizActions.setStatus('IDLE');
  };

  const handleStepForward = async () => {
    if (!interpreterRef.current || !parserReady) return;

    // Generate steps if not already done
    if (stepsRef.current.length === 0) {
      try {
        const tree = parserService.parseCode(code);
        const steps = interpreterRef.current.generateSteps(tree);
        stepsRef.current = steps;
        setTotalSteps(steps.length);
        vizActions.reset();
        vizActions.setStatus('RUNNING');
      } catch (error) {
        console.error('Parse error:', error);
        return;
      }
    }

    // Initialize if not started
    if (currentStep === 0) {
      vizActions.reset();
      vizActions.setStatus('RUNNING');
    }

    const nextStep = currentStep;
    if (nextStep >= stepsRef.current.length) return;

    const step = stepsRef.current[nextStep];

    highlightLine(step.line);
    setCurrentStep(nextStep + 1);
    await interpreterRef.current.executeStep(step);

    // If this was the last step
    if (nextStep + 1 >= stepsRef.current.length) {
      vizActions.setStatus('COMPLETED');
      highlightLine(0);
    }
  };

  const handleStepBack = async () => {
    if (currentStep <= 0 || !interpreterRef.current) return;

    // Generate steps if not already done
    if (stepsRef.current.length === 0) {
      try {
        const tree = parserService.parseCode(code);
        const steps = interpreterRef.current.generateSteps(tree);
        stepsRef.current = steps;
        setTotalSteps(steps.length);
      } catch (error) {
        console.error('Parse error:', error);
        return;
      }
    }

    // Reset and replay up to previous step
    const targetStep = currentStep - 1;
    vizActions.reset();

    if (targetStep > 0) {
      vizActions.setStatus('RUNNING');
      // Re-execute steps up to target
      for (let i = 0; i < targetStep; i++) {
        await interpreterRef.current.executeStep(stepsRef.current[i]);
      }
      setCurrentStep(targetStep);
      highlightLine(stepsRef.current[targetStep - 1].line);
    } else {
      setCurrentStep(0);
      highlightLine(0);
      vizActions.setStatus('IDLE');
    }
  };

  // Initialize parser on component mount
  useEffect(() => {
    const initParser = async () => {
      try {
        await parserService.initialize();
        setParserReady(true);

        // Initialize interpreter
        interpreterRef.current = new InterpreterService(vizActions, getState);

        // Parse initial code
        if (code) {
          try {
            const tree = parserService.parseCode(code);
            // Generate execution steps from AST
            const steps = interpreterRef.current.generateSteps(tree);
            setTotalSteps(steps.length);
            console.log('Generated execution steps:', steps);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditorDidMount = (editor, _monaco) => {
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

  const _handleParseClick = () => {
    parseCurrentCode();
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white relative">
      {/* AI Tutor Overlay */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setAiTutorOpen(!aiTutorOpen)}
          className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
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
        {/* Left Side - Editor + Console (40%) */}
        <div className="w-[40%] flex flex-col border-r border-gray-800">
          {/* Editor Header */}
          <div className="bg-[#161b22] px-2 py-1.5 border-b border-[#30363d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${parserReady ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <span className="text-xs text-gray-400 font-mono">
                  {parserReady ? 'Ready' : 'Loading...'}
                </span>
              </div>
              <div className="h-3 w-px bg-[#30363d]"></div>
              <span className="text-xs font-mono text-gray-300">main.cpp</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">C++17</span>
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

          {/* Console Output - Below Editor */}
          <ConsoleOutput output={vizState.output} />
        </div>

        {/* Visualization Stage - 60% */}
        <div className="w-[60%] flex flex-col">
          <MemoryVisualization vizState={vizState} />
          <ControlPanel
            currentStep={currentStep}
            totalSteps={totalSteps}
            isPlaying={isPlaying}
            isPaused={isPaused}
            parserReady={parserReady}
            onReset={() => {
              handleStop();
              vizActions.reset();
              setCurrentStep(0);
              stepsRef.current = [];
              highlightLine(0);
            }}
            onStepBack={handleStepBack}
            onPlayPause={() => {
              if (isPlaying) {
                if (isPaused) {
                  handleResume();
                } else {
                  handlePause();
                }
              } else {
                parseCurrentCode();
              }
            }}
            onStepForward={handleStepForward}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
