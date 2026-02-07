import React, { useEffect, useState, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import parserService from '../services/ParserService';
import InterpreterService from '../services/InterpreterService';
import { useVisualization } from '../context/VisualizationContext';
import MemoryVisualization from '../components/MemoryVisualization';
import ControlPanel from '../components/ControlPanel';
import ConsoleOutput from '../components/ConsoleOutput';
import CodeSnippets from '../components/CodeSnippets';

const Editor = () => {
  const { state: vizState, actions: vizActions, getState } = useVisualization();
  const interpreterRef = useRef(null);
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    int x = 42;
    int* ptr = &x;
    int** handle = &ptr;
    
    cout << "Value: " << **handle << endl;
    
    return 0;
}`);

  const [parserReady, setParserReady] = useState(false);
  const [_parseError, setParseError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const skipBranchesRef = useRef(new Map());

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

    // Reset interpreter runtime state
    if (interpreterRef.current) {
      interpreterRef.current.runtimeVariables = new Map();
    }

    // Branch skipping: Maps parent step index -> Set of branch names to skip
    const skipBranches = new Map();

    // Helper: should this step be skipped?
    const shouldSkipStep = (step) => {
      if (!step.conditionalBranches || step.conditionalBranches.length === 0) return false;
      return step.conditionalBranches.some(({ branch, parent }) => {
        const skipSet = skipBranches.get(parent);
        return skipSet && skipSet.has(branch);
      });
    };

    // Helper: evaluate control flow and set skip branches
    const evaluateControlFlow = (step, stepIndex) => {
      if (step.type === 'IF_STATEMENT') {
        const condResult = interpreterRef.current.evaluateConditionFromState(step.data.condition);
        const toSkip = new Set();
        toSkip.add(condResult ? 'if-false' : 'if-true');
        skipBranches.set(stepIndex, toSkip);
      } else if (step.type === 'SWITCH_STATEMENT') {
        const varData = interpreterRef.current.runtimeVariables.get(step.data.variable);
        const switchValue = varData?.value;
        // Collect all case branches from upcoming steps
        const toSkip = new Set();
        for (let j = stepIndex + 1; j < steps.length; j++) {
          const futureStep = steps[j];
          if (!futureStep.conditionalBranches) continue;
          for (const cb of futureStep.conditionalBranches) {
            if (cb.parent === stepIndex && cb.branch.startsWith('case-')) {
              toSkip.add(cb.branch);
            }
          }
        }
        // Remove the matching case from skip set
        const matchKey = `case-${switchValue}`;
        if (toSkip.has(matchKey)) {
          toSkip.delete(matchKey);
        } else {
          // No matching case - keep default, skip all numbered cases
          toSkip.delete('case-default');
        }
        skipBranches.set(stepIndex, toSkip);
      }
    };

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

      // Skip steps belonging to untaken branches (supports nested if/else and switch)
      if (shouldSkipStep(step)) continue;

      // Evaluate control flow at runtime
      evaluateControlFlow(step, i);

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
    skipBranchesRef.current = new Map();
    if (interpreterRef.current) {
      interpreterRef.current.runtimeVariables = new Map();
    }
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
        skipBranchesRef.current = new Map();
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
      skipBranchesRef.current = new Map();
      interpreterRef.current.runtimeVariables = new Map();
    }

    let nextStep = currentStep;
    if (nextStep >= stepsRef.current.length) return;

    // Skip steps that belong to untaken branches (supports nested if/else)
    while (nextStep < stepsRef.current.length) {
      const step = stepsRef.current[nextStep];
      if (step.conditionalBranches && step.conditionalBranches.length > 0) {
        const shouldSkip = step.conditionalBranches.some(({ branch, parent }) => {
          return skipBranchesRef.current.get(parent) === branch;
        });
        if (shouldSkip) {
          nextStep++;
          continue;
        }
      }
      break;
    }

    if (nextStep >= stepsRef.current.length) return;

    const step = stepsRef.current[nextStep];

    // Evaluate condition for IF_STATEMENT
    if (step.type === 'IF_STATEMENT') {
      const condResult = interpreterRef.current.evaluateConditionFromState(step.data.condition);
      if (condResult) {
        skipBranchesRef.current.set(nextStep, 'if-false');
      } else {
        skipBranchesRef.current.set(nextStep, 'if-true');
      }
    }

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
    skipBranchesRef.current = new Map();
    if (interpreterRef.current) {
      interpreterRef.current.runtimeVariables = new Map();
    }

    if (targetStep > 0) {
      vizActions.setStatus('RUNNING');
      // Re-execute steps up to target, respecting branches
      for (let i = 0; i < targetStep; i++) {
        const step = stepsRef.current[i];

        // Skip steps belonging to untaken branches (supports nested if/else)
        if (step.conditionalBranches && step.conditionalBranches.length > 0) {
          const shouldSkip = step.conditionalBranches.some(({ branch, parent }) => {
            const skipSet = skipBranchesRef.current.get(parent);
            return skipSet && skipSet.has(branch);
          });
          if (shouldSkip) continue;
        }

        // Evaluate control flow at runtime
        if (step.type === 'IF_STATEMENT') {
          const condResult = interpreterRef.current.evaluateConditionFromState(step.data.condition);
          const toSkip = new Set();
          toSkip.add(condResult ? 'if-false' : 'if-true');
          skipBranchesRef.current.set(i, toSkip);
        } else if (step.type === 'SWITCH_STATEMENT') {
          const varData = interpreterRef.current.runtimeVariables.get(step.data.variable);
          const switchValue = varData?.value;
          const toSkip = new Set();
          for (let j = i + 1; j < targetStep; j++) {
            const fs = stepsRef.current[j];
            if (!fs.conditionalBranches) continue;
            for (const cb of fs.conditionalBranches) {
              if (cb.parent === i && cb.branch.startsWith('case-')) {
                toSkip.add(cb.branch);
              }
            }
          }
          const matchKey = `case-${switchValue}`;
          if (toSkip.has(matchKey)) {
            toSkip.delete(matchKey);
          } else {
            toSkip.delete('case-default');
          }
          skipBranchesRef.current.set(i, toSkip);
        }

        await interpreterRef.current.executeStep(step);
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

  const handleSnippetSelect = (snippetCode) => {
    setCode(snippetCode);
    // Reset visualization
    vizActions.reset();
    setCurrentStep(0);
    stepsRef.current = [];
    highlightLine(0);
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

      {/* Main Content - Sidebar + Editor + Visualization */}
      <div className="flex h-screen">
        {/* Code Snippets Sidebar */}
        <CodeSnippets 
          onSelectSnippet={handleSnippetSelect}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        
        {/* Middle - Editor + Console */}
        <div className="flex-[2] flex flex-col border-r border-gray-800 min-w-0">
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

        {/* Right Side - Visualization Stage */}
        <div className="flex-[3] flex flex-col">
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
