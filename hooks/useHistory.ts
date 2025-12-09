import { useState, useCallback } from 'react';

export interface HistoryResult<T> {
  state: T;
  set: (newState: T) => void;
  push: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newState: T) => void;
}

export function useHistory<T>(initialState: T): HistoryResult<T> {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);

  // The current state is always derived from the history at the current index
  const state = history[index];

  // Updates the CURRENT state without adding a new history entry (e.g., while dragging a slider)
  const set = useCallback((newState: T) => {
    setHistory((prev) => {
      const copy = [...prev];
      copy[index] = newState;
      return copy;
    });
  }, [index]);

  // Pushes a NEW state to the history (e.g., on mouse up after sliding)
  const push = useCallback((newState: T) => {
    setHistory((prev) => {
      const past = prev.slice(0, index + 1);
      return [...past, newState];
    });
    setIndex((prev) => prev + 1);
  }, [index]);

  const undo = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
       // Check bounds inside setter to avoid race conditions
       if (index < prev.length - 1) {
           return prev; // Index update is handled below
       }
       return prev;
    });
    setIndex((prev) => Math.min(history.length - 1, prev + 1));
  }, [history.length, index]);
  
  const reset = useCallback((newState: T) => {
      setHistory([newState]);
      setIndex(0);
  }, []);

  return {
    state,
    set,
    push,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    reset
  };
}