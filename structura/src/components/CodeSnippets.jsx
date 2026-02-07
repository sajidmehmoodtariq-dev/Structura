import React, { useState } from 'react';

const CodeSnippets = ({ onSelectSnippet, isOpen, onToggle }) => {
  const [expandedCategory, setExpandedCategory] = useState('pointers');

  const snippets = {
    pointers: {
      title: 'Pointers',
      icon: '→',
      items: [
        {
          name: 'Basic Pointer',
          code: `#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = 99;
    
    // Simple pointer
    int* ptr = &x;
    
    // Pointer reassignment
    ptr = &y;
    
    return 0;
}`
        },
        {
          name: 'Double Pointer',
          code: `#include <iostream>
using namespace std;

int main() {
    int x = 42;
    int* ptr = &x;
    int** handle = &ptr;
    
    cout << "Value: " << **handle << endl;
    
    return 0;
}`
        },
        {
          name: 'Pointer to Array',
          code: `#include <iostream>
using namespace std;

int main() {
    int arr[5] = {10, 20, 30, 40, 50};
    int* pArr = &arr[2];
    
    cout << "Value at pArr: " << *pArr << endl;
    
    return 0;
}`
        }
      ]
    },
    arrays: {
      title: 'Arrays',
      icon: '[]',
      items: [
        {
          name: 'Array Declaration',
          code: `#include <iostream>
using namespace std;

int main() {
    int arr[5] = {100, 200, 300, 400, 500};
    
    // Array decay to pointer
    int* pArr = arr;
    
    return 0;
}`
        },
        {
          name: 'Pointer Arithmetic',
          code: `#include <iostream>
using namespace std;

int main() {
    int arr[5] = {100, 200, 300, 400, 500};
    int* pArr = arr;
    
    // Slide through array
    pArr++;           // Points to arr[1]
    pArr = pArr + 2; // Points to arr[3]
    
    // Modify via pointer
    *pArr = 999;
    
    return 0;
}`
        },
        {
          name: 'Full Test Suite',
          code: `#include <iostream>
using namespace std;

int main() {
    // 1. Basic Primitives
    int x = 10;
    int y = 99;

    // 2. Simple Pointer (Stack -> Stack)
    int* ptr = &x;

    // 3. Pointer Reassignment
    ptr = &y;

    // 4. Double Pointer
    int** handle = &ptr;

    // 5. Array Declaration
    int arr[5] = {100, 200, 300, 400, 500};

    // 6. Pointer Arithmetic
    int* pArr = arr;
    pArr++;
    pArr = pArr + 2;

    // 7. Modification via Pointer
    *pArr = 999;

    return 0;
}`
        }
      ]
    },
    controlFlow: {
      title: 'Control Flow',
      icon: '⚡',
      items: [
        {
          name: 'If-Else',
          code: `#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = 20;
    
    if (x > y) {
        cout << "x is greater" << endl;
    } else {
        cout << "y is greater" << endl;
    }
    
    return 0;
}`
        },
        {
          name: 'Nested If',
          code: `#include <iostream>
using namespace std;

int main() {
    int score = 85;
    
    if (score >= 90) {
        cout << "Grade: A" << endl;
    } else {
        if (score >= 80) {
            cout << "Grade: B" << endl;
        } else {
            cout << "Grade: C" << endl;
        }
    }
    
    return 0;
}`
        },
        {
          name: 'Switch Case',
          code: `#include <iostream>
using namespace std;

int main() {
    int choice = 2;
    
    switch (choice) {
        case 1:
            cout << "Option 1" << endl;
            break;
        case 2:
            cout << "Option 2" << endl;
            break;
        case 3:
            cout << "Option 3" << endl;
            break;
        default:
            cout << "Invalid" << endl;
    }
    
    return 0;
}`
        },
        {
          name: 'While Loop',
          code: `#include <iostream>
using namespace std;

int main() {
    int i = 0;
    
    while (i < 5) {
        cout << i << endl;
        i++;
    }
    
    return 0;
}`
        },
        {
          name: 'For Loop',
          code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 0; i < 5; i++) {
        cout << i << endl;
    }
    
    return 0;
}`
        },
        {
          name: 'Control Flow Test Suite',
          code: `#include <iostream>
using namespace std;

int main() {
    // Test 1: If-Else
    int x = 15;
    if (x > 10) {
        x = x + 5;
    } else {
        x = x - 5;
    }
    
    // Test 2: Switch
    int choice = 2;
    int result = 0;
    switch (choice) {
        case 1:
            result = 10;
            break;
        case 2:
            result = 20;
            break;
        default:
            result = 0;
    }
    
    // Test 3: For Loop
    int* arr = new int[3];
    for (int i = 0; i < 3; i++) {
        arr[i] = i * 10;
    }
    
    cout << "Final x: " << x << endl;
    cout << "Result: " << result << endl;
    
    return 0;
}`
        }
      ]
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  return (
    <div className={`bg-[#161b22] border-r border-[#30363d] flex flex-col h-full overflow-hidden transition-all duration-300 relative ${
      isOpen ? 'w-64' : 'w-10'
    }`}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute top-2 left-2 z-10 bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] rounded p-1.5 transition-colors group"
        title={isOpen ? 'Hide Snippets' : 'Show Snippets'}
      >
        <svg
          className={`w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-all ${isOpen ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Header */}
          <div className="bg-[#0d1117] border-b border-[#30363d] px-3 py-2 pt-12">
            <h2 className="text-xs font-bold text-white">Code Snippets</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Click to load</p>
          </div>

          {/* Snippets List */}
          <div className="flex-1 overflow-y-auto">
        {Object.entries(snippets).map(([key, category]) => (
          <div key={key} className="border-b border-[#30363d]">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(key)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#0d1117] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{category.icon}</span>
                <span className="text-xs font-semibold text-white">{category.title}</span>
              </div>
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${
                  expandedCategory === key ? 'rotate-90' : ''
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Snippet Items */}
            {expandedCategory === key && (
              <div className="bg-[#0d1117]">
                {category.items.map((snippet, idx) => (
                  <button
                    key={idx}
                    onClick={() => !snippet.disabled && onSelectSnippet(snippet.code)}
                    disabled={snippet.disabled}
                    className={`w-full px-6 py-2 text-left text-[11px] text-gray-300 hover:bg-[#161b22] hover:text-cyan-400 transition-colors border-l-2 ${
                      snippet.disabled
                        ? 'border-amber-500/[0.5] text-gray-600 cursor-not-allowed hover:bg-[#0d1117] hover:text-gray-600'
                        : 'border-transparent hover:border-cyan-400'
                    }`}
                  >
                    <div className="font-mono">{snippet.name}</div>
                    {snippet.disabled && (
                      <div className="text-[9px] text-amber-500 mt-0.5">Coming Soon</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="bg-[#0d1117] border-t border-[#30363d] px-3 py-2">
        <div className="text-[9px] text-gray-600">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
            <span>Supported Features</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
            <span>Coming Soon</span>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default CodeSnippets;
