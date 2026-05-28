export const expressionEvaluatorMethods = {
  evaluatePointerArithmetic(expr) {
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');
    const operator = expr.children.find(c => c.type === '+' || c.type === '-' || c.text === '+' || c.text === '-');

    if (left?.type === 'identifier' && right?.type === 'number_literal') {
      const ptrName = left.text;
      const offset = parseInt(right.text);
      const op = operator?.text || '+';
      return `__PTR_ARITH__${ptrName}__${op}__${offset}`;
    }

    return null;
  },

  evaluateCondition(conditionNode) {
    if (!conditionNode) return false;

    let condition = conditionNode;

    while (condition && (condition.type === 'condition_clause' || condition.type === 'parenthesized_expression')) {
      condition = condition.namedChild(0);
    }

    if (!condition) return false;

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

    if (condition.type === 'unary_expression') {
      const operand = condition.namedChild(0);
      const operator = condition.children.find(c => c.text === '!');
      if (operator) {
        return !this.evaluateCondition(operand);
      }
    }

    if (condition.type === 'identifier') {
      return Boolean(this.evaluateExpression(condition));
    }

    if (condition.type === 'true' || condition.text === 'true') return true;
    if (condition.type === 'false' || condition.text === 'false') return false;
    if (condition.type === 'number_literal') {
      return parseInt(condition.text) !== 0;
    }

    return false;
  },

  evaluateConditionFromState(conditionString) {
    const variables = this.runtimeVariables;

    if (!variables || variables.size === 0) {
      console.warn('⚠️ evaluateConditionFromState: No runtime variables available');
      return false;
    }

    conditionString = conditionString.replace(/[()]/g, '').trim();

    const comparisonMatch = conditionString.match(/([\w\[\]]+)\s*(>=|<=|>|<|==|!=)\s*(-?[\w\[\]]+)/);

    if (comparisonMatch) {
      const leftExpr = comparisonMatch[1];
      const operator = comparisonMatch[2];
      const rightExpr = comparisonMatch[3];

      const evaluateTerm = (term) => {
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
            const indexVar = variables.get(indexTerm);
            if (indexVar !== undefined) {
              index = indexVar.value;
            } else {
              return undefined;
            }
          }

          return arrayData.value[index];
        }

        const varData = variables.get(term);
        if (varData !== undefined) {
          return varData.value;
        }

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
  },

  evaluateExpression(node, useAnalysisState = false) {
    if (!node) return 'undefined';

    switch (node.type) {
      case 'parenthesized_expression':
        return this.evaluateExpression(node.namedChild(0), useAnalysisState);

      case 'number_literal':
        return parseInt(node.text);

      case 'string_literal':
        return node.text;

      case 'pointer_expression': {
        const target = node.namedChild(0);
        if (target && target.type === 'identifier') {
          return this.generateAddress();
        }
        return '0x0';
      }

      case 'binary_expression': {
        const left = this.evaluateExpression(node.childForFieldName('left'), useAnalysisState);
        const right = this.evaluateExpression(node.childForFieldName('right'), useAnalysisState);
        const operator = node.childForFieldName('operator').text;

        if (typeof left === 'number' && typeof right === 'number') {
          switch (operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return Math.floor(left / right);
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
      }

      case 'sizeof_expression': {
        let operand = node.namedChild(0);

        while (operand && operand.type === 'parenthesized_expression') {
          operand = operand.namedChild(0);
        }

        if (!operand) return 4;

        const targetText = operand.text;

        if (targetText === 'int' || targetText === 'float' || targetText.includes('*')) return 4;
        if (targetText === 'char' || targetText === 'bool') return 1;
        if (targetText === 'double') return 8;

        if (operand.type === 'subscript_expression') return 4;

        if (this.arraySizes.has(targetText)) {
          const size = this.arraySizes.get(targetText);
          console.log(`📏 SIZEOF(${targetText}) lookup: ${size}`);
          return size;
        }

        console.log(`⚠️ SIZEOF(${targetText}) lookup failed, defaulting to 4`);
        return 4;
      }

      case 'subscript_expression': {
        const arrayNode = node.childForFieldName('argument');
        let indexExpr = node.childForFieldName('index');

        if (!indexExpr) indexExpr = node.childForFieldName('subscript');
        if (!indexExpr && node.namedChildCount >= 2) indexExpr = node.namedChild(1);

        if (indexExpr && (indexExpr.type === 'subscript_argument' || indexExpr.text.startsWith('['))) {
          if (indexExpr.namedChildCount > 0) {
            indexExpr = indexExpr.namedChild(0);
          }
        }

        const arrayVal = this.evaluateExpression(arrayNode, true);
        const idxVal = this.evaluateExpression(indexExpr, true);

        if (Array.isArray(arrayVal) && typeof idxVal === 'number') {
          return arrayVal[idxVal];
        } else {
          console.log(`⚠️ Subscript FAIL: arr=${Array.isArray(arrayVal) ? 'Array' : typeof arrayVal}, idx=${idxVal} (${typeof idxVal})`,
            'Node:', node.text, 'IndexNode:', indexExpr ? indexExpr.text : 'NULL');
        }

        return 0;
      }

      case 'identifier':
        if (this.analysisVariables.has(node.text)) {
          return this.analysisVariables.get(node.text);
        }
        return node.text;

      case 'field_expression': {
        const argNode = node.childForFieldName('argument');
        const fieldNode = node.childForFieldName('field');
        if (argNode && fieldNode) {
          return `${argNode.text}->${fieldNode.text}`;
        }
        return node.text;
      }

      default:
        return node.text;
    }
  },
};
