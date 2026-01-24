import React, { useEffect, useState, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import parserService from '../services/ParserService';

const Editor = () => {
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    int x = 42;
    int* ptr = &x;
    
    cout << "Value: " << *ptr << endl;
    
    return 0;
}`);
  
  const [parserReady, setParserReady] = useState(false);
  const [parseError, setParseError] = useState(null);
  const editorRef = useRef(null);

  const parseCurrentCode = () => {
    if (!parserReady) {
      console.warn('⚠️ Parser not ready yet');
      return;
    }

    try {
      const tree = parserService.parseCode(code);
      
      // Also print a detailed tree walk
      parserService.printTree(tree);
      
      setParseError(null);
    } catch (error) {
      console.error('Parse error:', error);
      setParseError(error.message);
    }
  };

  // Initialize parser on component mount
  useEffect(() => {
    const initParser = async () => {
      try {
        await parserService.initialize();
        setParserReady(true);
        
        // Parse initial code
        if (code) {
          try {
            const tree = parserService.parseCode(code);
            // parserService.printTree(tree);
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
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const handleParseClick = () => {
    parseCurrentCode();
  };

  return (
    <div className="min-h-screen bg-primary-dark text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400">
            C++ Editor & Parser
          </h1>
          <p className="text-gray-400">
            Step 1: Editor & Parser Setup - Write C++ code and see the AST in the console
          </p>
        </div>

        {/* Status Indicator */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${parserReady ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-sm">
              {parserReady ? 'Parser Ready' : 'Initializing Parser...'}
            </span>
          </div>
          
          <button
            onClick={handleParseClick}
            disabled={!parserReady}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              parserReady 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Parse Code
          </button>

          {parseError && (
            <span className="text-red-400 text-sm">Error: {parseError}</span>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            💡 <strong>Instructions:</strong> Edit the C++ code below, click "Parse Code", 
            then open your browser's console (F12) to see the Abstract Syntax Tree (AST).
          </p>
        </div>

        {/* Monaco Editor */}
        <div className="border border-gray-700 rounded-lg overflow-hidden shadow-2xl">
          <MonacoEditor
            height="70vh"
            language="cpp"
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Instructions Box */}
        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 text-indigo-300">
            📋 What to Check in Console:
          </h3>
          <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
            <li>🌳 Abstract Syntax Tree (AST) - The complete tree object</li>
            <li>📊 Root Node - The top-level node of your C++ program</li>
            <li>📝 Root Node String - A string representation of the tree structure</li>
            <li>🔍 Walking the AST - Detailed traversal of all nodes with positions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Editor;
