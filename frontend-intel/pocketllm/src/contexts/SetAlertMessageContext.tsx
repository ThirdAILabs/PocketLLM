// SetAlertMessageContext.tsx
import React, { createContext, ReactNode } from 'react';

// Creating the context with a default noop function
const SetAlertMessageContext = createContext<(message: string) => void>(() => {});

interface SetAlertMessageProviderProps {
  children: ReactNode;
  setAlertMessage: (message: string) => void;
}

const SetAlertMessageProvider: React.FC<SetAlertMessageProviderProps> = ({ children, setAlertMessage }) => {
  return (
    <SetAlertMessageContext.Provider value={setAlertMessage}>
      {children}
    </SetAlertMessageContext.Provider>
  );
};

export { SetAlertMessageProvider, SetAlertMessageContext };
