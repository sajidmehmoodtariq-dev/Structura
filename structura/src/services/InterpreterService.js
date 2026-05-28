import { astHelperMethods } from './interpreter/astHelpers.js';
import { analyzerMethods } from './interpreter/analyzer.js';
import { expressionEvaluatorMethods } from './interpreter/expressionEvaluator.js';
import { outputExtractorMethods } from './interpreter/outputExtractor.js';
import { stepExecutorMethods } from './interpreter/stepExecutor.js';

class InterpreterService {
  constructor(visualizationActions, getStateFunction = null) {
    this.vizActions = visualizationActions;
    this.getState = getStateFunction;
    this.tree = null;
    this.currentLine = 0;
    this.executionSteps = [];
    this.memoryAddressCounter = 0x7FFE1A00;
    this.variableAddresses = new Map();
    this.arraySizes = new Map();
    this.runtimeVariables = new Map();
    this.analysisVariables = new Map();
    this.functionMap = new Map();
    this.callDepth = 0;
    this.callStack = [];
    this.callArgStack = []; // tracks param→callerVar mapping per call frame
    this.lastReturnValue = null;
    this.isReturning = false;
    this.analysisReturned = false;
  }

  async execute(tree) {
    this.tree = tree;
    this.memoryAddressCounter = 0x7FFE1A00;
    this.executionSteps = [];

    this.vizActions.reset();
    this.vizActions.setStatus('RUNNING');

    await this.walkNode(tree.rootNode);

    this.vizActions.setStatus('COMPLETED');

    return this.executionSteps;
  }

  generateSteps(tree) {
    this.tree = tree;
    this.memoryAddressCounter = 0x7FFE1A00;
    this.executionSteps = [];
    this.runtimeVariables = new Map();
    this.variableAddresses.clear();
    this.functionMap.clear();
    this.arraySizes.clear();
    this.analysisStartTime = performance.now();

    this.populateFunctionMap(tree.rootNode);

    const mainNode = this.functionMap.get('main');
    if (mainNode) {
      this.analyzeNode(mainNode);
    } else {
      console.warn('⚠️ No main function found, falling back to top-level traversal');
      this.analyzeNode(tree.rootNode);
    }

    return this.executionSteps;
  }
}

Object.assign(
  InterpreterService.prototype,
  astHelperMethods,
  expressionEvaluatorMethods,
  outputExtractorMethods,
  analyzerMethods,
  stepExecutorMethods,
);

export default InterpreterService;
