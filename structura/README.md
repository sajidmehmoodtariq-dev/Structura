# Structura 🧬

Structura is an interactive, web-based educational tool designed to visualize C++ code execution, memory management, and pointers in real-time. By parsing C++ into an Abstract Syntax Tree (AST) directly in the browser, Structura simulates execution steps to vividly display the Call Stack, dynamic Heap allocations, and pointer references, demystifying low-level programming concepts.

## ✨ Features

- **Interactive Code Editor**: Write C++ code utilizing the integrated, highly-polished Monaco Editor with syntax highlighting and active-line tracking.
- **Browser-Based AST Parsing**: Leverages `web-tree-sitter` (via WebAssembly) to parse C++ code accurately into an AST entirely on the client side.
- **Custom Execution Engine**: A deeply custom JavaScript interpreter that simulates C++ conditionals, loops, scopes, heap allocations (`new`), array decay, and pointer arithmetic without needing a real C++ compiler backend.
- **Visual Memory Layout**: Beautifully renders virtual stack frames and dynamic heap memory blocks in real-time.
- **Dynamic Pointer Tracking**: Automatically calculates connection points between referencing memory cells and target cells to draw dynamic SVG arrows, making pointers easy to understand.
- **Step-Through Debugging**: Step forward, step back, pause, and reset execution to understand the program's flow and memory mutation line-by-line.

## 🛠️ Tech Stack

- **Frontend**: React 19, React Router v7
- **Styling & Animation**: Tailwind CSS v4, Framer Motion
- **Editor**: `@monaco-editor/react`
- **AST Parsing**: `web-tree-sitter` (C++ WA)
- **Build Tool**: Vite

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sajidmehmoodtariq-dev/Structura.git
   cd structura
   ```

2. Install the necessary dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## 🧠 How It Works under the Hood

1. **Input**: The user enters C++ code into the Monaco Editor.
2. **Parsing**: When play is clicked, `web-tree-sitter` parses the raw code into an Abstract Syntax Tree (AST).
3. **Interpreting**: A custom `InterpreterService` (written in JS) walks the AST and unrolls the program flow into a sequential array of "Execution Steps."
4. **Visualizing**: A loop inside the application steps through the execution array, dispatching actions to a custom `VisualizationContext`. This state manager updates the virtual `stack`, `heap`, and simulated `cout` console, automatically triggering UI re-renders to reflect memory visually.

## 🚧 Current Status & Limitations

- **MVP / Educational Sandox**: Structura handles basic C++ constructs efficiently (primitives, pointers, loops, conditionals, basic arrays, and heap allocation). Highly complex STL operations or advanced language features may fail the internal tree walker.
- **AI Tutor Module**: The application currently presents a highly-polished UI for a "Gemini AI Tutor." Please note that in the current version, this feature is structurally mocked for UI demonstration purposes and does not invoke live LLM APIs.

---
*Built to make learning C++ pointers and memory management intuitive and visual.*
