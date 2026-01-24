import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import { VisualizationProvider } from './context/VisualizationContext';
import './index.css';

function App() {
  return (
    <Router>
      <div className="App">
        {/* Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/editor" 
            element={
              <VisualizationProvider>
                <Editor />
              </VisualizationProvider>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
