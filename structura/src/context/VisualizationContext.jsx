import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial State
const initialState = {
  stack: [],        // Array of frames: { id, name, variables: {} }
  heap: {},         // Map of address -> value/object
  output: [],       // Array of console output lines
  currentLine: 0,   // Current line number being executed
  status: 'IDLE',   // 'IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR'
  error: null
};

// Action Types
const ACTIONS = {
  RESET: 'RESET',
  PUSH_FRAME: 'PUSH_FRAME',
  POP_FRAME: 'POP_FRAME',
  SET_VARIABLE: 'SET_VARIABLE',
  ALLOCATE_HEAP: 'ALLOCATE_HEAP',
  FREE_HEAP: 'FREE_HEAP',
  ADD_OUTPUT: 'ADD_OUTPUT',
  SET_LINE: 'SET_LINE',
  SET_STATUS: 'SET_STATUS',
  SET_ERROR: 'SET_ERROR'
};

// Reducer
function visualizationReducer(state, action) {
  switch (action.type) {
    case ACTIONS.RESET:
      return initialState;

    case ACTIONS.PUSH_FRAME:
      return {
        ...state,
        stack: [...state.stack, { 
          id: Date.now(), 
          name: action.payload.name, 
          variables: {} 
        }]
      };

    case ACTIONS.POP_FRAME:
      return {
        ...state,
        stack: state.stack.slice(0, -1)
      };

    case ACTIONS.SET_VARIABLE: {
      const { name, value, type, address } = action.payload;
      // Update variable in the top-most stack frame
      const currentStack = [...state.stack];
      const topFrameForVar = currentStack[currentStack.length - 1];
      
      if (!topFrameForVar) return state; // Safety check

      topFrameForVar.variables = {
        ...topFrameForVar.variables,
        [name]: { value, type, address }
      };

      return {
        ...state,
        stack: currentStack
      };
    }

    case ACTIONS.ALLOCATE_HEAP: {
      const { address, value } = action.payload;
      return {
        ...state,
        heap: {
          ...state.heap,
          [address]: value
        }
      };
    }

    case ACTIONS.FREE_HEAP: {
      const newHeap = { ...state.heap };
      delete newHeap[action.payload.address];
      return {
        ...state,
        heap: newHeap
      };
    }

    case ACTIONS.ADD_OUTPUT:
      return {
        ...state,
        output: [...state.output, action.payload]
      };

    case ACTIONS.SET_LINE:
      return {
        ...state,
        currentLine: action.payload
      };

    case ACTIONS.SET_STATUS:
      return {
        ...state,
        status: action.payload
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        status: 'ERROR'
      };

    default:
      return state;
  }
}

// Context
const VisualizationContext = createContext();

// Provider Component
export function VisualizationProvider({ children }) {
  const [state, dispatch] = useReducer(visualizationReducer, initialState);

  // Action Creators
  const reset = useCallback(() => dispatch({ type: ACTIONS.RESET }), []);
  
  const pushFrame = useCallback((name) => 
    dispatch({ type: ACTIONS.PUSH_FRAME, payload: { name } }), []);
  
  const popFrame = useCallback(() => 
    dispatch({ type: ACTIONS.POP_FRAME }), []);
  
  const setVariable = useCallback((name, value, type, address = null) => 
    dispatch({ type: ACTIONS.SET_VARIABLE, payload: { name, value, type, address } }), []);
  
  const allocateHeap = useCallback((address, value) => 
    dispatch({ type: ACTIONS.ALLOCATE_HEAP, payload: { address, value } }), []);
    
  const freeHeap = useCallback((address) => 
    dispatch({ type: ACTIONS.FREE_HEAP, payload: { address } }), []);
    
  const logOutput = useCallback((text) => 
    dispatch({ type: ACTIONS.ADD_OUTPUT, payload: text }), []);
    
  const setLine = useCallback((line) => 
    dispatch({ type: ACTIONS.SET_LINE, payload: line }), []);
    
  const setStatus = useCallback((status) => 
    dispatch({ type: ACTIONS.SET_STATUS, payload: status }), []);

  const setError = useCallback((error) => 
    dispatch({ type: ACTIONS.SET_ERROR, payload: error }), []);

  const value = {
    state,
    actions: {
      reset,
      pushFrame,
      popFrame,
      setVariable,
      allocateHeap,
      freeHeap,
      logOutput,
      setLine,
      setStatus,
      setError
    }
  };

  return (
    <VisualizationContext.Provider value={value}>
      {children}
    </VisualizationContext.Provider>
  );
}

// Custom Hook
export function useVisualization() {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error('useVisualization must be used within a VisualizationProvider');
  }
  return context;
}
