'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface BuilderContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
}

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

export const useBuilder = () => {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
};

interface BuilderProviderProps {
  children: React.ReactNode;
}

export const BuilderProvider = ({ children }: BuilderProviderProps) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  const setEditMode = useCallback((value: boolean) => {
    setIsEditMode(value);
  }, []);

  const value = useMemo(() => ({
    isEditMode,
    toggleEditMode,
    setEditMode,
  }), [isEditMode, toggleEditMode, setEditMode]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
};

export default BuilderContext;
