class ParserService {
  constructor() {
    this.parser = null;
    this.initialized = false;
    this.Parser = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Dynamically import web-tree-sitter
      const TreeSitterImport = await import('web-tree-sitter');

      // The default export is usually the Parser class in ESM/bundlers
      // Sometimes it might be a named export depending on how vite bundles it
      const Parser = TreeSitterImport.default || TreeSitterImport.Parser || TreeSitterImport;
      const Language = TreeSitterImport.Language || Parser.Language;

      // Initialize tree-sitter with locateFile to tell it where to find tree-sitter.wasm
      await Parser.init({
        locateFile(scriptName) {
          // Files in public folder are served at root
          return `/${scriptName}`;
        }
      });

      this.parser = new Parser();

      // Load the C++ language grammar from public folder
      const Cpp = await Language.load('/tree-sitter-cpp.wasm');
      this.parser.setLanguage(Cpp);

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize parser:', error);
      console.error('Error details:', error.stack);
      throw error;
    }
  }

  /**
   * Parse C++ code and return the AST
   * @param {string} code - The C++ code to parse
   * @returns {object} - The Abstract Syntax Tree
   */
  parseCode(code) {
    if (!this.initialized || !this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    try {
      const tree = this.parser.parse(code);
      return tree;
    } catch (error) {
      console.error('❌ Failed to parse code:', error);
      throw error;
    }
  }

  /**
   * Scan the AST to find all function definitions
   * @param {object} tree - The parsed AST
   * @returns {object} - Map of function names to nodes, and main function node
   */
  extractFunctions(tree) {
    const functions = new Map();
    let mainFunction = null;

    const cursor = tree.walk();
    const visit = (node) => {
      if (node.type === 'function_definition') {
        const declarator = node.childForFieldName('declarator');
        const name = this.getFunctionName(declarator);

        functions.set(name, node);

        if (name === 'main') {
          mainFunction = node;
        }
      }

      // Don't traverse inside function bodies for other function definitions (C++ doesn't support nested functions)
      // But we need to traverse other top-level nodes (namespaces, etc. if we supported them)
      // For this simple parser, just checking top-level children of translation_unit or similar is usually enough
      // But let's be safe and traverse everything except function bodies
    };

    // Simple top-level traversal for now
    const root = tree.rootNode;
    for (let i = 0; i < root.namedChildCount; i++) {
      visit(root.namedChild(i));
    }

    return { functions, mainFunction };
  }

  getFunctionName(declarator) {
    if (!declarator) return 'unknown';
    if (declarator.type === 'function_declarator') {
      const funcDecl = declarator.childForFieldName('declarator');
      return funcDecl ? funcDecl.text : 'unknown';
    }
    return declarator.text;
  }

  /**
   * Get detailed information about a tree node
   * @param {object} node - Tree-sitter node
   * @returns {object} - Node information
   */
  getNodeInfo(node) {
    return {
      type: node.type,
      text: node.text,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      childCount: node.childCount,
      namedChildCount: node.namedChildCount
    };
  }

  /**
   * Walk the tree and print all nodes (useful for debugging)
   * @param {object} tree - The parsed tree
   */
  printTree(tree) {
    const cursor = tree.walk();
    let depth = 0;

    console.log('🔍 Walking the AST:');

    const walk = () => {
      const node = cursor.currentNode;
      const indent = '  '.repeat(depth);

      console.log(`${indent}${node.type} [${node.startPosition.row}:${node.startPosition.column} - ${node.endPosition.row}:${node.endPosition.column}]`);

      if (cursor.gotoFirstChild()) {
        depth++;
        do {
          walk();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
        depth--;
      }
    };

    walk();
  }
}

// Export a singleton instance
const parserService = new ParserService();
export default parserService;
