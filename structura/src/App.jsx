import React from 'react';
import { BrowserRouter as BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import { VisualizationProvider } from './context/VisualizationContext';
import './index.css';
import { isTauri } from './config';

function App() {
  const inTauri = isTauri();
  const Router = inTauri ? HashRouter : BrowserRouter;

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={inTauri ? <Navigate to="/editor" replace /> : <Home />} />
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
