# Structura

> **Making the Invisible, Visible.**

![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen)
![License](https://img.shields.io/badge/License-MIT-orange)
![Platform](https://img.shields.io/badge/Platform-Web_%7C_Desktop-blue)
![Stack](https://img.shields.io/badge/Stack-React_%7C_Tauri_%7C_Tree--sitter-purple)

Structura is a C++ memory visualization tool for students learning **Programming Fundamentals**, **Object-Oriented Programming**, and **Data Structures & Algorithms**. Write C++ code in the browser, hit play, and watch what your program actually does inside the computer — one step at a time.

---

## The Problem It Solves

When you learn C++ and write something like:

```cpp
int x = 10;
int* ptr = &x;
*ptr = 99;
```

A textbook tells you "ptr holds the address of x" — but that description is abstract. Most students cannot visualize *where* `x` lives in memory, what `ptr` actually contains (a hexadecimal address), or what happens to `x` when you dereference the pointer.

This gap between reading code and understanding what a computer actually does is responsible for a large portion of early C++ confusion. Structura closes that gap by turning every variable declaration, pointer assignment, heap allocation, and function call into a live, animated visualization you can step through.

---

## How It Works — Plain English

Structura does four things when you click "run":

1. **Parses your code** — It reads your C++ and builds a tree structure representing its grammar. This is the same technique professional compilers use. No server is involved; everything runs in your browser using a WebAssembly build of the tree-sitter parser.

2. **Analyzes the program** — It walks through the parsed tree and generates a flat list of "steps" (e.g., *declare variable x on line 3*, *assign value 10*, *push function call onto stack*). This happens in milliseconds.

3. **Plays back the steps** — Each step is executed against a live memory model. As the interpreter runs, it fires updates to the visualization layer: a stack frame appears, a box gets a value, an arrow is drawn between a pointer and its target.

4. **Lets you control time** — You can play the whole program, pause it, step forward one instruction, or step backward — all while the editor highlights the current line.

Think of it like a flight recorder for your program, but one that also draws the plane.

---

## What You Can Visualize

### Stack & Heap View

The core view. Mirrors exactly what a C++ runtime does:

- **Call Stack** — Every function call pushes a named frame onto the stack. Local variables appear inside their frame. When a function returns, the frame is popped.
- **Heap** — `new` allocates a block on the heap with a real-looking hex address. `delete` removes it. Heap blocks are draggable.
- **Pointer Arrows** — Any `int*`, `Node*`, or double-pointer automatically gets a Bezier curve drawn between it and whatever it points to — a stack variable, an array element, or a heap block.

### Data Structure View

A higher-level view that understands structure. Pass an array to a function and watch it rendered as an indexed row of cells with highlighted comparisons and swap animations during sorting algorithms.

### Recursion Tree

For recursive functions, Structura builds a branching call tree in real time. Each node shows the function arguments for that call (e.g., `mergeSort([12, 11])`). When a helper function like `merge()` or `partition()` runs, a separate side panel shows its own call stack with parameter values and array state — so you can watch both the recursion and the merge step happen together.

---

## Built-in Code Library

The sidebar ships with ready-to-run C++ snippets organized by category:

| Category | Examples |
| --- | --- |
| **Pointers** | Basic pointer, double pointer, pointer to array |
| **Arrays** | Declaration, pointer arithmetic, full test suite |
| **Dynamic Memory** | Heap allocation, struct on heap |
| **Control Flow** | If-else, nested if, switch/case, while, for loop |
| **Data Structures** | Singly linked list, stack (array), queue (array), node swap |
| **Algorithms** | Bubble, insertion, selection, quick, merge sort — linear & binary search — recursive factorial & Fibonacci |

---

## Technical Architecture

This section is for developers who want to understand how the engine works or contribute to it.

### Repo Structure

```text
Structura/
├── structura/          # React + Vite frontend (web app)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Landing page
│   │   │   └── Editor.jsx      # Main editor + playback controller
│   │   ├── components/
│   │   │   ├── MemoryVisualization.jsx   # Tab container for all viz modes
│   │   │   ├── RecursionTreeCanvas.jsx   # Recursion tree + helper ops panel
│   │   │   ├── ArrayCanvas.jsx           # Array element renderer
│   │   │   ├── DataStructureView.jsx     # DS mode container
│   │   │   ├── HeapBlock.jsx             # Draggable heap node
│   │   │   ├── PointerArrow.jsx          # SVG Bezier arrow renderer
│   │   │   ├── ControlPanel.jsx          # Play/pause/step UI
│   │   │   ├── ConsoleOutput.jsx         # cout output display
│   │   │   └── CodeSnippets.jsx          # Sidebar snippet library
│   │   ├── services/
│   │   │   ├── ParserService.js          # web-tree-sitter singleton
│   │   │   └── InterpreterService.js     # Interpreter class (mixin composition)
│   │   │       interpreter/
│   │   │       ├── analyzer.js           # Phase 1: AST → executionSteps[]
│   │   │       ├── stepExecutor.js       # Phase 2: execute one step + runtime eval
│   │   │       ├── expressionEvaluator.js # Compile-time expression evaluation
│   │   │       ├── astHelpers.js         # Tree-sitter node utilities
│   │   │       ├── outputExtractor.js    # cout argument extraction
│   │   │       └── constants.js          # MAX_TOTAL_STEPS, MAX_ANALYSIS_TIME_MS
│   │   └── context/
│   │       └── VisualizationContext.jsx  # useReducer state store
│   └── public/
│       ├── web-tree-sitter.wasm          # Parser runtime (WASM)
│       └── tree-sitter-cpp.wasm          # C++ grammar (WASM)
└── src-tauri/                            # Tauri v2 desktop shell (Rust)
    ├── src/
    │   ├── main.rs
    │   └── lib.rs
    └── tauri.conf.json
```

### The Two-Phase Interpreter

The most important design decision in Structura is the split between **analysis** and **execution**.

**Phase 1 — Static Analysis (`analyzer.js`)**

`InterpreterService.generateSteps(tree)` walks the AST once and produces a flat `executionSteps[]` array. Every variable declaration, assignment, function call, loop iteration, and conditional branch becomes a typed step object:

```js
{ type: 'SET_VARIABLE', line: 4, data: { name: 'x', value: 10, type: 'int', address: '0x7FFE1A00' } }
{ type: 'CALL',         line: 7, data: { name: 'factorial' } }
{ type: 'IF_STATEMENT', line: 9, data: { condition: 'n <= 1' } }
```

Steps that belong to conditional branches are annotated with `conditionalBranches: [{ branch: 'if-true', parent: stepIndex }]`. This lets the runtime skip the wrong branch without re-parsing.

Analysis starts from `main()` and inlines called functions recursively. Arrays declared with variable-length sizes (VLAs like `int L[n1]`) cannot be sized at analysis time, so they are stored as `[]` and grown dynamically at runtime.

**Phase 2 — Runtime Execution (`stepExecutor.js`)**

`Editor.jsx` owns playback. It loops through `executionSteps[]` and calls `executeStep(step)` for each, skipping steps that belong to untaken branches. `executeStep` maintains `runtimeVariables` (a `Map<name, {value, type, address}>`) and fires `vizActions` (the context dispatch) to update the UI.

For `UPDATE_ARRAY_ELEMENT` steps, the analyzer stores the original C++ expression text (e.g., `"l + i"`, `"arr[l + i]"`) alongside the analysis-time value. At runtime, `evaluateRuntimeExpression()` re-evaluates these against `runtimeVariables`, resolving VLA writes and complex index expressions correctly. The step's data is mutated in-place so downstream consumers (like the recursion tree canvas) read correct values on the next render.

**Control flow decisions** (evaluating `if` conditions and `switch` matches) happen in `Editor.jsx`, not inside the interpreter — this is intentional. The interpreter only knows how to execute a step; the editor knows whether to execute it.

### State Management

`VisualizationContext.jsx` holds the display state using `useReducer`:

```js
{
  stack:  [{ id, name, variables: { x: { value, type, address } } }],
  heap:   { '0x7FFE1A10': { value: 42, type: 'int*' } },
  output: ['Sorted array: 5 6 7 11 12 13'],
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'IDLE' | 'ERROR'
}
```

`SET_VARIABLE` always targets the top-most stack frame. `stateRef` (a ref kept in sync with state) gives `InterpreterService` synchronous read access during step execution without stale closure issues.

### Parsing

`ParserService.js` is a singleton that lazy-initializes `web-tree-sitter` on first use. The C++ grammar and parser runtime are both served as WASM files from `public/`. The Vite dev server adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers — these are required for `SharedArrayBuffer`, which tree-sitter uses internally.

```js
await Parser.init({
  locateFile: (name) => `/${name}`  // serves from public/
});
const Cpp = await Language.load('/tree-sitter-cpp.wasm');
```

### Desktop App (Tauri v2)

The Tauri shell at the repo root wraps the Vite frontend with a native window. The Rust side is minimal — just `tauri::Builder::default().run(...)`. `tauri.conf.json` points `devUrl` at `http://localhost:5173` and `frontendDist` at `../structura/dist`; `beforeDevCommand`/`beforeBuildCommand` start and build Vite automatically.

The frontend detects Tauri via `window.__TAURI__` (exposed by the Tauri runtime). When running as a desktop app, `App.jsx` switches from `BrowserRouter` to `HashRouter` (required since Tauri uses a custom protocol, not HTTP history routing) and redirects the root path directly to `/editor`, skipping the marketing landing page.

### Safety Limits

To prevent infinite loops from hanging the browser:

- `MAX_TOTAL_STEPS = 1500` — analysis stops generating steps past this limit
- `MAX_ANALYSIS_TIME_MS = 5000` — wall-clock timeout during static analysis

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** (for desktop only) — [rustup.rs](https://rustup.rs)
- The Tauri CLI prerequisites for your OS — [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites)

### Web App

```bash
git clone https://github.com/sajidmehmoodtariq-dev/Structura.git
cd Structura/structura
npm install
npm run dev
```

Open `http://localhost:5173`. The parser initializes on first load (~1 second).

### Desktop App

```bash
# From the repo root
npm install
npm run desktop:dev
```

This starts the Vite dev server and launches the Tauri window. For a production build:

```bash
npm run desktop:build
# Installer lands in src-tauri/target/release/bundle/
```

---

## Roadmap

| Feature | Status |
| --- | --- |
| Stack, Heap, Pointer visualization | **Done** |
| Step-through + play/pause/stop | **Done** |
| if/else, switch/case branch skipping | **Done** |
| for/while loop execution | **Done** |
| Recursive function visualization | **Done** |
| Recursion tree with helper ops panel | **Done** |
| Sorting algorithm visualizations | **Done** |
| Tauri desktop app | **Done** |
| AI Tutor (Gemini API integration) | In progress |
| Cloud save / snippet sharing | Planned |
| Local file save (.cpp) from desktop | Planned |
| Classes, OOP, member access (`->`) | Planned |
| STL containers (vector, map, etc.) | Planned |
| User accounts / MongoDB backend | Planned |

---

## Contributing

This is a portfolio project but PRs are welcome, especially for:

- New code snippet examples
- Additional C++ language features in the interpreter
- Bug reports with minimal reproduction cases

```bash
git checkout -b feature/your-feature
# make changes
git commit -m "feat: describe what you added"
git push origin feature/your-feature
# open a pull request
```

---

## License

MIT — see [LICENSE](LICENSE).
