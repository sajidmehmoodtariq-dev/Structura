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
    this.variableAddresses.clear();
    
    this.analyzeNode(tree.rootNode);
    
    return this.executionSteps;
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
        this.analyzeExpressionStatement(node);
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
        let varValue = value ? this.evaluateExpression(value) : 'undefined';
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
              values.push(this.evaluateExpression(elem));
            }
            varValue = values;
          } else {
            // Create default array
            varValue = Array(arraySize).fill(0);
          }
          
          // Store array base address
          this.variableAddresses.set(varName, address);
          
          this.executionSteps.push({
            type: 'SET_VARIABLE',
            line: node.startPosition.row + 1,
            data: {
              name: varName,
              value: varValue,
              type: `${type}[${arraySize}]`,
              address: address
            }
          });
        } else if (varType.includes('*') && value) {
          // Handle pointer declaration
          console.log('🔍 Pointer declaration detected:', {
            varName,
            varType,
            valueType: value.type,
            valueText: value.text
          });
          
          // Check if pointing to array element: &arr[2]
          if (value.type === 'pointer_expression') {
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
                  index = parseInt(indexNode.text, 10) || this.evaluateExpression(indexNode);
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
          // Regular variable
          
          // Store the address for this variable
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
        }
      }
    }
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
    
    // Case 1: Pointer dereference assignment: *pArr = 999
    if (left.type === 'pointer_expression' && left.text.startsWith('*')) {
      const ptrName = left.namedChild(0)?.text;
      const newValue = this.evaluateExpression(right);
      
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
      // array name - decays to pointer to first element
      else if (right.type === 'identifier') {
        // Check if it's an array by tracking (simplified - assume array if assigning to pointer)
        newValue = `${right.text}[0]`;
      }
      // pointer arithmetic: pArr + 2
      else if (right.type === 'binary_expression') {
        newValue = this.evaluatePointerArithmetic(right);
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
    this.executionSteps.push({
      type: 'RETURN',
      line: node.startPosition.row + 1,
      data: {}
    });
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
    
    if (declarator.type === 'pointer_declarator') {
      return baseType + '*';
    }
    
    return baseType;
  }

  /**
   * Evaluate an expression to get its value
   */
  evaluateExpression(node) {
    if (!node) return 'undefined';
    
    switch (node.type) {
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
      
      case 'identifier':
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
      
      // Pointer dereference like *ptr
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
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
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
            // Replace {varName} with actual value
            outputText = outputText.replace(/\{(\w+)\}/g, (match, varName) => {
              const varData = currentFrame.variables[varName];
              console.log('🔍 Replacing {' + varName + '}:', varData);
              return varData ? String(varData.value) : match;
            });
            
            // Replace {*ptrName} with dereferenced value
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
                  // Find the variable that this pointer points to
                  const targetVar = Object.values(currentFrame.variables).find(
                    v => v.address === ptrData.value
                  );
                  console.log('🔍 Found target variable:', targetVar);
                  return targetVar ? String(targetVar.value) : match;
                }
              }
              return match;
            });
          }
          
          console.log('🔍 Final output text:', outputText);
        }
        
        this.vizActions.logOutput(outputText);
        break;
      
      case 'UPDATE_VARIABLE':
        // Update pointer value (reassignment)
        if (this.getState) {
          const currentState = this.getState();
          const currentFrame = currentState.stack[currentState.stack.length - 1];
          
          if (currentFrame && currentFrame.variables[step.data.name]) {
            let newValue = step.data.value;
            
            // Handle pointer arithmetic marker: __PTR_ARITH__pArr__+__2
            if (typeof newValue === 'string' && newValue.startsWith('__PTR_ARITH__')) {
              const parts = newValue.split('__');
              const ptrName = parts[2];
              const op = parts[3];
              const offset = parseInt(parts[4]);
              
              const ptrData = currentFrame.variables[ptrName];
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
            
            this.vizActions.setVariable(
              step.data.name,
              newValue,
              currentFrame.variables[step.data.name].type,
              currentFrame.variables[step.data.name].address
            );
          }
        }
        break;
      
      case 'POINTER_INCREMENT':
        // Handle pArr++ or pArr--
        if (this.getState) {
          const currentState = this.getState();
          const currentFrame = currentState.stack[currentState.stack.length - 1];
          
          if (currentFrame && currentFrame.variables[step.data.name]) {
            const ptrData = currentFrame.variables[step.data.name];
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);
            
            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const currentIndex = parseInt(arrayMatch[2]);
              const newIndex = currentIndex + step.data.delta;
              
              this.vizActions.setVariable(
                step.data.name,
                `${arrayName}[${newIndex}]`,
                ptrData.type,
                ptrData.address
              );
            }
          }
        }
        break;
      
      case 'DEREF_ASSIGN':
        // Handle *pArr = 999 (modify array element through pointer)
        if (this.getState) {
          const currentState = this.getState();
          const currentFrame = currentState.stack[currentState.stack.length - 1];
          
          if (currentFrame && currentFrame.variables[step.data.pointerName]) {
            const ptrData = currentFrame.variables[step.data.pointerName];
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);
            
            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const index = parseInt(arrayMatch[2]);
              const arrayVar = currentFrame.variables[arrayName];
              
              if (arrayVar && Array.isArray(arrayVar.value)) {
                // Clone the array and modify it
                const newArray = [...arrayVar.value];
                newArray[index] = step.data.value;
                
                this.vizActions.setVariable(
                  arrayName,
                  newArray,
                  arrayVar.type,
                  arrayVar.address
                );
              }
            } else if (ptrData.value.startsWith('&')) {
              // Pointer to regular variable: &y
              const targetVarName = ptrData.value.substring(1);
              const targetVar = currentFrame.variables[targetVarName];
              
              if (targetVar) {
                this.vizActions.setVariable(
                  targetVarName,
                  step.data.value,
                  targetVar.type,
                  targetVar.address
                );
              }
            }
          }
        }
        break;
      
      case 'RETURN':
        // Just mark the line
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
