export const stepExecutorMethods = {
  async executeSteps(steps, onStep) {
    console.log('🚀 InterpreterService v2.0 - Branch Skipping Active');
    const skipBranches = new Map();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      console.log(`Step ${i}:`, step.type, step.conditionalBranches ? `(branches: ${JSON.stringify(step.conditionalBranches)})` : '');

      if (step.conditionalBranches && step.conditionalBranches.length > 0) {
        const shouldSkipStep = step.conditionalBranches.some(({ branch, parent }) => {
          const skipInfo = skipBranches.get(parent);
          if (!skipInfo) return false;
          if (skipInfo instanceof Set) return skipInfo.has(branch);
          return skipInfo === branch;
        });

        if (shouldSkipStep) {
          console.log(`  ✗ SKIPPING this step`);
          continue;
        } else {
          console.log(`  ✓ EXECUTING this step`);
        }
      }

      if (step.type === 'IF_STATEMENT') {
        const conditionResult = this.evaluateConditionFromState(step.data.condition);
        console.log('🎯 IF condition evaluated:', {
          condition: step.data.condition,
          result: conditionResult,
          willSkip: conditionResult ? 'if-false' : 'if-true'
        });

        if (conditionResult) {
          skipBranches.set(i, 'if-false');
          console.log(`  → Setting skipBranches[${i}] = 'if-false'`);
        } else {
          skipBranches.set(i, 'if-true');
          console.log(`  → Setting skipBranches[${i}] = 'if-true'`);
        }
      }

      if (step.type === 'SWITCH_STATEMENT') {
        const switchVarName = step.data.variable;
        const varData = this.runtimeVariables.get(switchVarName);
        const switchValue = varData !== undefined ? String(varData.value) : null;

        const allCaseBranches = new Set();
        for (let j = i + 1; j < steps.length; j++) {
          if (!steps[j].conditionalBranches) continue;
          for (const { branch, parent } of steps[j].conditionalBranches) {
            if (parent === i) allCaseBranches.add(branch);
          }
        }

        const matchingBranch = `case-${switchValue}`;
        const hasMatch = allCaseBranches.has(matchingBranch);
        const skipSet = new Set();
        for (const branch of allCaseBranches) {
          if (branch === matchingBranch) continue;
          if (branch === 'case-default' && !hasMatch) continue;
          skipSet.add(branch);
        }
        skipBranches.set(i, skipSet);
        console.log(`🔀 SWITCH on ${switchVarName}=${switchValue}, skipping:`, [...skipSet]);
      }

      if (onStep) {
        onStep(i, step);
      }

      await this.executeStep(step);
      await this.delay(800);
    }
  },

  async executeStep(step) {
    switch (step.type) {
      case 'PUSH_FRAME':
        this.vizActions.pushFrame(step.data.name);
        break;

      case 'CALL':
        {
          // Evaluate each argument against current runtimeVariables BEFORE clearing them.
          // Static analysis stores args as estimates (e.g. 'pi - 1' as a string).
          // We compute the actual runtime value here so PARAM_INIT can use it.
          const runtimeEvaluatedArgs = (step.data.args || []).map(arg => {
            const raw = this.evaluateRuntimeExpression(String(arg.text || ''));
            const runtimeValue = Array.isArray(raw) ? [...raw] : raw;
            return { ...arg, runtimeValue };
          });
          this.callArgStack.push({ args: runtimeEvaluatedArgs, paramCount: 0, mapping: new Map() });
          this.callStack.push(new Map(this.runtimeVariables));
          this.vizActions.pushFrame(step.data.name);
          this.runtimeVariables = new Map();
        }
        break;

      case 'PARAM_INIT':
        {
          // Prefer the runtime-evaluated arg value (computed in CALL) over the analysis-time
          // baked-in value. The baked-in value for 'pi - 1' is the string 'pi - 1', which
          // causes NaN comparisons in IF_STATEMENT condition evaluation and corrupts recursion.
          let paramValue = step.data.value;
          if (this.callArgStack.length > 0) {
            const frame = this.callArgStack[this.callArgStack.length - 1];
            const callerArg = frame.args[frame.paramCount];
            if (callerArg) {
              const rv = callerArg.runtimeValue;
              if (typeof rv === 'number' || Array.isArray(rv)) {
                paramValue = rv;
              }
            }
          }

          const paramAddr = this.generateAddress();
          this.runtimeVariables.set(step.data.name, {
            value: paramValue,
            type: step.data.type,
            address: paramAddr
          });

          this.vizActions.setVariable(
            step.data.name,
            paramValue,
            step.data.type,
            paramAddr
          );

          // Map callee param name → caller variable name (for array propagation on return)
          if (this.callArgStack.length > 0) {
            const frame = this.callArgStack[this.callArgStack.length - 1];
            const callerArg = frame.args[frame.paramCount];
            if (callerArg) {
              const callerArgText = callerArg.text || String(callerArg);
              if (/^\w+$/.test(callerArgText)) {
                frame.mapping.set(step.data.name, callerArgText);
              }
            }
            frame.paramCount++;
          }
        }
        break;

      case 'RETURN_FROM_CALL':
        {
          // Capture callee's array state before restoring caller frame
          const calleeVars = new Map(this.runtimeVariables);

          this.vizActions.popFrame();
          if (this.callStack.length > 0) {
            this.runtimeVariables = this.callStack.pop();
          }

          // Propagate modified arrays from callee params back to caller variables
          if (this.callArgStack.length > 0) {
            const frame = this.callArgStack.pop();
            for (const [paramName, callerVarName] of frame.mapping) {
              const calleeVar = calleeVars.get(paramName);
              const callerVar = this.runtimeVariables.get(callerVarName);
              if (calleeVar && callerVar && Array.isArray(calleeVar.value) && Array.isArray(callerVar.value)) {
                this.runtimeVariables.set(callerVarName, { ...callerVar, value: calleeVar.value });
                this.vizActions.setVariable(callerVarName, calleeVar.value, callerVar.type, callerVar.address);
                console.log(`📦 Propagated array back: ${paramName} → ${callerVarName}`, calleeVar.value);
              }
            }
          }

          if (step.data.targetVar && this.lastReturnValue !== undefined) {
            const targetVarName = step.data.targetVar;
            const existingVar = this.runtimeVariables.get(targetVarName);

            if (existingVar) {
              this.runtimeVariables.set(targetVarName, {
                ...existingVar,
                value: this.lastReturnValue
              });

              if (!targetVarName.startsWith('__ret_temp_')) {
                this.vizActions.setVariable(
                  targetVarName,
                  this.lastReturnValue,
                  existingVar.type,
                  existingVar.address
                );
              }

              console.log(`↩️ Assigned return value ${this.lastReturnValue} to ${targetVarName}`);
            }
          }

          this.lastReturnValue = null;
          this.isReturning = false;
        }
        break;

      case 'POP_FRAME':
        this.vizActions.popFrame();
        break;

      case 'SET_VARIABLE':
        {
          let finalValue = step.data.value;

          if (step.data.type.includes('*') && typeof finalValue === 'string' && finalValue.startsWith('0x')) {
            // simplified address tracking placeholder
          }

          // Resolve ptr->field reference (e.g. "a->data") from current heap state
          if (typeof finalValue === 'string') {
            const ptrFieldRef = finalValue.match(/^(\w+)->(\w+)$/);
            if (ptrFieldRef && this.getState) {
              const srcPtrData = this.runtimeVariables.get(ptrFieldRef[1]);
              if (srcPtrData) {
                const currentState = this.getState();
                const heapObj = currentState.heap?.[srcPtrData.value];
                if (heapObj?.value && typeof heapObj.value === 'object') {
                  const fieldVal = heapObj.value[ptrFieldRef[2]];
                  if (fieldVal !== undefined) finalValue = fieldVal;
                }
              }
            }
          }

          this.runtimeVariables.set(step.data.name, {
            value: finalValue,
            type: step.data.type,
            address: step.data.address
          });

          if (!step.data.isTemp) {
            this.vizActions.setVariable(
              step.data.name,
              finalValue,
              step.data.type,
              step.data.address
            );
          }
        }
        break;

      case 'LOG_OUTPUT':
        {
          let outputText = step.data.text;

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
              // 1. Replace {**doublePtrName}
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

                const intermediateValueStr = String(intermediateVar.value);
                console.log('🔍 Double Deref - Intermediate value:', intermediateValueStr);

                if (currentState.heap && currentState.heap[intermediateVar.value]) {
                  const heapObj = currentState.heap[intermediateVar.value];
                  return String(heapObj.value);
                }

                const varRef2 = intermediateValueStr.match(/^&(\w+)$/);
                if (varRef2) {
                  const targetVar = currentFrame.variables[varRef2[1]];
                  if (targetVar) {
                    console.log('✅ Double Deref to variable SUCCESS! Returning:', targetVar.value);
                    return String(targetVar.value);
                  }
                }

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

              // 2. Replace {*ptrName}
              outputText = outputText.replace(/\{\*(\w+)\}/g, (match, ptrName) => {
                const ptrData = currentFrame.variables[ptrName];
                console.log('🔍 Replacing {*' + ptrName + '}:', {
                  ptrData,
                  allVariables: currentFrame.variables,
                  lookingForAddress: ptrData?.value
                });

                if (ptrData && ptrData.type && ptrData.type.includes('*')) {
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
                    const varRefMatch = String(ptrData.value).match(/^&(\w+)$/);
                    if (varRefMatch) {
                      const targetVarName = varRefMatch[1];
                      const targetVar = currentFrame.variables[targetVarName];
                      return targetVar ? String(targetVar.value) : match;
                    }

                    let targetVar = Object.values(currentFrame.variables).find(
                      v => v.address === ptrData.value
                    );

                    if (targetVar) {
                      return String(targetVar.value);
                    }

                    if (currentState.heap && currentState.heap[ptrData.value]) {
                      const heapObj = currentState.heap[ptrData.value];
                      return String(heapObj.value);
                    }

                    console.log('🔍 Found target variable:', targetVar);
                    return match;
                  }
                }
                return match;
              });

              // 3. Replace {ptrName->field}
              outputText = outputText.replace(/\{(\w+)->(\w+)\}/g, (match, ptrName, fieldName) => {
                const ptrData = currentFrame.variables[ptrName];
                if (!ptrData) return match;
                const heapObj = currentState.heap?.[ptrData.value];
                if (heapObj && heapObj.value && typeof heapObj.value === 'object') {
                  const fieldVal = heapObj.value[fieldName];
                  if (fieldVal !== undefined) return String(fieldVal);
                }
                return match;
              });

              // 4. Replace {varName[index]}
              outputText = outputText.replace(/\{(\w+)\[(\d+)\]\}/g, (match, varName, indexStr) => {
                const index = parseInt(indexStr);
                const varData = currentFrame.variables[varName];
                if (!varData) return match;
                if (Array.isArray(varData.value)) {
                  if (varData.value[index] !== undefined) return String(varData.value[index]);
                  return index >= varData.value.length ? '<out of bounds>' : match;
                }
                const ptrBaseMatch = String(varData.value).match(/^(.+)\[(\d+)\]$/);
                if (ptrBaseMatch) {
                  const actualIndex = parseInt(ptrBaseMatch[2]) + index;
                  const arrayVar = currentFrame.variables[ptrBaseMatch[1]];
                  if (arrayVar && Array.isArray(arrayVar.value)) {
                    if (arrayVar.value[actualIndex] !== undefined) return String(arrayVar.value[actualIndex]);
                    if (actualIndex >= arrayVar.value.length) return '<out of bounds>';
                  }
                }
                return match;
              });

              // 5. Replace {varName}
              outputText = outputText.replace(/\{(\w+)\}/g, (match, varName) => {
                const varData = currentFrame.variables[varName];
                console.log('🔍 Replacing {' + varName + '}:', varData);
                return varData ? String(varData.value) : match;
              });
            }

            console.log('🔍 Final output text:', outputText);
          }

          // Fallback: resolve remaining placeholders from runtimeVariables
          if (outputText.includes('{')) {
            outputText = outputText.replace(/\{(\w+)->(\w+)\}/g, (match) => match);
            outputText = outputText.replace(/\{(\w+)\[(\d+)\]\}/g, (match, varName, indexStr) => {
              const index = parseInt(indexStr);
              const varData = this.runtimeVariables.get(varName);
              if (!varData) return match;
              if (Array.isArray(varData.value) && varData.value[index] !== undefined) {
                return String(varData.value[index]);
              }
              const ptrBaseMatch = String(varData.value).match(/^(.+)\[(\d+)\]$/);
              if (ptrBaseMatch) {
                const actualIndex = parseInt(ptrBaseMatch[2]) + index;
                const arrayData = this.runtimeVariables.get(ptrBaseMatch[1]);
                if (arrayData && Array.isArray(arrayData.value) && arrayData.value[actualIndex] !== undefined) {
                  return String(arrayData.value[actualIndex]);
                }
              }
              return match;
            });
            outputText = outputText.replace(/\{(\w+)\}/g, (match, varName) => {
              const varData = this.runtimeVariables.get(varName);
              if (varData && varData.value !== undefined && varData.value !== '?') {
                return String(varData.value);
              }
              return match;
            });
          }

          this.vizActions.logOutput(outputText);
        }
        break;

      case 'UPDATE_ARRAY_ELEMENT':
        {
          // Prefer runtime-evaluated index/value over analysis-time estimates.
          // Analysis-time values are wrong for VLA-based helpers like merge()
          // because temp arrays (L[], R[]) evaluate to empty [] at analysis time.
          let runtimeIdx = typeof step.data.index === 'number'
            ? step.data.index : parseInt(step.data.index);
          let runtimeVal = step.data.value;

          if (step.data.indexText !== undefined) {
            const ei = this.evaluateRuntimeExpression(String(step.data.indexText));
            if (typeof ei === 'number') runtimeIdx = ei;
          }
          if (step.data.valueText !== undefined) {
            const ev = this.evaluateRuntimeExpression(String(step.data.valueText));
            if (typeof ev === 'number') runtimeVal = ev;
          }

          // Mutate step.data so the tree canvas sees correct values on next render
          step.data.index = runtimeIdx;
          step.data.value = runtimeVal;

          if (typeof runtimeIdx !== 'number' || isNaN(runtimeIdx) || runtimeIdx < 0) break;

          const arrData = this.runtimeVariables.get(step.data.arrayName);
          const existingArr = arrData ? [...arrData.value] : [];

          // Grow array as needed — this handles VLAs (int L[n1]) which the analyzer
          // initialises to [] because n1 is not a compile-time constant.
          while (existingArr.length <= runtimeIdx) existingArr.push(0);
          existingArr[runtimeIdx] = runtimeVal;

          this.runtimeVariables.set(step.data.arrayName, {
            ...(arrData || { type: 'int[]', address: this.generateAddress() }),
            value: existingArr
          });
          this.vizActions.setVariable(
            step.data.arrayName,
            existingArr,
            arrData?.type ?? 'int[]',
            arrData?.address ?? ''
          );
        }
        break;

      case 'UPDATE_VARIABLE':
        {
          const varData = this.runtimeVariables.get(step.data.name);
          if (varData) {
            let newValue = step.data.value;

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

      case 'ALLOCATE_HEAP':
        this.vizActions.allocateHeap(step.data.address, {
          value: step.data.value,
          type: step.data.type
        });
        break;

      case 'FREE_HEAP': {
        const ptrData = this.runtimeVariables.get(step.data.ptrName);
        const addr = ptrData?.value;
        if (addr && typeof addr === 'string' && addr.startsWith('0x')) {
          this.vizActions.freeHeap(addr);
        }
        break;
      }

      case 'STL_OP': {
        const varData = this.runtimeVariables.get(step.data.name);
        if (!varData || !varData.value?.__stl) break;

        const vec = { ...varData.value, elements: [...varData.value.elements] };

        if (step.data.op === 'push_back') {
          let val = step.data.value;
          if (step.data.valueText) {
            const rv = this.evaluateRuntimeExpression(String(step.data.valueText));
            if (typeof rv === 'number') val = rv;
          }
          if (vec.size >= vec.capacity) {
            vec.capacity = vec.capacity === 0 ? 1 : vec.capacity * 2;
          }
          vec.elements.push(val);
          vec.size++;

        } else if (step.data.op === 'pop_back') {
          if (vec.size > 0) { vec.elements.pop(); vec.size--; }

        } else if (step.data.op === 'clear') {
          vec.elements = [];
          vec.size = 0;
        }

        this.runtimeVariables.set(step.data.name, { ...varData, value: vec });
        this.vizActions.setVariable(step.data.name, vec, varData.type, varData.address);
        break;
      }

      case 'POINTER_INCREMENT':
        {
          const ptrData = this.runtimeVariables.get(step.data.name);
          if (ptrData) {
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);

            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const currentIndex = parseInt(arrayMatch[2]);
              const newIndex = currentIndex + step.data.delta;
              const newValue = `${arrayName}[${newIndex}]`;

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
            } else if (typeof ptrData.value === 'number') {
              const newValue = ptrData.value + step.data.delta;

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
        {
          const ptrData = this.runtimeVariables.get(step.data.pointerName);
          if (ptrData) {
            const arrayMatch = String(ptrData.value).match(/^(.+)\[(\d+)\]$/);

            if (arrayMatch) {
              const arrayName = arrayMatch[1];
              const index = parseInt(arrayMatch[2]);
              const arrayVar = this.runtimeVariables.get(arrayName);

              if (arrayVar && Array.isArray(arrayVar.value)) {
                const newArray = [...arrayVar.value];
                newArray[index] = step.data.value;

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
              const targetVarName = String(ptrData.value).substring(1);
              const targetVar = this.runtimeVariables.get(targetVarName);

              if (targetVar) {
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

          // Resolve plain variable reference
          if (typeof valueToSet === 'string' && this.runtimeVariables.has(valueToSet)) {
            const sourceVar = this.runtimeVariables.get(valueToSet);
            if (sourceVar) {
              valueToSet = sourceVar.value;
            }
          }

          // Resolve ptr->field reference (e.g. "b->data") from current heap state
          if (typeof valueToSet === 'string') {
            const ptrFieldMatch = valueToSet.match(/^(\w+)->(\w+)$/);
            if (ptrFieldMatch) {
              const srcPtrData = this.runtimeVariables.get(ptrFieldMatch[1]);
              if (srcPtrData && this.getState) {
                const currentState = this.getState();
                const heapObj = currentState.heap?.[srcPtrData.value];
                if (heapObj?.value && typeof heapObj.value === 'object') {
                  const fieldVal = heapObj.value[ptrFieldMatch[2]];
                  if (fieldVal !== undefined) valueToSet = fieldVal;
                }
              }
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
        break;

      case 'SWITCH_STATEMENT':
        break;

      case 'EVALUATE_CONDITION':
      case 'ENTER_BRANCH':
      case 'EXIT_BRANCH':
      case 'EVALUATE_SWITCH':
      case 'ENTER_CASE':
      case 'EVALUATE_LOOP_CONDITION':
      case 'ENTER_LOOP':
      case 'EXIT_LOOP_ITERATION':
        break;

      case 'RETURN':
        if (step.data.expression) {
          const resolved = this.evaluateRuntimeExpression(step.data.expression);
          this.lastReturnValue = resolved;

          let displayExpr = step.data.expression;
          displayExpr = displayExpr.replace(/__ret_temp_\d+_\d+/g, (match) => {
            const vd = this.runtimeVariables.get(match);
            return vd ? String(vd.value) : match;
          });
          displayExpr = displayExpr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
            if (match.startsWith('__')) return match;
            const vd = this.runtimeVariables.get(match);
            return vd !== undefined ? String(vd.value) : match;
          });

          this.vizActions.setVariable('__return__', resolved, '__return__', displayExpr);
          console.log(`🔙 RETURN: Runtime-evaluated "${step.data.expression}" = ${resolved} (display: ${displayExpr})`);
        } else if (step.data.value !== undefined) {
          this.lastReturnValue = step.data.value;
          this.vizActions.setVariable('__return__', this.lastReturnValue, '__return__', null);
          console.log(`🔙 RETURN: Captured value ${this.lastReturnValue}`);
        }
        this.isReturning = true;
        break;
    }
  },

  evaluateRuntimeExpression(exprStr) {
    if (!exprStr) return 0;
    exprStr = exprStr.trim();

    const numVal = Number(exprStr);
    if (!isNaN(numVal) && exprStr !== '') return numVal;

    if (/^[\w]+$/.test(exprStr)) {
      const varData = this.runtimeVariables.get(exprStr);
      if (varData !== undefined) {
        return typeof varData.value === 'number' ? varData.value : varData.value;
      }
      return 0;
    }

    // Handle array subscript access: name[expr]
    // Must be checked BEFORE arithmetic splitting to avoid misparse of arr[l + i]
    const subscriptMatch = exprStr.match(/^(\w+)\[(.+)\]$/);
    if (subscriptMatch) {
      const arrName = subscriptMatch[1];
      const idxExpr = subscriptMatch[2].trim();
      const idx = this.evaluateRuntimeExpression(idxExpr);
      if (typeof idx === 'number') {
        const arrVar = this.runtimeVariables.get(arrName);
        if (arrVar && Array.isArray(arrVar.value)) {
          const val = arrVar.value[idx];
          if (val !== undefined) return val;
        }
      }
      return 0;
    }

    if (exprStr.startsWith('(') && exprStr.endsWith(')')) {
      let depth = 0;
      let isWrapped = true;
      for (let i = 0; i < exprStr.length; i++) {
        if (exprStr[i] === '(') depth++;
        if (exprStr[i] === ')') depth--;
        if (depth === 0 && i < exprStr.length - 1) {
          isWrapped = false;
          break;
        }
      }
      if (isWrapped) {
        return this.evaluateRuntimeExpression(exprStr.slice(1, -1));
      }
    }

    const findSplitPoint = (str, ops) => {
      let depth = 0;
      for (let i = str.length - 1; i >= 0; i--) {
        if (str[i] === ')') depth++;
        if (str[i] === '(') depth--;
        if (depth === 0) {
          for (const op of ops) {
            if (str.substring(i, i + op.length) === op) {
              const before = str.substring(0, i).trim();
              if (before.length > 0) {
                return { index: i, op };
              }
            }
          }
        }
      }
      return null;
    };

    let split = findSplitPoint(exprStr, ['+', '-']);
    if (split) {
      const left = this.evaluateRuntimeExpression(exprStr.substring(0, split.index));
      const right = this.evaluateRuntimeExpression(exprStr.substring(split.index + split.op.length));
      if (typeof left === 'number' && typeof right === 'number') {
        return split.op === '+' ? left + right : left - right;
      }
      return `${left} ${split.op} ${right}`;
    }

    split = findSplitPoint(exprStr, ['*', '/', '%']);
    if (split) {
      const left = this.evaluateRuntimeExpression(exprStr.substring(0, split.index));
      const right = this.evaluateRuntimeExpression(exprStr.substring(split.index + split.op.length));
      if (typeof left === 'number' && typeof right === 'number') {
        switch (split.op) {
          case '*': return left * right;
          case '/': return right !== 0 ? Math.floor(left / right) : 0;
          case '%': return right !== 0 ? left % right : 0;
        }
      }
      return `${left} ${split.op} ${right}`;
    }

    console.warn(`⚠️ evaluateRuntimeExpression: Could not evaluate "${exprStr}"`);
    return exprStr;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async walkNode(node, depth = 0) {
    if (!node) return;
    // Placeholder — execution is driven via generateSteps + executeSteps
  },
};
