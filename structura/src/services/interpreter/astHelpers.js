export const astHelperMethods = {
  generateAddress() {
    return `0x${(this.memoryAddressCounter++).toString(16).toUpperCase()}`;
  },

  populateFunctionMap(rootNode) {
    for (let i = 0; i < rootNode.namedChildCount; i++) {
      const node = rootNode.namedChild(i);
      if (node.type === 'function_definition') {
        const declarator = node.childForFieldName('declarator');
        const name = this.getFunctionName(declarator);
        this.functionMap.set(name, node);
      }
    }
  },

  getFunctionName(declarator) {
    if (!declarator) return 'unknown';

    if (declarator.type === 'function_declarator') {
      const funcDecl = declarator.childForFieldName('declarator');
      return funcDecl ? funcDecl.text : 'unknown';
    }

    return declarator.text;
  },

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

    for (let i = 0; i < declarator.childCount; i++) {
      const child = declarator.child(i);
      if (child.type === 'identifier') {
        return child.text;
      }
    }

    return declarator.text;
  },

  getFullType(baseType, declarator) {
    if (!declarator) return baseType;

    console.log('🔍 getFullType:', { baseType, declaratorType: declarator.type, declaratorText: declarator.text });

    if (declarator.type === 'pointer_declarator') {
      const innerDeclarator = declarator.namedChild(0);
      console.log('🔍 Nested pointer declarator found, recursing with inner:', innerDeclarator?.type);
      return this.getFullType(baseType + '*', innerDeclarator);
    }

    if (declarator.type === 'array_declarator') {
      return baseType;
    }

    console.log('🔍 Final type:', baseType);
    return baseType;
  },
};
