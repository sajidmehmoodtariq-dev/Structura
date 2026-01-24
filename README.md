# Structura 🧠

> **Making the Invisible, Visible.**
> A cross-platform visualization engine for C++ memory models, data structures, and algorithms.

![Project Status](https://img.shields.io/badge/Status-Active_Development-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-MERN_%7C_Electron_%7C_Tree--sitter-blue)
![License](https://img.shields.io/badge/License-MIT-orange)

## 📖 Overview

**Structura** is an educational tool designed to bridge the gap between abstract code and concrete understanding. Unlike standard IDEs that only show text, Structura simulates the C++ runtime environment visually. It parses code into an Abstract Syntax Tree (AST) and "mimics" execution to render real-time visualizations of the **Stack**, **Heap**, and **Pointer** connections.

It is designed for students learning **Programming Fundamentals (PF)**, **Object-Oriented Programming (OOP)**, and **Data Structures & Algorithms (DSA)**.

## ✨ Key Features

### 🖥️ The Simulation Engine

* **Client-Side Execution:** Runs C++ logic entirely in the browser using a custom JavaScript interpreter (No server-side compilation required).
* **Memory Visualization:**
  * **Stack:** Visualizes function calls, stack frames, and local variables.
  * **Heap:** Dynamic memory allocation (`new`/`delete`) with draggable nodes.
  * **Pointers:** Real-time Bezier curves connecting pointers to their memory targets.
* **Step-Through Debugging:** Pause, play, and step through code line-by-line to watch memory change state.

### 🤖 AI Tutor (Powered by Gemini)

* **Logic Doctor:** Detects infinite loops and logical flaws without writing code for you.
* **Edge Case Hunter:** Suggests inputs that might break your algorithm.
* **Syntax Explainer:** Translates cryptic compiler errors into plain English.
* *Note: Operates on a "Bring Your Own Key" (BYOK) model for user privacy.*

### 💾 Persistence & Platform

* **Cloud Save:** Save and share snippets via unique URLs (Web Version).
* **Local Save:** Save `.cpp` files directly to disk (Desktop Version).
* **Cross-Platform:** Available as a Web App (SaaS) and a Native Desktop App (Windows/macOS).

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, Monaco Editor (VS Code Engine) |
| **Visualization** | React Flow (Graph rendering), Framer Motion (Animations) |
| **Core Logic** | Web Tree-sitter (Parsing), Custom JS Interpreter |
| **Backend** | Node.js, Express.js (REST API) |
| **Database** | MongoDB (User Profiles & Project Storage) |
| **Desktop** | Electron.js (Native Wrapper) |

---

## 🚀 Functionality Roadmap

### Phase 1: The Core (Syntax & Logic)

* [ ] Integration of Monaco Editor & Tree-sitter Parser.

* [ ] Implementation of Virtual Memory Store (Stack/Heap).
* [ ] "Stepper" logic to execute AST nodes line-by-line.

### Phase 2: Visualization Layer

* [ ] Connect Memory Store to React Flow.

* [ ] Implement Pointer "Arrow" rendering logic.
* [ ] Visualize Recursion (Stack Frames).

### Phase 3: Advanced Concepts

* [ ] Support for Classes, Objects, and Member Access (`->`).

* [ ] "Fake" STL Implementation (Vector, Stack, Queue visualization).
* [ ] Integration of Google Gemini API for logic analysis.

### Phase 4: Platform & Polish

* [ ] MongoDB Backend for User Accounts and Cloud Saves.

* [ ] Electron.js integration for Desktop executable.

---

## 📦 Installation (For Developers)

To run Structura locally:

1. **Clone the repo**

    ```bash
    git clone [https://github.com/yourusername/structura.git](https://github.com/yourusername/structura.git)
    cd structura
    ```

2. **Install Dependencies**

    ```bash
    # Install Client deps
    cd client
    npm install

    # Install Server deps
    cd ../server
    npm install
    ```

3. **Run the Web App**

    ```bash
    cd client
    npm run dev
    ```

4. **Run the Desktop App**

    ```bash
    npm run electron
    ```

---

## 🤝 Contribution

This is a personal portfolio project, but suggestions are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Contact

**[Your Name]** *Full Stack Developer & CS Student* [Your LinkedIn Profile] | [Your Portfolio Link]
