/**
 * InterpreterService - Walks the AST and drives the visualization
 * Maps C++ syntax tree nodes to memory visualization actions
 */

class InterpreterService {
  constructor(visualizationActions, getStateFunction = null) {
    this.vizActions = visualizationActions;
    this.getState = getStateFunction;
    this.tree = null;
    this.currentLine = 0;
    this.executionSteps = [];
    this.memoryAddressCounter = 0x7FFE1A00; // Mock stack addresses
    this.variableAddresses = new Map(); // Track variable name -> address mapping
    this.arraySizes = new Map(); // Store array sizes for sizeof calculation (varName -> size in bytes)
    this.runtimeVariables = new Map(); // Synchronous runtime state for condition evaluation
    this.analysisVariables = new Map(); // Track variable values during analysis phase (for loop conditions)
    this.functionMap = new Map(); // Store function definitions
    this.callDepth = 0; // Track recursion depth per function
    this.callStack = []; // Runtime call stack for variable scoping
    this.lastReturnValue = null; // Store return value from function calls
    this.isReturning = false; // Flag to indicate early return from function
  }
  /**
   * Generate a mock memory address
   */
  generateAddress() {
    return `0x${(this.memoryAddressCounter++).toString(16).toUpperCase()}`;
  }

  /**
   * Main execution entry point
   * @param {object} tree - The parsed AST tree from ParserService
   */
  async execute(tree) {
    this.tree = tree;
    this.memoryAddressCounter = 0x7FFE1A00;
    this.executionSteps = [];

    // Reset visualization state
    this.vizActions.reset();
    this.vizActions.setStatus('RUNNING');

    // Start walking the AST
    await this.walkNode(tree.rootNode);

    // Execution complete
    this.vizActions.setStatus('COMPLETED');

    return this.executionSteps;
  }

  /**
   * Generate execution steps without running them
   * @param {object} tree - The parsed AST tree
   */
  generateSteps(tree) {
    this.tree = tree;
    this.memoryAddressCounter = 0x7FFE1A00;
    this.executionSteps = [];
    this.runtimeVariables = new Map();
    this.variableAddresses.clear();
    this.functionMap.clear();
    this.arraySizes.clear();

    // Import parser service to extract functions
    // We assume parserService is available or imported. 
    // Since we can't easily import it here without changing imports, 
    // we'll implement a simple extractor or assume tree traversal.
    // Better: traverse root children to populate functionMap.
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

  /**
   * Populate function map from AST
   */
  populateFunctionMap(rootNode) {
    for (let i = 0; i < rootNode.namedChildCount; i++) {
      const node = rootNode.namedChild(i);
      if (node.type === 'function_definition') {
        const declarator = node.childForFieldName('declarator');
        const name = this.getFunctionName(declarator);
        this.functionMap.set(name, node);
      }
    }
  }

  /**
   * Analyze a node and generate execution steps
   */
  analyzeNode(node) {
    if (!node) return;

    switch (node.type) {
      case 'translation_unit':
        // Top level - process children
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeNode(node.namedChild(i));
        }
        break;

      case 'function_definition':
        // If we hit this during traversal (and not via specific call), ignore it
        // unless we are in fallback mode (analyzing root linearly)
        // But since we control the flow now, explicit function definition visits are rare
        // except when analyzing 'main'.
        this.analyzeFunctionDefinition(node);
        break;

      default:
        // Continue traversing
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeNode(node.namedChild(i));
        }
    }
  }

  /**
   * Analyze a function definition
   */
  analyzeFunctionDefinition(node) {
    // Get function name
    const declarator = node.childForFieldName('declarator');
    const functionName = this.getFunctionName(declarator);
    const body = node.childForFieldName('body');

    if (!body) return;

    // Step: Enter function
    this.executionSteps.push({
      type: 'PUSH_FRAME',
      line: node.startPosition.row + 1,
      data: { name: functionName }
    });

    // Analyze function body
    this.analyzeFunctionBody(body);

    // Step: Exit function
    this.executionSteps.push({
      type: 'POP_FRAME',
      line: node.endPosition.row + 1,
      data: { name: functionName }
    });
  }

  /**
   * Analyze function body (compound statement)
   */
  analyzeFunctionBody(bodyNode) {
    for (let i = 0; i < bodyNode.namedChildCount; i++) {
      const child = bodyNode.namedChild(i);
      this.analyzeStatement(child);
    }
  }

  /**
   * Analyze a statement
   */
  analyzeStatement(node) {
    switch (node.type) {
      case 'declaration':
        this.analyzeDeclaration(node);
        break;

      case 'expression_statement':
        // Check if it's a function call only (e.g. `bubbleSort(arr, n);`)
        if (node.namedChild(0)?.type === 'call_expression') {
          this.analyzeFunctionCall(node.namedChild(0));
        } else {
          this.analyzeExpressionStatement(node);
        }
        break;

      case 'if_statement':
        this.analyzeIfStatement(node);
        break;

      case 'switch_statement':
        this.analyzeSwitchStatement(node);
        break;

      case 'while_statement':
        this.analyzeWhileStatement(node);
        break;

      case 'for_statement':
        this.analyzeForStatement(node);
        break;

      case 'return_statement':
        this.analyzeReturnStatement(node);
        break;

      default:
        // Continue traversing
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeStatement(node.namedChild(i));
        }
    }
  }

  /**
   * Analyze a variable declaration
   */
  analyzeDeclaration(node) {
    const typeNode = node.childForFieldName('type');
    const type = typeNode ? typeNode.text : 'unknown';

    // Get all declarators (can be multiple: int x, y;)
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);

      if (child.type === 'init_declarator') {
        const declarator = child.childForFieldName('declarator');
        const value = child.childForFieldName('value');

        const varName = this.getVariableName(declarator);
        const varType = this.getFullType(type, declarator);
        let varValue = value ? this.evaluateExpression(value, true) : 'undefined';
        const address = this.generateAddress();

        // Check if this is an array declaration
        const isArray = declarator && declarator.type === 'array_declarator';

        if (isArray) {
          // Handle array declaration
          const sizeNode = declarator.childForFieldName('size');
          const arraySize = sizeNode ? parseInt(sizeNode.text) : 0;

          // Check if there's an initializer list
          if (value && value.type === 'initializer_list') {
            const values = [];
            for (let j = 0; j < value.namedChildCount; j++) {
              const elem = value.namedChild(j);
              values.push(this.evaluateExpression(elem, true));
            }
            varValue = values;
          } else {
            // Create default array
            varValue = Array(arraySize).fill(0);
          }

          // Store array base address
          this.variableAddresses.set(varName, address);

          const finalSize = varValue && Array.isArray(varValue) ? varValue.length : arraySize;
          const elementSize = 4; // Assume int/float/pointer = 4 bytes
          this.arraySizes.set(varName, finalSize * elementSize);
          console.log(`📏 Array Size Tracked: ${varName} = ${finalSize} elements (${finalSize * elementSize} bytes)`);

          this.executionSteps.push({
            type: 'SET_VARIABLE',
            line: node.startPosition.row + 1,
            data: {
              name: varName,
              value: varValue,
              type: typeNode ? `${typeNode.text}[${finalSize}]` : `int[${finalSize}]`,
              address: address
            }
          });

          // Track array value for analysis (so subscript expressions work)
          this.analysisVariables.set(varName, varValue);
        } else if (varType.includes('*') && value) {
          // Handle pointer declaration
          console.log('🔍 Pointer declaration detected:', {
            varName,
            varType,
            valueType: value.type,
            valueText: value.text
          });

          // Handle new expression: int* ptr = new int(42);
          if (value.type === 'new_expression') {
            const typeNode = value.childForFieldName('type');
            const argsNode = value.childForFieldName('arguments'); // argument_list

            const allocType = typeNode ? typeNode.text : 'unknown';
            let initialValue = 0; // Default for int/primitives

            // Generate a random-looking heap address
            // Use 0x5... range for Heap to distinguish from Stack (0x7...)
            const heapAddress = `0x5F${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;

            // Helper to get value from argument list
            if (argsNode && argsNode.namedChildCount > 0) {
              const arg = argsNode.namedChild(0);
              console.log('🔍 Analyzing new arguments:', {
                argsNodeText: argsNode.text,
                argType: arg?.type,
                argText: arg?.text
              });

              const val = this.evaluateExpression(arg, true);
              // Only update if evaluation succeeded (evaluateExpression returns 'undefined' string on failure)
              if (val !== 'undefined' && val !== undefined) {
                initialValue = val;
              } else {
                console.warn('⚠️ Argument evaluation returned undefined:', val);
              }
            }

            // Check if it's a struct (like Node)
            // This is a simple mock - in a real interpreter we'd look up the struct definition
            if (allocType === 'Node') {
              initialValue = { data: 0, next: 'nullptr' };
              // If args provided: new Node(10) - assuming constructor sets data
              if (argsNode && argsNode.namedChildCount > 0) {
                const val = this.evaluateExpression(argsNode.namedChild(0), true);
                initialValue.data = val;
              }
            }

            // Step 1: Allocate on Heap
            this.executionSteps.push({
              type: 'ALLOCATE_HEAP',
              line: node.startPosition.row + 1,
              data: {
                address: heapAddress,
                value: initialValue,
                type: allocType
              }
            });

            // Step 2: Assign heap address to pointer variable
            varValue = heapAddress;
            console.log('✨ New Allocation:', { varName, heapAddress, initialValue });

          }
          // Check if pointing to array element: &arr[2]
          else if (value.type === 'pointer_expression') {
            const targetExpr = value.namedChild(0);
            console.log('🔍 Target expression:', {
              type: targetExpr?.type,
              text: targetExpr?.text
            });

            if (targetExpr && targetExpr.type === 'subscript_expression') {
              // Pointing to array element: int* ptr = &arr[2];
              // subscript_expression has children: argument[index]
              // Try field names first, then fall back to child indices
              let arrayName = targetExpr.childForFieldName('argument')?.text;
              let indexNode = targetExpr.childForFieldName('index');

              // Fallback: first named child is array name, second is index
              if (!arrayName && targetExpr.namedChildCount >= 1) {
                arrayName = targetExpr.namedChild(0)?.text;
              }
              if (!indexNode && targetExpr.namedChildCount >= 2) {
                indexNode = targetExpr.namedChild(1);
              }

              // Parse index directly from the subscript expression text: arr[2] -> extract 2
              let index = 0;
              const subscriptText = targetExpr.text; // e.g., "arr[2]"
              const bracketMatch = subscriptText.match(/\[(\d+)\]/);
              if (bracketMatch) {
                index = parseInt(bracketMatch[1], 10);
              } else if (indexNode) {
                if (indexNode.type === 'number_literal') {
                  index = parseInt(indexNode.text, 10);
                } else {
                  index = parseInt(indexNode.text, 10) || this.evaluateExpression(indexNode, true);
                }
              }

              console.log('🎯 Subscript parsing:', {
                fullText: subscriptText,
                arrayName,
                extractedIndex: index,
                indexNodeType: indexNode?.type,
                indexNodeText: indexNode?.text
              });

              if (arrayName) {
                varValue = `${arrayName}[${index}]`;
              }
            } else if (targetExpr && targetExpr.type === 'identifier') {
              // Pointer to variable: int** handle = &pArr;
              // Store reference to the variable name, not the address
              const targetVarName = targetExpr.text;
              varValue = `&${targetVarName}`; // Store as reference to variable
              console.log('🎯 Pointer to variable:', targetVarName);
            }
          } else if (value.type === 'pointer_expression' && value.text.startsWith('&')) {
            // Handle &variable (duplicate check, shouldn't reach here)
            const targetIdent = value.namedChild(0);
            if (targetIdent && targetIdent.type === 'identifier') {
              const targetVarName = targetIdent.text;
              varValue = `&${targetVarName}`; // Store as reference to variable
            }
          } else if (value.type === 'identifier') {
            // Array name assigned to pointer: int* pArr = arr;
            // Array decays to pointer to first element
            const arrayName = value.text;
            varValue = `${arrayName}[0]`;
            console.log('🎯 Array decay to pointer:', arrayName);
          }

          // Store the address for this pointer variable
          this.variableAddresses.set(varName, address);

          this.executionSteps.push({
            type: 'SET_VARIABLE',
            line: node.startPosition.row + 1,
            data: {
              name: varName,
              value: varValue,
              type: varType,
              address: address
            }
          });
        } else {
          // Regular variable OR declaration initialized with function call
          // int index = binarySearch(arr, n, key);

          if (value && value.type === 'call_expression') {
            // 1. Declare variable (undefined initially)
            this.variableAddresses.set(varName, address);
            this.executionSteps.push({
              type: 'SET_VARIABLE',
              line: node.startPosition.row + 1,
              data: {
                name: varName,
                value: '?',
                type: varType,
                address: address
              }
            });

            // 2. Execute function call
            // We need to capture the return value. 
            // In our static unrolling, analyzeFunctionCall handles the "CALL", "BODY", "RETURN".
            // We need to simulate the assignment of the return value.
            // We can emit a special step `ASSIGN_RETURN_VALUE` after the call?

            this.analyzeFunctionCall(value, varName); // Pass targetVarName to assign result to
          } else {
            // Regular variable
            this.variableAddresses.set(varName, address);

            this.executionSteps.push({
              type: 'SET_VARIABLE',
              line: node.startPosition.row + 1,
              data: {
                name: varName,
                value: varValue,
                type: varType,
                address: address
              }
            });

            // Track variable value during analysis phase for loop condition evaluation
            if (typeof varValue === 'number') {
              this.analysisVariables.set(varName, varValue);
            }
          }
        }
      }
    }
  }

  /**
   * Analyze function call and unroll steps
   * @param {object} node - call_expression node
   * @param {string} targetVarName - Optional variable to assign return value to
   */
  analyzeFunctionCall(node, targetVarName = null) {
    const functionNameNode = node.childForFieldName('function');
    const functionName = functionNameNode ? functionNameNode.text : 'unknown';
    const argsNode = node.childForFieldName('arguments'); // argument_list

    console.log(`Analyzing Call: ${functionName}`);

    // Check recursion limit
    if (this.callDepth > 20) {
      console.warn('⚠️ Max recursion depth reached');
      return;
    }

    const funcDef = this.functionMap.get(functionName);
    if (!funcDef) {
      console.warn(`Function definition not found: ${functionName}`);
      return;
    }

    // Evaluate arguments to pass values
    const args = [];
    if (argsNode) {
      for (let i = 0; i < argsNode.namedChildCount; i++) {
        const arg = argsNode.namedChild(i);
        // We want the analysis-time value if possible
        const val = this.evaluateExpression(arg, true);
        args.push({
          value: val,
          text: arg.text
        });
      }
    }

    // Enter Function Step
    this.executionSteps.push({
      type: 'CALL',
      line: node.startPosition.row + 1,
      data: {
        name: functionName,
        args: args,
        targetVar: targetVarName
      }
    });

    this.callDepth++;

    // Process Function Parameter Mapping
    // mapped to argument values
    const declarator = funcDef.childForFieldName('declarator'); // function_declarator
    const parameters = declarator.childForFieldName('parameters'); // parameter_list

    if (parameters) {
      for (let i = 0; i < parameters.namedChildCount; i++) {
        if (i >= args.length) break;
        const param = parameters.namedChild(i); // parameter_declaration
        const paramType = param.childForFieldName('type')?.text || 'int';
        const paramDecl = param.childForFieldName('declarator'); // identifier or reference

        // Fix: Use getVariableName to handle array declarators (arr[]) correctly
        let paramName = `p${i}`;
        if (paramDecl) {
          paramName = this.getVariableName(paramDecl);
        }
        const argVal = args[i].value;

        // Emit step to initialize parameter in new frame
        this.executionSteps.push({
          type: 'PARAM_INIT',
          line: funcDef.startPosition.row + 1, // Start of function
          data: {
            name: paramName,
            value: argVal,
            type: paramType
          }
        });

        // Track param for analysis so loops inside function work
        if (typeof argVal === 'number' || Array.isArray(argVal)) {
          // Note: This overwrites global analysis map for now (shadowing issue).
          // For static unrolling to work perfectly with recursion analysis, we'd need a stack for analysisVariables too.
          // For now, simpler: just set it.
          this.analysisVariables.set(paramName, argVal);
        }
      }
    }

    // Body
    const body = funcDef.childForFieldName('body');
    if (body) {
      this.analyzeFunctionBody(body);
    }

    this.callDepth--;

    // Exit step
    this.executionSteps.push({
      type: 'RETURN_FROM_CALL',
      line: node.endPosition.row + 1,
      data: {
        name: functionName,
        targetVar: targetVarName
      }
    });
  }

  /**
   * Analyze expression statement (like cout, assignments, pointer ops)
   */
  analyzeExpressionStatement(node) {
    const text = node.text;

    // Check if it's a cout statement
    if (text.includes('cout')) {
      const output = this.extractCoutOutput(node);

      this.executionSteps.push({
        type: 'LOG_OUTPUT',
        line: node.startPosition.row + 1,
        data: {
          text: output,
          needsFrameContext: output.includes('{')
        }
      });
      return;
    }

    // Get the expression child
    const expr = node.namedChild(0);
    if (!expr) return;

    // Handle assignment expressions: ptr = &y, pArr = pArr + 2
    if (expr.type === 'assignment_expression') {
      this.analyzeAssignment(expr, node.startPosition.row + 1);
      return;
    }

    // Handle update expressions: pArr++, pArr--
    if (expr.type === 'update_expression') {
      this.analyzeUpdateExpression(expr, node.startPosition.row + 1);
      return;
    }
  }

  /**
   * Analyze assignment expression: ptr = &y, *pArr = 999
   */
  analyzeAssignment(expr, line) {
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');

    if (!left || !right) return;

    console.log('🔄 Assignment:', { left: left.text, right: right.text, leftType: left.type });

    // Case 0: Array element assignment: arr[i] = 10
    if (left.type === 'subscript_expression') {
      const arrayNode = left.childForFieldName('argument');
      let indexExpr = left.childForFieldName('index');

      // Index fallback logic (same as in evaluateExpression)
      if (!indexExpr) indexExpr = left.childForFieldName('subscript');
      if (!indexExpr && left.namedChildCount >= 2) indexExpr = left.namedChild(1);

      // Unwrap nested index [i] -> i logic
      if (indexExpr && (indexExpr.type === 'subscript_argument' || indexExpr.text.startsWith('['))) {
        if (indexExpr.namedChildCount > 0) {
          indexExpr = indexExpr.namedChild(0);
        }
      }

      if (arrayNode && indexExpr) {
        const arrayName = arrayNode.text;
        const indexVal = this.evaluateExpression(indexExpr, true);
        const newValue = this.evaluateExpression(right, true);

        console.log(`🔄 Array Assignment: ${arrayName}[${indexVal}] = ${newValue}`);

        this.executionSteps.push({
          type: 'UPDATE_ARRAY_ELEMENT',
          line: line,
          data: {
            arrayName: arrayName,
            index: indexVal,
            value: newValue
          }
        });

        // Update analysis tracking if possible (simplified)
        // We can't easily update a specific index in analysisVariables if it stores the whole array
        // But we can check if it exists and try to update it?
        // optimizing: skipping full array state update for now to avoid complexity, relying on runtime steps.
        return;
      }
    }

    // Case 1: Pointer dereference assignment: *pArr = 999
    if (left.type === 'pointer_expression' && left.text.startsWith('*')) {
      const ptrName = left.namedChild(0)?.text;
      const newValue = this.evaluateExpression(right, true);

      this.executionSteps.push({
        type: 'DEREF_ASSIGN',
        line: line,
        data: {
          pointerName: ptrName,
          value: newValue
        }
      });
      return;
    }

    // Case 3: Field assignment (node->next = node2)
    if (left.type === 'field_expression') {
      const objectArg = left.childForFieldName('argument');
      const fieldArg = left.childForFieldName('field');

      if (objectArg && fieldArg) {
        const ptrName = objectArg.text;
        const fieldName = fieldArg.text;

        // Evaluate right side (could be number, identifier, new expr?)
        // For node->next = node2, evaluateExpression(node2) -> address
        const rhsValue = this.evaluateExpression(right, true);

        console.log('🔄 Field Assignment:', { ptrName, fieldName, rhsValue });

        this.executionSteps.push({
          type: 'SET_HEAP_FIELD',
          line: line,
          data: {
            pointerName: ptrName,
            field: fieldName,
            value: rhsValue
          }
        });
        return;
      }
    }

    // Case 2: Regular pointer reassignment: ptr = &y, ptr = arr, pArr = pArr + 2
    if (left.type === 'identifier') {
      const varName = left.text;
      let newValue = null;

      // &variable - pointer to variable
      if (right.type === 'pointer_expression' && right.text.startsWith('&')) {
        const targetExpr = right.namedChild(0);

        if (targetExpr?.type === 'subscript_expression') {
          // &arr[2]
          const subscriptText = targetExpr.text;
          const bracketMatch = subscriptText.match(/^(\w+)\[(\d+)\]$/);
          if (bracketMatch) {
            newValue = `${bracketMatch[1]}[${bracketMatch[2]}]`;
          }
        } else if (targetExpr?.type === 'identifier') {
          // &y
          newValue = `&${targetExpr.text}`;
        }
      }
      // literal assignment: result = 10
      else if (right.type === 'number_literal') {
        newValue = parseInt(right.text);

        // Update analysis tracking
        if (this.analysisVariables.has(varName)) {
          this.analysisVariables.set(varName, newValue);
        }
      }
      // array name - decays to pointer to first element
      else if (right.type === 'identifier') {
        // Check if it's an array by tracking (simplified - assume array if assigning to pointer)
        newValue = `${right.text}[0]`;
      }
      // binary expression: x = x + 5 or ptr = p + 1
      else if (right.type === 'binary_expression') {
        // Check if we are tracking this as a simple integer variable
        if (this.analysisVariables.has(varName)) {
          const leftOperand = right.childForFieldName('left');
          const rightOperand = right.childForFieldName('right');
          const op = right.children.find(c => ['+', '-', '*', '/'].includes(c.text))?.text;

          if (leftOperand && rightOperand && op) {
            const currentVal = this.evaluateExpression(leftOperand, true); // Get current analysis value
            const delta = this.evaluateExpression(rightOperand, true);

            if (typeof currentVal === 'number' && typeof delta === 'number') {
              switch (op) {
                case '+': newValue = currentVal + delta; break;
                case '-': newValue = currentVal - delta; break;
                case '*': newValue = currentVal * delta; break;
                case '/': newValue = Math.floor(currentVal / delta); break;
              }

              // Update analysis state
              this.analysisVariables.set(varName, newValue);
              console.log(`📝 Arithmetic Update: ${varName} = ${newValue}`);
            } else {
              // Fallback if we can't evaluate numbers types
              newValue = this.evaluatePointerArithmetic(right);
            }
          }
        } else {
          // Not tracked as integer, assume pointer arithmetic
          newValue = this.evaluatePointerArithmetic(right);
        }
      }

      if (newValue !== null) {
        this.executionSteps.push({
          type: 'UPDATE_VARIABLE',
          line: line,
          data: {
            name: varName,
            value: newValue
          }
        });
      }
    }
  }

  /**
   * Analyze update expression: pArr++, pArr--
   */
  analyzeUpdateExpression(expr, line) {
    const operand = expr.namedChild(0);
    const operator = expr.text.includes('++') ? 1 : -1;

    if (operand?.type === 'identifier') {
      const varName = operand.text;

      this.executionSteps.push({
        type: 'POINTER_INCREMENT',
        line: line,
        data: {
          name: varName,
          delta: operator
        }
      });

      // Update analysis-time tracking for loop condition evaluation
      if (this.analysisVariables.has(varName)) {
        const currentValue = this.analysisVariables.get(varName);
        if (typeof currentValue === 'number') {
          this.analysisVariables.set(varName, currentValue + operator);
        }
      }
    }
  }

  /**
   * Evaluate pointer arithmetic expression: pArr + 2, ptr - 1
   */
  evaluatePointerArithmetic(expr) {
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');
    const operator = expr.children.find(c => c.type === '+' || c.type === '-' || c.text === '+' || c.text === '-');

    if (left?.type === 'identifier' && right?.type === 'number_literal') {
      const ptrName = left.text;
      const offset = parseInt(right.text);
      const op = operator?.text || '+';

      // Return a special marker that will be resolved at runtime
      return `__PTR_ARITH__${ptrName}__${op}__${offset}`;
    }

    return null;
  }

  /**
   * Analyze return statement
   */
  analyzeReturnStatement(node) {
    let returnValue = null;
    if (node.namedChildCount > 0) {
      const expr = node.namedChild(0);
      returnValue = this.evaluateExpression(expr, true);
    }

    this.executionSteps.push({
      type: 'RETURN',
      line: node.startPosition.row + 1,
      data: { value: returnValue }
    });
  }

  /**
   * Analyze if statement (handles if, if-else, nested if)
   */
  analyzeIfStatement(node) {
    const condition = node.childForFieldName('condition');
    const consequence = node.childForFieldName('consequence');
    const alternative = node.childForFieldName('alternative');

    // Evaluate condition statically to guide state tracking
    const conditionResult = this.evaluateCondition(condition);
    console.log(`🧠 IF Check: "${condition?.text}" -> ${conditionResult}`);
    // Snapshot state before branches
    const preBranchState = new Map(this.analysisVariables);

    // Store both branches, but mark them - execution will decide which to run
    const ifStatementIndex = this.executionSteps.length;
    this.executionSteps.push({
      type: 'IF_STATEMENT',
      line: node.startPosition.row + 1,
      data: {
        condition: condition?.text || '',
        hasTrueBranch: !!consequence,
        hasFalseBranch: !!alternative
      }
    });

    // Analyze true branch (mark steps as conditional)
    if (consequence) {
      const trueBranchStart = this.executionSteps.length;
      this.analyzeCompoundOrStatement(consequence);
      const trueBranchEnd = this.executionSteps.length;

      // Mark all steps in true branch (push to array so nested ifs don't overwrite)
      for (let i = trueBranchStart; i < trueBranchEnd; i++) {
        if (!this.executionSteps[i].conditionalBranches) {
          this.executionSteps[i].conditionalBranches = [];
        }
        this.executionSteps[i].conditionalBranches.push({
          branch: 'if-true',
          parent: ifStatementIndex
        });
      }
    }

    // Capture state after true branch
    const postTrueState = new Map(this.analysisVariables);

    // If condition is FALSE, the true branch effects should not persist
    // Revert to pre-branch state before analyzing false branch
    if (conditionResult === false) {
      this.analysisVariables = new Map(preBranchState);
    }

    // Analyze false branch (mark steps as conditional)
    if (alternative) {
      const falseBranchStart = this.executionSteps.length;
      this.analyzeCompoundOrStatement(alternative);
      const falseBranchEnd = this.executionSteps.length;

      // Mark all steps in false branch (push to array so nested ifs don't overwrite)
      for (let i = falseBranchStart; i < falseBranchEnd; i++) {
        if (!this.executionSteps[i].conditionalBranches) {
          this.executionSteps[i].conditionalBranches = [];
        }
        this.executionSteps[i].conditionalBranches.push({
          branch: 'if-false',
          parent: ifStatementIndex
        });
      }
    }

    // If condition is TRUE, the false branch effects should not persist
    // We should restore the state to what it was after the true branch
    if (conditionResult === true) {
      this.analysisVariables = postTrueState;
    }
  }

  /**
   * Analyze switch statement
   * Like if/else, we generate ALL case steps but mark them with conditionalBranches
   * so the runtime executor can skip the non-matching ones.
   */
  analyzeSwitchStatement(node) {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

    // Get the variable name being switched on
    const switchVarName = condition?.namedChild(0)?.text || '';

    const switchStepIndex = this.executionSteps.length;
    this.executionSteps.push({
      type: 'SWITCH_STATEMENT',
      line: node.startPosition.row + 1,
      data: {
        variable: switchVarName
      }
    });

    if (body) {
      // Collect all cases with their values
      const cases = [];
      let defaultCaseNode = null;

      for (let i = 0; i < body.namedChildCount; i++) {
        const caseNode = body.namedChild(i);
        if (caseNode.type === 'case_statement') {
          const valueNode = caseNode.childForFieldName('value');
          const caseValue = valueNode ? valueNode.text : null;
          cases.push({ node: caseNode, value: caseValue });
        } else if (caseNode.type === 'default_statement') {
          defaultCaseNode = caseNode;
        }
      }

      // Generate steps for each case, marking them with the case value
      for (const caseInfo of cases) {
        const branchStart = this.executionSteps.length;

        this.executionSteps.push({
          type: 'ENTER_CASE',
          line: caseInfo.node.startPosition.row + 1,
          data: { value: caseInfo.value }
        });

        // Analyze all statements in this case (skip the value literal and break)
        for (let j = 0; j < caseInfo.node.namedChildCount; j++) {
          const stmt = caseInfo.node.namedChild(j);
          if (stmt.type !== 'number_literal' && stmt.type !== 'identifier') {
            // Skip break_statement - it's just case termination
            if (stmt.type === 'break_statement') continue;
            this.analyzeStatement(stmt);
          }
        }

        const branchEnd = this.executionSteps.length;

        // Mark all steps with the case value so they can be skipped at runtime
        for (let k = branchStart; k < branchEnd; k++) {
          if (!this.executionSteps[k].conditionalBranches) {
            this.executionSteps[k].conditionalBranches = [];
          }
          this.executionSteps[k].conditionalBranches.push({
            branch: `case-${caseInfo.value}`,
            parent: switchStepIndex
          });
        }
      }

      // Generate steps for default case
      if (defaultCaseNode) {
        const defaultStart = this.executionSteps.length;

        this.executionSteps.push({
          type: 'ENTER_CASE',
          line: defaultCaseNode.startPosition.row + 1,
          data: { value: 'default' }
        });

        for (let j = 0; j < defaultCaseNode.namedChildCount; j++) {
          const stmt = defaultCaseNode.namedChild(j);
          if (stmt.type === 'break_statement') continue;
          this.analyzeStatement(stmt);
        }

        const defaultEnd = this.executionSteps.length;

        for (let k = defaultStart; k < defaultEnd; k++) {
          if (!this.executionSteps[k].conditionalBranches) {
            this.executionSteps[k].conditionalBranches = [];
          }
          this.executionSteps[k].conditionalBranches.push({
            branch: 'case-default',
            parent: switchStepIndex
          });
        }
      }
    }
  }

  /**
   * Analyze while statement
   */
  analyzeWhileStatement(node) {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

    // For visualization, we'll show loop entry and limit iterations
    const MAX_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const conditionResult = this.evaluateCondition(condition);

      this.executionSteps.push({
        type: 'EVALUATE_LOOP_CONDITION',
        line: node.startPosition.row + 1,
        data: {
          condition: condition?.text || '',
          result: conditionResult,
          iteration: iteration
        }
      });

      if (!conditionResult) break;

      this.executionSteps.push({
        type: 'ENTER_LOOP',
        line: node.startPosition.row + 1,
        data: { iteration: iteration }
      });

      if (body) {
        this.analyzeCompoundOrStatement(body);
      }

      this.executionSteps.push({
        type: 'EXIT_LOOP_ITERATION',
        line: body?.endPosition.row + 1 || node.startPosition.row + 1,
        data: { iteration: iteration }
      });
    }
  }

  /**
   * Analyze for statement
   */
  analyzeForStatement(node) {
    const initializer = node.childForFieldName('initializer');
    const condition = node.childForFieldName('condition');
    const update = node.childForFieldName('update');
    const body = node.childForFieldName('body');

    // Initialize
    if (initializer) {
      this.analyzeStatement(initializer);
    }

    const MAX_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Check condition
      const conditionResult = condition ? this.evaluateCondition(condition) : true;

      this.executionSteps.push({
        type: 'EVALUATE_LOOP_CONDITION',
        line: node.startPosition.row + 1,
        data: {
          condition: condition?.text || 'true',
          result: conditionResult,
          iteration: iteration
        }
      });

      if (!conditionResult) break;

      this.executionSteps.push({
        type: 'ENTER_LOOP',
        line: node.startPosition.row + 1,
        data: { iteration: iteration }
      });

      // Execute body
      if (body) {
        this.analyzeCompoundOrStatement(body);
      }

      // Update
      if (update) {
        if (update.type === 'update_expression') {
          this.analyzeUpdateExpression(update, node.startPosition.row + 1);
        } else if (update.type === 'assignment_expression') {
          this.analyzeAssignment(update, node.startPosition.row + 1);
        } else {
          this.analyzeExpressionStatement(update);
        }
      }

      this.executionSteps.push({
        type: 'EXIT_LOOP_ITERATION',
        line: body?.endPosition.row + 1 || node.startPosition.row + 1,
        data: { iteration: iteration }
      });
    }
  }

  /**
   * Analyze compound statement or single statement
   */
  analyzeCompoundOrStatement(node) {
    if (node.type === 'compound_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        this.analyzeStatement(node.namedChild(i));
      }
    } else {
      this.analyzeStatement(node);
    }
  }

  /**
   * Evaluate a condition (comparison, boolean expression)
   */
  evaluateCondition(conditionNode) {
    if (!conditionNode) return false;

    // Extract the actual condition from wrappers
    let condition = conditionNode;

    // Recursively unwrap condition_clause (e.g. "while (x < 5)") and parenthesized_expression (e.g. "(x < 5)")
    while (condition && (condition.type === 'condition_clause' || condition.type === 'parenthesized_expression')) {
      condition = condition.namedChild(0);
    }

    if (!condition) return false;

    // Handle binary expressions (>, <, ==, !=, >=, <=, &&, ||)
    if (condition.type === 'binary_expression') {
      const left = condition.childForFieldName('left');
      const right = condition.childForFieldName('right');
      const operator = condition.children.find(c =>
        ['>', '<', '==', '!=', '>=', '<=', '&&', '||'].includes(c.text)
      );

      if (!operator) return false;

      const leftValue = this.evaluateExpression(left, true);
      const rightValue = this.evaluateExpression(right, true);

      console.log(`🧠 Eval Static: ${leftValue} ${operator.text} ${rightValue}`);
      const lNum = Number(leftValue);
      const rNum = Number(rightValue);
      const useNum = !isNaN(lNum) && !isNaN(rNum);

      switch (operator.text) {
        case '>': return useNum ? lNum > rNum : leftValue > rightValue;
        case '<': return useNum ? lNum < rNum : leftValue < rightValue;
        case '>=': return useNum ? lNum >= rNum : leftValue >= rightValue;
        case '<=': return useNum ? lNum <= rNum : leftValue <= rightValue;
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        case '&&': return leftValue && rightValue;
        case '||': return leftValue || rightValue;
        default: return false;
      }
    }

    // Handle unary expressions (!)
    if (condition.type === 'unary_expression') {
      const operand = condition.namedChild(0);
      const operator = condition.children.find(c => c.text === '!');
      if (operator) {
        return !this.evaluateCondition(operand);
      }
    }

    // Handle identifiers (boolean variables)
    if (condition.type === 'identifier') {
      return Boolean(this.evaluateExpression(condition));
    }

    // Handle literals
    if (condition.type === 'true' || condition.text === 'true') return true;
    if (condition.type === 'false' || condition.text === 'false') return false;
    if (condition.type === 'number_literal') {
      return parseInt(condition.text) !== 0;
    }

    return false;
  }

  /**
   * Evaluate condition from string using current runtime state
   */
  evaluateConditionFromState(conditionString) {
    // Use synchronous runtimeVariables map (not React state) for reliable evaluation
    const variables = this.runtimeVariables;

    if (!variables || variables.size === 0) {
      console.warn('⚠️ evaluateConditionFromState: No runtime variables available');
      return false;
    }

    // Remove parentheses
    conditionString = conditionString.replace(/[()]/g, '').trim();

    // Parse binary comparison: supports arr[i] > key, i != -1, etc.
    // Regex now captures negative numbers and complex terms
    const comparisonMatch = conditionString.match(/([\w\[\]]+)\s*(>=|<=|>|<|==|!=)\s*(-?[\w\[\]]+)/);

    if (comparisonMatch) {
      const leftExpr = comparisonMatch[1];
      const operator = comparisonMatch[2];
      const rightExpr = comparisonMatch[3];

      // Helper to evaluate a term (variable, array access, or literal)
      const evaluateTerm = (term) => {
        // Check for array access: arr[i] or arr[0]
        const arrayMatch = term.match(/^(\w+)\[(\w+)\]$/);
        if (arrayMatch) {
          const arrayName = arrayMatch[1];
          const indexTerm = arrayMatch[2];

          const arrayData = variables.get(arrayName);
          if (!arrayData || !Array.isArray(arrayData.value)) {
            console.warn(`⚠️ Array not found or invalid: ${arrayName}`);
            return undefined;
          }

          let index = parseInt(indexTerm);
          if (isNaN(index)) {
            // Try to look up index variable
            const indexVar = variables.get(indexTerm);
            if (indexVar !== undefined) {
              index = indexVar.value;
            } else {
              return undefined;
            }
          }

          return arrayData.value[index];
        }

        // Simple variable lookup
        const varData = variables.get(term);
        if (varData !== undefined) {
          return varData.value;
        }

        // Number literal
        const num = parseInt(term);
        if (!isNaN(num)) return num;

        return undefined;
      };

      const leftValue = evaluateTerm(leftExpr);
      const rightValue = evaluateTerm(rightExpr);

      if (leftValue === undefined || rightValue === undefined) {
        console.warn(`⚠️ Could not evaluate condition terms: ${leftExpr} ${operator} ${rightExpr}`);
        return false;
      }

      console.log(`🎯 Condition eval: ${leftExpr}(${leftValue}) ${operator} ${rightExpr}(${rightValue})`);

      switch (operator) {
        case '>': return Number(leftValue) > Number(rightValue);
        case '<': return Number(leftValue) < Number(rightValue);
        case '>=': return Number(leftValue) >= Number(rightValue);
        case '<=': return Number(leftValue) <= Number(rightValue);
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        default: return false;
      }
    }

    console.warn('⚠️ Could not parse condition:', conditionString);
    return false;
  }

  /**
   * Get function name from declarator
   */
  getFunctionName(declarator) {
    if (!declarator) return 'unknown';

    if (declarator.type === 'function_declarator') {
      const funcDecl = declarator.childForFieldName('declarator');
      return funcDecl ? funcDecl.text : 'unknown';
    }

    return declarator.text;
  }

  /**
   * Get variable name from declarator
   */
  getVariableName(declarator) {
    if (!declarator) return 'unknown';

    if (declarator.type === 'pointer_declarator') {
      return this.getVariableName(declarator.namedChild(0));
    }

    if (declarator.type === 'array_declarator') {
      return this.getVariableName(declarator.childForFieldName('declarator'));
    }

    if (declarator.type === 'identifier') {
      return declarator.text;
    }

    // Find first identifier in children
    for (let i = 0; i < declarator.childCount; i++) {
      const child = declarator.child(i);
      if (child.type === 'identifier') {
        return child.text;
      }
    }

    return declarator.text;
  }

  /**
   * Get full type including pointer decorations
   */
  getFullType(baseType, declarator) {
    if (!declarator) return baseType;

    console.log('🔍 getFullType:', { baseType, declaratorType: declarator.type, declaratorText: declarator.text });

    if (declarator.type === 'pointer_declarator') {
      // Recursively handle nested pointer declarators (int**, int***, etc.)
      const innerDeclarator = declarator.namedChild(0);
      console.log('🔍 Nested pointer declarator found, recursing with inner:', innerDeclarator?.type);
      return this.getFullType(baseType + '*', innerDeclarator);
    }

    if (declarator.type === 'array_declarator') {
      return baseType; // Handle array separately
    }

    console.log('🔍 Final type:', baseType);
    return baseType;
  }

  /**
   * Evaluate an expression to get its value
   * @param {boolean} useAnalysisState - If true, look up variable values from analysis-time tracking
   */
  evaluateExpression(node, useAnalysisState = false) {
    if (!node) return 'undefined';

    switch (node.type) {
      case 'parenthesized_expression':
        return this.evaluateExpression(node.namedChild(0), useAnalysisState);

      case 'number_literal':
        return parseInt(node.text);

      case 'string_literal':
        return node.text;

      case 'pointer_expression':
        // & operator - return address
        const target = node.namedChild(0);
        if (target && target.type === 'identifier') {
          // Find the address of this variable
          // For now, return placeholder
          return this.generateAddress();
        }
        return '0x0';

      case 'binary_expression':
        const left = this.evaluateExpression(node.childForFieldName('left'), useAnalysisState);
        const right = this.evaluateExpression(node.childForFieldName('right'), useAnalysisState);
        const operator = node.childForFieldName('operator').text;

        if (typeof left === 'number' && typeof right === 'number') {
          switch (operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return Math.floor(left / right); // int division by default
            case '%': return left % right;
            case '==': return left === right ? 1 : 0;
            case '!=': return left !== right ? 1 : 0;
            case '<': return left < right ? 1 : 0;
            case '>': return left > right ? 1 : 0;
            case '<=': return left <= right ? 1 : 0;
            case '>=': return left >= right ? 1 : 0;
          }
        }
        return `${left} ${operator} ${right}`;

      case 'sizeof_expression':
        // Handle sizeof(arr) or sizeof(int)
        // Structure: sizeof_expression -> value (type_descriptor or other expression)
        let operand = node.namedChild(0);

        // Unwrap parentheses: sizeof((arr)) -> sizeof(arr)
        while (operand && operand.type === 'parenthesized_expression') {
          operand = operand.namedChild(0);
        }

        if (!operand) return 4;

        let targetText = operand.text;

        // Check if it is a type or variable
        if (targetText === 'int' || targetText === 'float' || targetText.includes('*')) return 4;
        if (targetText === 'char' || targetText === 'bool') return 1;
        if (targetText === 'double') return 8;

        // Check if expression is subscript expression: sizeof(arr[0])
        if (operand.type === 'subscript_expression') {
          // Assume element size
          return 4;
        }

        // Check variable map
        if (this.arraySizes.has(targetText)) {
          const size = this.arraySizes.get(targetText);
          console.log(`📏 SIZEOF(${targetText}) lookup: ${size}`);
          return size;
        }

        console.log(`⚠️ SIZEOF(${targetText}) lookup failed, defaulting to 4`);
        // Default for known variable types?
        return 4;

      case 'subscript_expression':
        // Handle arr[0] in expression context
        const arrayNode = node.childForFieldName('argument'); // array name
        let indexExpr = node.childForFieldName('index'); // index

        // Fallback if 'index' field is missing (grammar difference)
        if (!indexExpr) {
          indexExpr = node.childForFieldName('subscript');
        }
        if (!indexExpr && node.namedChildCount >= 2) {
          indexExpr = node.namedChild(1); // Standard: arr [ index ]
        }

        // Unwrap if the index node itself is the bracketed part e.g. "[mid]"
        // Some grammars might treat the whole "[...]" as the index node
        if (indexExpr && (indexExpr.type === 'subscript_argument' || indexExpr.text.startsWith('['))) {
          if (indexExpr.namedChildCount > 0) {
            indexExpr = indexExpr.namedChild(0);
          }
        }

        const arrayVal = this.evaluateExpression(arrayNode, true); // Get array (should come from analysisVariables)
        const idxVal = this.evaluateExpression(indexExpr, true); // Get index

        if (Array.isArray(arrayVal) && typeof idxVal === 'number') {
          // console.log(`🎯 Resolved subscript: arr[${idxVal}] = ${arrayVal[idxVal]}`);
          return arrayVal[idxVal];
        } else {
          console.log(`⚠️ Subscript FAIL: arr=${Array.isArray(arrayVal) ? 'Array' : typeof arrayVal}, idx=${idxVal} (${typeof idxVal})`,
            'Node:', node.text, 'IndexNode:', indexExpr ? indexExpr.text : 'NULL');
        }

        return 0; // Fallback value

      case 'identifier':

        // During analysis phase, look up tracked variable values for proper condition evaluation
        // During analysis phase, look up tracked variable values for proper condition evaluation
        if (this.analysisVariables.has(node.text)) {
          return this.analysisVariables.get(node.text);
        }
        return node.text;

      default:
        return node.text;
    }
  }

  /**
   * Extract output from cout statement
   */
  extractCoutOutput(node) {
    const text = node.text;

    // Parse the cout expression to extract all parts
    let output = '';

    // Match string literals
    const parts = [];
    let remaining = text;

    // Extract all << separated parts
    const coutParts = text.split('<<').slice(1); // Skip 'cout' part

    for (const part of coutParts) {
      const trimmed = part.trim().replace(/;$/, '').replace(/endl$/, '');

      // String literal
      const stringMatch = trimmed.match(/^"([^"]*)"/);
      if (stringMatch) {
        output += stringMatch[1];
        continue;
      }

      // Double pointer dereference like **handle
      const doubleDerefMatch = trimmed.match(/^\*\*(\w+)/);
      if (doubleDerefMatch) {
        output += `{**${doubleDerefMatch[1]}}`; // Placeholder to be replaced at runtime
        continue;
      }

      // Single pointer dereference like *ptr
      const derefMatch = trimmed.match(/^\*(\w+)/);
      if (derefMatch) {
        output += `{*${derefMatch[1]}}`; // Placeholder to be replaced at runtime
        continue;
      }

      // Variable reference
      const varMatch = trimmed.match(/^(\w+)/);
      if (varMatch) {
        output += `{${varMatch[1]}}`; // Placeholder to be replaced at runtime
        continue;
      }
    }

    return output || 'Output';
  }

  /**
   * Execute steps with delay for visualization
   */
  async executeSteps(steps, onStep) {
    console.log('🚀 InterpreterService v2.0 - Branch Skipping Active');
    const skipBranches = new Map(); // Maps conditionalParent index to branch to skip

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      console.log(`Step ${i}:`, step.type, step.conditionalBranches ? `(branches: ${JSON.stringify(step.conditionalBranches)})` : '');

      // Check if this step should be skipped based on conditional branches
      if (step.conditionalBranches && step.conditionalBranches.length > 0) {
        const shouldSkipStep = step.conditionalBranches.some(({ branch, parent }) => {
          return skipBranches.get(parent) === branch;
        });

        if (shouldSkipStep) {
          console.log(`  ✗ SKIPPING this step`);
          continue; // Skip this step
        } else {
          console.log(`  ✓ EXECUTING this step`);
        }
      }

      // If this is an IF_STATEMENT, evaluate condition and decide which branch to skip
      if (step.type === 'IF_STATEMENT') {
        const conditionResult = this.evaluateConditionFromState(step.data.condition);
        console.log('🎯 IF condition evaluated:', {
          condition: step.data.condition,
          result: conditionResult,
          willSkip: conditionResult ? 'if-false' : 'if-true'
        });

        // Store which branch to skip
        if (conditionResult) {
          // Condition is true, skip false branch
          skipBranches.set(i, 'if-false');
          console.log(`  → Setting skipBranches[${i}] = 'if-false'`);
        } else {
          // Condition is false, skip true branch
          skipBranches.set(i, 'if-true');
          console.log(`  → Setting skipBranches[${i}] = 'if-true'`);
        }
      }

      // Call the callback for highlighting/tracking
      if (onStep) {
        onStep(i, step);
      }

      // Execute the step
      await this.executeStep(step);

      // Wait before next step
      await this.delay(800);
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(step) {
    switch (step.type) {
      case 'PUSH_FRAME':
        this.vizActions.pushFrame(step.data.name);
        break;

      case 'CALL':
        // Save current variables to stack before pushing new frame
        this.callStack.push(new Map(this.runtimeVariables));
        // We do NOT clear runtimeVariables because we want to pass args? 
        // Actually, cleaner is: logic below handles PARAM_INIT which sets new variables.
        // But we should act as if we entered a new scope.
        // The visualization action `pushFrame` handles the UI stack.
        // We need to manage `runtimeVariables` (the LOGICAL stack).

        this.vizActions.pushFrame(step.data.name);
        // Clear local variables for the new frame, but we need to keep global/heap if we had them?
        // For simplicity, we assume new frame starts empty and params are added via PARAM_INIT.
        this.runtimeVariables = new Map();
        break;

      case 'PARAM_INIT':
        // Initialize parameter in current scope
        this.runtimeVariables.set(step.data.name, {
          value: step.data.value,
          type: step.data.type,
          address: this.generateAddress()
        });

        // Also update UI
        this.vizActions.setVariable(
          step.data.name,
          step.data.value,
          step.data.type,
          this.generateAddress()
        );
        break;

      case 'RETURN_FROM_CALL':
        this.vizActions.popFrame();
        // Restore previous scope variables
        if (this.callStack.length > 0) {
          this.runtimeVariables = this.callStack.pop();
        }

        // Handle Return Value Assignment
        if (step.data.targetVar && this.lastReturnValue !== undefined) {
          const targetVarName = step.data.targetVar;
          const existingVar = this.runtimeVariables.get(targetVarName);

          if (existingVar) {
            // Update runtime variable with return value
            this.runtimeVariables.set(targetVarName, {
              ...existingVar,
              value: this.lastReturnValue
            });

            // Update Visualization
            this.vizActions.setVariable(
              targetVarName,
              this.lastReturnValue,
              existingVar.type,
              existingVar.address
            );

            console.log(`↩️ Assigned return value ${this.lastReturnValue} to ${targetVarName}`);
          }
        }

        this.lastReturnValue = null; // Reset
        this.isReturning = false; // Reset to continue normal execution in caller
        break;

      case 'POP_FRAME':
        this.vizActions.popFrame();
        break;

      case 'SET_VARIABLE':
        // Check if this is a pointer to an existing variable
        let finalValue = step.data.value;
        if (step.data.type.includes('*') && typeof finalValue === 'string' && finalValue.startsWith('0x')) {
          // Try to find the variable this address refers to
          // This is a simplified approach - in reality we'd track addresses properly
        }

        // Track variable synchronously for condition evaluation
        this.runtimeVariables.set(step.data.name, {
          value: finalValue,
          type: step.data.type,
          address: step.data.address
        });

        this.vizActions.setVariable(
          step.data.name,
          finalValue,
          step.data.type,
          step.data.address
        );
        break;

      case 'LOG_OUTPUT':
        // Resolve variable placeholders in output text
        let outputText = step.data.text;

        // Get current frame from visualization state
        if (this.getState && outputText.includes('{')) {
          const currentState = this.getState();
          console.log('🔍 LOG_OUTPUT Debug:', {
            outputText,
            stackLength: currentState.stack.length,
            currentFrame: currentState.stack[currentState.stack.length - 1]
          });

          const currentFrame = currentState.stack.length > 0
            ? currentState.stack[currentState.stack.length - 1]
            : null;

          if (currentFrame && currentFrame.variables) {
            // IMPORTANT: Process in order of specificity (most specific first)

            // 1. Replace {**doublePtrName} with double dereferenced value
            outputText = outputText.replace(/\{\*\*(\w+)\}/g, (match, ptrName) => {
              const ptrData = currentFrame.variables[ptrName];
              console.log('🔍 Double Deref - Looking for:', ptrName);
              console.log('🔍 Double Deref - Found variable:', ptrData);
              console.log('🔍 Double Deref - All variables:', currentFrame.variables);

              if (!ptrData) {
                console.log('❌ Variable not found:', ptrName);
                return match;
              }

              if (!ptrData.type || !ptrData.type.includes('**')) {
                console.log('❌ Variable is not a double pointer:', ptrData.type);
                return match;
              }

              // First level: pointer to pointer points to a variable
              const valueStr = String(ptrData.value);
              console.log('🔍 Double Deref - Value string:', valueStr);

              const varRefMatch = valueStr.match(/^&(\w+)$/);
              if (!varRefMatch) {
                console.log('❌ Value does not match &varName pattern:', valueStr);
                return match;
              }

              const intermediateVarName = varRefMatch[1];
              const intermediateVar = currentFrame.variables[intermediateVarName];
              console.log('🔍 Double Deref - Intermediate var name:', intermediateVarName);
              console.log('🔍 Double Deref - Intermediate var data:', intermediateVar);

              if (!intermediateVar) {
                console.log('❌ Intermediate variable not found:', intermediateVarName);
                return match;
              }

              if (!intermediateVar.type || !intermediateVar.type.includes('*')) {
                console.log('❌ Intermediate variable is not a pointer:', intermediateVar.type);
                return match;
              }

              // Second level: intermediate pointer points to actual variable
              const intermediateValueStr = String(intermediateVar.value);
              console.log('🔍 Double Deref - Intermediate value:', intermediateValueStr);

              // 2. Check Heap
              if (currentState.heap && currentState.heap[intermediateVar.value]) {
                const heapObj = currentState.heap[intermediateVar.value];
                // return value, or if object/struct, maybe format it? 
                // For now, assume primitive or simple value
                return String(heapObj.value);
              }

              // Check if intermediate points to array element
              const arrayMatch = intermediateValueStr.match(/^(.+)\[(\d+)\]$/);
              if (arrayMatch) {
                const arrayName = arrayMatch[1];
                const index = parseInt(arrayMatch[2]);
                const arrayVar = currentFrame.variables[arrayName];
                if (arrayVar && Array.isArray(arrayVar.value) && arrayVar.value[index] !== undefined) {
                  console.log('✅ Double Deref to array SUCCESS! Returning:', arrayVar.value[index]);
                  return String(arrayVar.value[index]);
                }
              }

              console.log('❌ Could not resolve double dereference');
              return match;
            });

            // 2. Replace {*ptrName} with dereferenced value
            outputText = outputText.replace(/\{\*(\w+)\}/g, (match, ptrName) => {
              const ptrData = currentFrame.variables[ptrName];
              console.log('🔍 Replacing {*' + ptrName + '}:', {
                ptrData,
                allVariables: currentFrame.variables,
                lookingForAddress: ptrData?.value
              });

              if (ptrData && ptrData.type && ptrData.type.includes('*')) {
                // Check if pointing to array element: arr[2]
                const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);
                if (arrayMatch) {
                  const arrayName = arrayMatch[1];
                  const index = parseInt(arrayMatch[2]);
                  const arrayVar = currentFrame.variables[arrayName];

                  if (arrayVar && Array.isArray(arrayVar.value) && arrayVar.value[index] !== undefined) {
                    console.log('🔍 Found array element:', arrayVar.value[index]);
                    return String(arrayVar.value[index]);
                  }
                } else {
                  // Check if pointing to variable: &varName
                  const varRefMatch = String(ptrData.value).match(/^&(\w+)$/);
                  if (varRefMatch) {
                    const targetVarName = varRefMatch[1];
                    const targetVar = currentFrame.variables[targetVarName];
                    return targetVar ? String(targetVar.value) : match;
                  }

                  // Find the variable that this pointer points to by address
                  // 1. Check Stack
                  let targetVar = Object.values(currentFrame.variables).find(
                    v => v.address === ptrData.value
                  );

                  if (targetVar) {
                    return String(targetVar.value);
                  }

                  // 2. Check Heap
                  if (currentState.heap && currentState.heap[ptrData.value]) {
                    const heapObj = currentState.heap[ptrData.value];
                    // return value, or if object/struct, maybe format it? 
                    // For now, assume primitive or simple value
                    return String(heapObj.value);
                  }

                  console.log('🔍 Found target variable:', targetVar);
                  return match;
                }
              }
              return match;
            });

            // 3. Replace {varName} with actual value (plain variables)
            outputText = outputText.replace(/\{(\w+)\}/g, (match, varName) => {
              const varData = currentFrame.variables[varName];
              console.log('🔍 Replacing {' + varName + '}:', varData);
              return varData ? String(varData.value) : match;
            });
          }

          console.log('🔍 Final output text:', outputText);
        }

        this.vizActions.logOutput(outputText);
        break;

      case 'UPDATE_VARIABLE':
        // Update pointer value (reassignment)
        {
          const varData = this.runtimeVariables.get(step.data.name);
          if (varData) {
            let newValue = step.data.value;

            // Handle pointer arithmetic marker: __PTR_ARITH__pArr__+__2
            if (typeof newValue === 'string' && newValue.startsWith('__PTR_ARITH__')) {
              const parts = newValue.split('__');
              const ptrName = parts[2];
              const op = parts[3];
              const offset = parseInt(parts[4]);

              const ptrData = this.runtimeVariables.get(ptrName);
              if (ptrData) {
                const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);
                if (arrayMatch) {
                  const arrayName = arrayMatch[1];
                  const currentIndex = parseInt(arrayMatch[2]);
                  const newIndex = op === '+' ? currentIndex + offset : currentIndex - offset;
                  newValue = `${arrayName}[${newIndex}]`;
                }
              }
            }

            // Sync runtime state
            this.runtimeVariables.set(step.data.name, {
              ...varData,
              value: newValue
            });

            this.vizActions.setVariable(
              step.data.name,
              newValue,
              varData.type,
              varData.address
            );
          }
        }
        break;

      case 'UPDATE_VARIABLE':
        {
          const existingVar = this.runtimeVariables.get(step.data.name);
          if (existingVar) {
            // Update runtime state
            this.runtimeVariables.set(step.data.name, {
              ...existingVar,
              value: step.data.value
            });

            // Update visualization
            this.vizActions.setVariable(
              step.data.name,
              step.data.value,
              existingVar.type,
              existingVar.address
            );
          }
        }
        break;

      case 'ALLOCATE_HEAP':
        this.vizActions.allocateHeap(step.data.address, {
          value: step.data.value,
          type: step.data.type
        });
        break;

      case 'POINTER_INCREMENT':
        // Handle pArr++ or pArr-- or i++
        {
          const ptrData = this.runtimeVariables.get(step.data.name);
          if (ptrData) {
            // Check if it's a pointer to an array element: arr[0] -> arr[1]
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);

            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const currentIndex = parseInt(arrayMatch[2]);
              const newIndex = currentIndex + step.data.delta;

              // Handle generic array pointer logic
              const newValue = `${arrayName}[${newIndex}]`;

              // Sync runtime state
              this.runtimeVariables.set(step.data.name, {
                ...ptrData,
                value: newValue
              });

              this.vizActions.setVariable(
                step.data.name,
                newValue,
                ptrData.type,
                ptrData.address
              );
            }
            // Check if it's a regular number (int i = 0; i++)
            else if (typeof ptrData.value === 'number') {
              const newValue = ptrData.value + step.data.delta;

              // Sync runtime state
              this.runtimeVariables.set(step.data.name, {
                ...ptrData,
                value: newValue
              });

              this.vizActions.setVariable(
                step.data.name,
                newValue,
                ptrData.type,
                ptrData.address
              );
            }
          }
        }
        break;

      case 'DEREF_ASSIGN':
        // Handle *pArr = 999 (modify array element through pointer)
        {
          const ptrData = this.runtimeVariables.get(step.data.pointerName);
          if (ptrData) {
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);

            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const index = parseInt(arrayMatch[2]);
              const arrayVar = this.runtimeVariables.get(arrayName);

              if (arrayVar && Array.isArray(arrayVar.value)) {
                // Clone the array and modify it
                const newArray = [...arrayVar.value];
                newArray[index] = step.data.value;

                // Sync runtime state
                this.runtimeVariables.set(arrayName, {
                  ...arrayVar,
                  value: newArray
                });

                this.vizActions.setVariable(
                  arrayName,
                  newArray,
                  arrayVar.type,
                  arrayVar.address
                );
              }
            } else if (String(ptrData.value).startsWith('&')) {
              // Pointer to regular variable: &y
              const targetVarName = String(ptrData.value).substring(1);
              const targetVar = this.runtimeVariables.get(targetVarName);

              if (targetVar) {
                // Sync runtime state
                this.runtimeVariables.set(targetVarName, {
                  ...targetVar,
                  value: step.data.value
                });

                this.vizActions.setVariable(
                  targetVarName,
                  step.data.value,
                  targetVar.type,
                  targetVar.address
                );
              }
            } else if (String(ptrData.value).startsWith('0x')) {
              // Heap address: 0x5F...
              // Call updateHeap action
              if (this.vizActions.updateHeap) {
                this.vizActions.updateHeap(ptrData.value, step.data.value);
              } else {
                console.warn('⚠️ vizActions.updateHeap not implemented');
              }
            }
          }
        }
        break;

      case 'SET_HEAP_FIELD':
        {
          const ptrData = this.runtimeVariables.get(step.data.pointerName);
          let valueToSet = step.data.value;

          // Resolve variable value at runtime if possible
          if (typeof valueToSet === 'string' && this.runtimeVariables.has(valueToSet)) {
            const sourceVar = this.runtimeVariables.get(valueToSet);
            if (sourceVar) {
              valueToSet = sourceVar.value;
            }
          }

          console.log('⚙️ Executing SET_HEAP_FIELD', {
            pointerName: step.data.pointerName,
            field: step.data.field,
            value: step.data.value,
            resolvedValue: valueToSet,
            ptrData
          });

          if (ptrData && ptrData.value) {
            // ptrData.value should be the heap address (0x...)
            // Construct partial update object
            const update = { [step.data.field]: valueToSet };

            if (this.vizActions.updateHeap) {
              this.vizActions.updateHeap(ptrData.value, update);
            }
          } else {
            console.warn('⚠️ Could not resolve pointer for field update:', step.data.pointerName);
          }
        }
        break;

      case 'IF_STATEMENT':
        // Condition evaluation happens in the Editor execution loop
        // This step just marks the if statement for visualization
        break;

      case 'SWITCH_STATEMENT':
        // Switch evaluation happens in the Editor execution loop
        // This step just marks the switch statement for visualization
        break;

      case 'EVALUATE_CONDITION':
      case 'ENTER_BRANCH':
      case 'EXIT_BRANCH':
      case 'EVALUATE_SWITCH':
      case 'ENTER_CASE':
      case 'EVALUATE_LOOP_CONDITION':
      case 'ENTER_LOOP':
      case 'EXIT_LOOP_ITERATION':
        // Control flow steps - just for visualization/tracking
        // No state changes needed, these are for debugging/visualization
        break;

      case 'RETURN':
        // Store return value for the caller
        if (step.data.value !== undefined) {
          this.lastReturnValue = step.data.value;
          console.log(`🔙 RETURN: Captured value ${this.lastReturnValue}`);
        }
        this.isReturning = true;
        break;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Walk the AST and execute immediately (synchronous flow)
   */
  async walkNode(node, depth = 0) {
    if (!node) return;

    // For now, just use the simulation from Editor
    // In a full implementation, this would traverse and execute each node
  }
}

export default InterpreterService;
