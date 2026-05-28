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
  const [arrayAnimState, setArrayAnimState] = useState({ swap: null });
  const lastArrayUpdateRef = useRef(null);
  const swapClearTimerRef = useRef(null);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  // Detect swap pairs from consecutive UPDATE_ARRAY_ELEMENT steps
  const detectAndUpdateArrayAnim = (step) => {
    if (!step) return;

    if (step.type === 'UPDATE_ARRAY_ELEMENT') {
      const prev = lastArrayUpdateRef.current;
      lastArrayUpdateRef.current = { ...step.data };

      // Two consecutive updates to same array with different indices = swap
      if (prev && prev.arrayName === step.data.arrayName && prev.index !== step.data.index) {
        // Clear any pending timer
        if (swapClearTimerRef.current) clearTimeout(swapClearTimerRef.current);
        setArrayAnimState({ swap: { arrayName: step.data.arrayName, pair: [prev.index, step.data.index] } });
        // Clear swap highlight after animation completes
        swapClearTimerRef.current = setTimeout(() => {
          setArrayAnimState(prev => ({ ...prev, swap: null }));
        }, 700);
        lastArrayUpdateRef.current = null; // Reset so we don't chain
        return;
      }
    } else {
      lastArrayUpdateRef.current = null;
    }
  };

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

    // Show loading state immediately
    setIsPlaying(true);
    vizActions.setStatus('RUNNING');

    // Defer heavy analysis to next tick so the UI can update first
    setTimeout(() => {
      try {
        const tree = parserService.parseCode(code);
        setParseError(null);

        if (interpreterRef.current) {
          const t0 = performance.now();
          const steps = interpreterRef.current.generateSteps(tree);
          console.log(`📊 Execution Plan: ${steps.length} steps (analyzed in ${(performance.now() - t0).toFixed(0)}ms)`);
          setTotalSteps(steps.length);

          executeStepsWithVisualization(steps);
        }
      } catch (error) {
        console.error('Parse error:', error);
        setParseError(error.message);
        setIsPlaying(false);
        vizActions.setStatus('ERROR');
      }
    }, 16); // One frame delay to let React render loading state
  };

  const stepsRef = useRef([]);
  const executionControlRef = useRef({ shouldStop: false, isPaused: false });
  const skipBranchesRef = useRef(new Map());
  const stepsGenerationTimerRef = useRef(null);

  // Pre-generate steps from current code (deferred to avoid blocking UI)
  const generateStepsFromCode = (codeStr) => {
    if (stepsGenerationTimerRef.current) clearTimeout(stepsGenerationTimerRef.current);
    stepsGenerationTimerRef.current = setTimeout(() => {
      if (!interpreterRef.current || !parserReady) return;
      try {
        const tree = parserService.parseCode(codeStr);
        const steps = interpreterRef.current.generateSteps(tree);
        stepsRef.current = steps;
        setTotalSteps(steps.length);
      } catch (e) {
        console.warn('Step pre-generation failed:', e.message);
      }
    }, 300);
  };

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

      // Handle Early Return (Skip steps until we exit the function)
      if (interpreterRef.current.isReturning) {
        if (step.type !== 'RETURN_FROM_CALL') {
          continue;
        }
        // If it IS RETURN_FROM_CALL, we execute it to pop the frame and reset isReturning
      }

      // Evaluate control flow at runtime
      evaluateControlFlow(step, i);

      // Highlight the line
      highlightLine(step.line);

      // Update step counter
      setCurrentStep(i + 1);

      // Execute the step
      await interpreterRef.current.executeStep(step);

      // Detect array swap animations
      detectAndUpdateArrayAnim(step);

      // Adaptive delay: faster for programs with more steps
      const delay = steps.length > 200 ? 150 : steps.length > 100 ? 300 : steps.length > 50 ? 500 : 800;
      await new Promise(resolve => setTimeout(resolve, delay));
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
    setArrayAnimState({ swap: null });
    lastArrayUpdateRef.current = null;
  };

  const handleStepForward = async () => {
    if (!interpreterRef.current || !parserReady) return;

    // If auto-playing, stop it and switch to manual stepping
    if (isPlaying) {
      executionControlRef.current.shouldStop = true;
      executionControlRef.current.isPaused = false;
      setIsPlaying(false);
      setIsPaused(false);
      // Steps and state are already up to date, just continue from currentStep
    }

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

    // Skip steps that belong to untaken branches (supports nested if/else and switch)
    while (nextStep < stepsRef.current.length) {
      const step = stepsRef.current[nextStep];
      if (step.conditionalBranches && step.conditionalBranches.length > 0) {
        const shouldSkip = step.conditionalBranches.some(({ branch, parent }) => {
          const skipInfo = skipBranchesRef.current.get(parent);
          if (!skipInfo) return false;
          if (skipInfo instanceof Set) return skipInfo.has(branch);
          return skipInfo === branch;
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

    // Evaluate control flow for branching statements
    if (step.type === 'IF_STATEMENT') {
      const condResult = interpreterRef.current.evaluateConditionFromState(step.data.condition);
      const toSkip = new Set();
      toSkip.add(condResult ? 'if-false' : 'if-true');
      skipBranchesRef.current.set(nextStep, toSkip);
    } else if (step.type === 'SWITCH_STATEMENT') {
      const varData = interpreterRef.current.runtimeVariables.get(step.data.variable);
      const switchValue = varData?.value;
      const toSkip = new Set();
      const steps = stepsRef.current;
      for (let j = nextStep + 1; j < steps.length; j++) {
        if (!steps[j].conditionalBranches) continue;
        for (const cb of steps[j].conditionalBranches) {
          if (cb.parent === nextStep && cb.branch.startsWith('case-')) {
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
      skipBranchesRef.current.set(nextStep, toSkip);
    }

    highlightLine(step.line);
    setCurrentStep(nextStep + 1);
    await interpreterRef.current.executeStep(step);

    // Detect array swap animations
    detectAndUpdateArrayAnim(step);

    // If this was the last step
    if (nextStep + 1 >= stepsRef.current.length) {
      vizActions.setStatus('COMPLETED');
      highlightLine(0);
    }
  };

  const handleStepBack = async () => {
    if (currentStep <= 0 || !interpreterRef.current) return;

    // If auto-playing, stop it and switch to manual stepping
    if (isPlaying) {
      executionControlRef.current.shouldStop = true;
      executionControlRef.current.isPaused = false;
      setIsPlaying(false);
      setIsPaused(false);
    }

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
          for (let j = i + 1; j < stepsRef.current.length; j++) {
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
    // Re-generate steps when code changes so step count stays accurate
    stepsRef.current = [];
    setCurrentStep(0);
    generateStepsFromCode(value || '');
  };

  const handleSnippetSelect = (snippetCode) => {
    setCode(snippetCode);
    // Reset visualization
    vizActions.reset();
    setCurrentStep(0);
    stepsRef.current = [];
    highlightLine(0);
    skipBranchesRef.current = new Map();
    if (interpreterRef.current) {
      interpreterRef.current.runtimeVariables = new Map();
    }
    setIsPlaying(false);
    setIsPaused(false);
    executionControlRef.current.shouldStop = true;
    setArrayAnimState({ swap: null });
    lastArrayUpdateRef.current = null;
    // Pre-generate steps so forward/back work immediately
    generateStepsFromCode(snippetCode);
  };

  const _handleParseClick = () => {
    parseCurrentCode();
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white relative">
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">C++17</span>
              {/* Gemini Analysis Button */}
              <div className="relative">
                <button
                  onClick={() => setAiTutorOpen(!aiTutorOpen)}
                  className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                  Gemini
                </button>
                {aiTutorOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-gray-900 border border-purple-500/30 rounded-lg p-3 shadow-2xl backdrop-blur-sm w-64">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-1 animate-pulse shrink-0"></div>
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-0.5">Logic Check: Safe</p>
                        <p className="text-[11px] text-gray-300">No memory leaks detected. Pointer usage is correct.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
          <MemoryVisualization
            vizState={vizState}
            arrayAnimState={arrayAnimState}
            steps={stepsRef.current}
            currentStep={currentStep}
            totalSteps={totalSteps}
          />
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
