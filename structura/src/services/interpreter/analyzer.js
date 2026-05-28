import { MAX_TOTAL_STEPS, MAX_ANALYSIS_TIME_MS } from './constants.js';

export const analyzerMethods = {
  analyzeNode(node) {
    if (!node) return;

    switch (node.type) {
      case 'translation_unit':
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeNode(node.namedChild(i));
        }
        break;

      case 'function_definition':
        this.analyzeFunctionDefinition(node);
        break;

      default:
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeNode(node.namedChild(i));
        }
    }
  },

  analyzeFunctionDefinition(node) {
    const declarator = node.childForFieldName('declarator');
    const functionName = this.getFunctionName(declarator);
    const body = node.childForFieldName('body');

    if (!body) return;

    this.executionSteps.push({
      type: 'PUSH_FRAME',
      line: node.startPosition.row + 1,
      data: { name: functionName }
    });

    this.analyzeFunctionBody(body);

    this.executionSteps.push({
      type: 'POP_FRAME',
      line: node.endPosition.row + 1,
      data: { name: functionName }
    });
  },

  analyzeFunctionBody(bodyNode) {
    for (let i = 0; i < bodyNode.namedChildCount; i++) {
      if (this.analysisReturned || this.executionSteps.length >= MAX_TOTAL_STEPS) break;
      const child = bodyNode.namedChild(i);
      this.analyzeStatement(child);
    }
  },

  analyzeStatement(node) {
    if (this.executionSteps.length >= MAX_TOTAL_STEPS) return;
    if (performance.now() - this.analysisStartTime > MAX_ANALYSIS_TIME_MS) {
      console.warn('⚠️ Analysis time limit exceeded');
      return;
    }

    switch (node.type) {
      case 'declaration':
        this.analyzeDeclaration(node);
        break;

      case 'expression_statement':
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
        for (let i = 0; i < node.namedChildCount; i++) {
          this.analyzeStatement(node.namedChild(i));
        }
    }
  },

  analyzeDeclaration(node) {
    const typeNode = node.childForFieldName('type');
    const type = typeNode ? typeNode.text : 'unknown';

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);

      if (child.type === 'init_declarator') {
        const declarator = child.childForFieldName('declarator');
        const value = child.childForFieldName('value');

        const varName = this.getVariableName(declarator);
        const varType = this.getFullType(type, declarator);
        let varValue = value ? this.evaluateExpression(value, true) : 'undefined';
        const address = this.generateAddress();

        const isArray = declarator && declarator.type === 'array_declarator';

        if (isArray) {
          const sizeNode = declarator.childForFieldName('size');
          const arraySize = sizeNode ? parseInt(sizeNode.text) : 0;

          if (value && value.type === 'initializer_list') {
            const values = [];
            for (let j = 0; j < value.namedChildCount; j++) {
              const elem = value.namedChild(j);
              values.push(this.evaluateExpression(elem, true));
            }
            varValue = values;
          } else {
            varValue = Array(arraySize).fill(0);
          }

          this.variableAddresses.set(varName, address);

          const finalSize = varValue && Array.isArray(varValue) ? varValue.length : arraySize;
          const elementSize = 4;
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

          this.analysisVariables.set(varName, varValue);
        } else if (varType.includes('*') && value) {
          console.log('🔍 Pointer declaration detected:', {
            varName,
            varType,
            valueType: value.type,
            valueText: value.text
          });

          if (value.type === 'new_expression') {
            const allocTypeNode = value.childForFieldName('type');
            const argsNode = value.childForFieldName('arguments');

            const allocType = allocTypeNode ? allocTypeNode.text : 'unknown';
            let initialValue = 0;

            const heapAddress = `0x5F${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;

            if (argsNode && argsNode.namedChildCount > 0) {
              const arg = argsNode.namedChild(0);
              console.log('🔍 Analyzing new arguments:', {
                argsNodeText: argsNode.text,
                argType: arg?.type,
                argText: arg?.text
              });

              const val = this.evaluateExpression(arg, true);
              if (val !== 'undefined' && val !== undefined) {
                initialValue = val;
              } else {
                console.warn('⚠️ Argument evaluation returned undefined:', val);
              }
            }

            if (allocType === 'Node') {
              initialValue = { data: 0, next: 'nullptr' };
              if (argsNode && argsNode.namedChildCount > 0) {
                const val = this.evaluateExpression(argsNode.namedChild(0), true);
                initialValue.data = val;
              }
            }

            this.executionSteps.push({
              type: 'ALLOCATE_HEAP',
              line: node.startPosition.row + 1,
              data: {
                address: heapAddress,
                value: initialValue,
                type: allocType
              }
            });

            varValue = heapAddress;
            console.log('✨ New Allocation:', { varName, heapAddress, initialValue });

          } else if (value.type === 'pointer_expression') {
            const targetExpr = value.namedChild(0);
            console.log('🔍 Target expression:', {
              type: targetExpr?.type,
              text: targetExpr?.text
            });

            if (targetExpr && targetExpr.type === 'subscript_expression') {
              let arrayName = targetExpr.childForFieldName('argument')?.text;
              let indexNode = targetExpr.childForFieldName('index');

              if (!arrayName && targetExpr.namedChildCount >= 1) {
                arrayName = targetExpr.namedChild(0)?.text;
              }
              if (!indexNode && targetExpr.namedChildCount >= 2) {
                indexNode = targetExpr.namedChild(1);
              }

              let index = 0;
              const subscriptText = targetExpr.text;
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
              const targetVarName = targetExpr.text;
              varValue = `&${targetVarName}`;
              console.log('🎯 Pointer to variable:', targetVarName);
            }
          } else if (value.type === 'pointer_expression' && value.text.startsWith('&')) {
            const targetIdent = value.namedChild(0);
            if (targetIdent && targetIdent.type === 'identifier') {
              const targetVarName = targetIdent.text;
              varValue = `&${targetVarName}`;
            }
          } else if (value.type === 'identifier') {
            const arrayName = value.text;
            varValue = `${arrayName}[0]`;
            console.log('🎯 Array decay to pointer:', arrayName);
          }

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
          if (value && value.type === 'call_expression') {
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

            this.analyzeFunctionCall(value, varName);
          } else {
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

            if (typeof varValue === 'number') {
              this.analysisVariables.set(varName, varValue);
            }
          }
        }
      }
    }
  },

  analyzeFunctionCall(node, targetVarName = null) {
    const functionNameNode = node.childForFieldName('function');
    const functionName = functionNameNode ? functionNameNode.text : 'unknown';
    const argsNode = node.childForFieldName('arguments');

    console.log(`Analyzing Call: ${functionName}`);

    if (this.callDepth > 10) {
      console.warn('⚠️ Max recursion depth reached');
      return;
    }

    if (this.executionSteps.length >= MAX_TOTAL_STEPS ||
        performance.now() - this.analysisStartTime > MAX_ANALYSIS_TIME_MS) {
      console.warn('⚠️ Analysis budget exceeded during function call');
      return;
    }

    const funcDef = this.functionMap.get(functionName);
    if (!funcDef) {
      console.warn(`Function definition not found: ${functionName}`);
      return;
    }

    const args = [];
    if (argsNode) {
      for (let i = 0; i < argsNode.namedChildCount; i++) {
        const arg = argsNode.namedChild(i);
        const val = this.evaluateExpression(arg, true);
        args.push({
          value: val,
          text: arg.text
        });
      }
    }

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

    const savedAnalysisVars = new Map(this.analysisVariables);
    const savedAnalysisReturned = this.analysisReturned;
    this.analysisReturned = false;

    const declarator = funcDef.childForFieldName('declarator');
    const parameters = declarator.childForFieldName('parameters');

    if (parameters) {
      for (let i = 0; i < parameters.namedChildCount; i++) {
        if (i >= args.length) break;
        const param = parameters.namedChild(i);
        const paramType = param.childForFieldName('type')?.text || 'int';
        const paramDecl = param.childForFieldName('declarator');

        let paramName = `p${i}`;
        if (paramDecl) {
          paramName = this.getVariableName(paramDecl);
        }
        const argVal = args[i].value;

        this.executionSteps.push({
          type: 'PARAM_INIT',
          line: funcDef.startPosition.row + 1,
          data: {
            name: paramName,
            value: argVal,
            type: paramType
          }
        });

        if (typeof argVal === 'number' || Array.isArray(argVal)) {
          this.analysisVariables.set(paramName, argVal);
        }
      }
    }

    const body = funcDef.childForFieldName('body');
    if (body) {
      this.analyzeFunctionBody(body);
    }

    this.callDepth--;

    this.analysisVariables = savedAnalysisVars;
    this.analysisReturned = savedAnalysisReturned;

    this.executionSteps.push({
      type: 'RETURN_FROM_CALL',
      line: node.endPosition.row + 1,
      data: {
        name: functionName,
        targetVar: targetVarName
      }
    });
  },

  analyzeExpressionStatement(node) {
    const text = node.text;

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

    const expr = node.namedChild(0);
    if (!expr) return;

    if (expr.type === 'assignment_expression') {
      this.analyzeAssignment(expr, node.startPosition.row + 1);
      return;
    }

    if (expr.type === 'update_expression') {
      this.analyzeUpdateExpression(expr, node.startPosition.row + 1);
      return;
    }
  },

  analyzeAssignment(expr, line) {
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');

    if (!left || !right) return;

    console.log('🔄 Assignment:', { left: left.text, right: right.text, leftType: left.type });

    // Case 0: Array element assignment: arr[i] = 10
    if (left.type === 'subscript_expression') {
      const arrayNode = left.childForFieldName('argument');
      let indexExpr = left.childForFieldName('index');

      if (!indexExpr) indexExpr = left.childForFieldName('subscript');
      if (!indexExpr && left.namedChildCount >= 2) indexExpr = left.namedChild(1);

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
            indexText: indexExpr.text,   // original expression for runtime re-evaluation
            value: newValue,
            valueText: right.text         // original expression for runtime re-evaluation
          }
        });

        if (this.analysisVariables.has(arrayName)) {
          const currentArr = this.analysisVariables.get(arrayName);
          if (Array.isArray(currentArr) && typeof indexVal === 'number') {
            const updatedArr = [...currentArr];
            updatedArr[indexVal] = newValue;
            this.analysisVariables.set(arrayName, updatedArr);
          }
        }
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

    // Case 2: Regular variable/pointer reassignment
    if (left.type === 'identifier') {
      const varName = left.text;
      let newValue = null;

      if (right.type === 'pointer_expression' && right.text.startsWith('&')) {
        const targetExpr = right.namedChild(0);

        if (targetExpr?.type === 'subscript_expression') {
          const subscriptText = targetExpr.text;
          const bracketMatch = subscriptText.match(/^(\w+)\[(\d+)\]$/);
          if (bracketMatch) {
            newValue = `${bracketMatch[1]}[${bracketMatch[2]}]`;
          }
        } else if (targetExpr?.type === 'identifier') {
          newValue = `&${targetExpr.text}`;
        }
      } else if (right.type === 'number_literal') {
        newValue = parseInt(right.text);

        if (this.analysisVariables.has(varName)) {
          this.analysisVariables.set(varName, newValue);
        }
      } else if (right.type === 'identifier') {
        newValue = `${right.text}[0]`;
      } else if (right.type === 'binary_expression') {
        if (this.analysisVariables.has(varName)) {
          const leftOperand = right.childForFieldName('left');
          const rightOperand = right.childForFieldName('right');
          const op = right.children.find(c => ['+', '-', '*', '/'].includes(c.text))?.text;

          if (leftOperand && rightOperand && op) {
            const currentVal = this.evaluateExpression(leftOperand, true);
            const delta = this.evaluateExpression(rightOperand, true);

            if (typeof currentVal === 'number' && typeof delta === 'number') {
              switch (op) {
                case '+': newValue = currentVal + delta; break;
                case '-': newValue = currentVal - delta; break;
                case '*': newValue = currentVal * delta; break;
                case '/': newValue = Math.floor(currentVal / delta); break;
              }

              this.analysisVariables.set(varName, newValue);
              console.log(`📝 Arithmetic Update: ${varName} = ${newValue}`);
            } else {
              newValue = this.evaluatePointerArithmetic(right);
            }
          }
        } else {
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
  },

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

      if (this.analysisVariables.has(varName)) {
        const currentValue = this.analysisVariables.get(varName);
        if (typeof currentValue === 'number') {
          this.analysisVariables.set(varName, currentValue + operator);
        }
      }
    }
  },

  analyzeReturnStatement(node) {
    let returnValue = null;
    let returnExpr = null;

    if (node.namedChildCount > 0) {
      const expr = node.namedChild(0);

      const callNodes = this.findCallExpressions(expr);

      if (callNodes.length > 0) {
        for (let ci = 0; ci < callNodes.length; ci++) {
          const callNode = callNodes[ci];
          const tempVarName = `__ret_temp_${this.callDepth}_${ci}`;

          const tempAddr = this.generateAddress();
          this.executionSteps.push({
            type: 'SET_VARIABLE',
            line: node.startPosition.row + 1,
            data: {
              name: tempVarName,
              value: '?',
              type: 'int',
              address: tempAddr,
              isTemp: true
            }
          });

          this.analyzeFunctionCall(callNode, tempVarName);
        }

        let exprText = expr.text;
        for (let ci = 0; ci < callNodes.length; ci++) {
          const callNode = callNodes[ci];
          const tempVarName = `__ret_temp_${this.callDepth}_${ci}`;
          exprText = exprText.replace(callNode.text, tempVarName);
        }

        returnExpr = exprText;
        returnValue = exprText;
      } else {
        returnValue = this.evaluateExpression(expr, true);
        if (typeof returnValue !== 'number') {
          returnExpr = expr.text;
        }
      }
    }

    this.executionSteps.push({
      type: 'RETURN',
      line: node.startPosition.row + 1,
      data: { value: returnValue, expression: returnExpr }
    });

    if (this.callDepth > 0) {
      this.analysisReturned = true;
    }
  },

  findCallExpressions(node) {
    const results = [];
    const stack = [node];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current.type === 'call_expression') {
        results.push(current);
        continue;
      }
      for (let i = current.namedChildCount - 1; i >= 0; i--) {
        stack.push(current.namedChild(i));
      }
    }
    return results;
  },

  analyzeIfStatement(node) {
    const condition = node.childForFieldName('condition');
    const consequence = node.childForFieldName('consequence');
    const alternative = node.childForFieldName('alternative');

    const conditionResult = this.evaluateCondition(condition);
    console.log(`🧠 IF Check: "${condition?.text}" -> ${conditionResult} (callDepth: ${this.callDepth})`);

    if (this.callDepth > 0 && conditionResult !== null && conditionResult !== undefined) {
      if (conditionResult) {
        if (consequence) this.analyzeCompoundOrStatement(consequence);
      } else {
        if (alternative) this.analyzeCompoundOrStatement(alternative);
      }
      return;
    }

    const preBranchState = new Map(this.analysisVariables);

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

    if (consequence) {
      const trueBranchStart = this.executionSteps.length;
      this.analyzeCompoundOrStatement(consequence);
      const trueBranchEnd = this.executionSteps.length;

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

    const postTrueState = new Map(this.analysisVariables);

    if (conditionResult === false) {
      this.analysisVariables = new Map(preBranchState);
    }

    if (alternative) {
      const falseBranchStart = this.executionSteps.length;
      this.analyzeCompoundOrStatement(alternative);
      const falseBranchEnd = this.executionSteps.length;

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

    if (conditionResult === true) {
      this.analysisVariables = postTrueState;
    }
  },

  analyzeSwitchStatement(node) {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

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

      for (const caseInfo of cases) {
        const branchStart = this.executionSteps.length;

        this.executionSteps.push({
          type: 'ENTER_CASE',
          line: caseInfo.node.startPosition.row + 1,
          data: { value: caseInfo.value }
        });

        for (let j = 0; j < caseInfo.node.namedChildCount; j++) {
          const stmt = caseInfo.node.namedChild(j);
          if (stmt.type !== 'number_literal' && stmt.type !== 'identifier') {
            if (stmt.type === 'break_statement') continue;
            this.analyzeStatement(stmt);
          }
        }

        const branchEnd = this.executionSteps.length;

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
  },

  analyzeWhileStatement(node) {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

    const MAX_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (this.executionSteps.length >= MAX_TOTAL_STEPS ||
          performance.now() - this.analysisStartTime > MAX_ANALYSIS_TIME_MS) break;

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

      // A return inside the loop body exits the loop (and the function)
      if (this.analysisReturned) break;

      this.executionSteps.push({
        type: 'EXIT_LOOP_ITERATION',
        line: body?.endPosition.row + 1 || node.startPosition.row + 1,
        data: { iteration: iteration }
      });
    }
  },

  analyzeForStatement(node) {
    const initializer = node.childForFieldName('initializer');
    const condition = node.childForFieldName('condition');
    const update = node.childForFieldName('update');
    const body = node.childForFieldName('body');

    if (initializer) {
      this.analyzeStatement(initializer);
    }

    const MAX_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (this.executionSteps.length >= MAX_TOTAL_STEPS ||
          performance.now() - this.analysisStartTime > MAX_ANALYSIS_TIME_MS) break;

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

      if (body) {
        this.analyzeCompoundOrStatement(body);
      }

      // A return inside the loop body exits the loop (and the function)
      if (this.analysisReturned) break;

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
  },

  analyzeCompoundOrStatement(node) {
    if (node.type === 'compound_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        if (this.analysisReturned || this.executionSteps.length >= MAX_TOTAL_STEPS) break;
        this.analyzeStatement(node.namedChild(i));
      }
    } else {
      this.analyzeStatement(node);
    }
  },
};
