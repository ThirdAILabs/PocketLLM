// BackendControlContext.tsx

import React, { createContext, useContext, ReactNode } from 'react'

// Define the context's type
interface BackendControlContextType {
  restartBackend: () => Promise<void>;
}

// Create the context with an initial dummy function (or you could potentially make it optional)
const BackendControlContext = createContext<BackendControlContextType>({
  restartBackend: async () => { console.warn("restartBackend function not provided"); },
})

// Export the context
export { BackendControlContext };

// Custom hook for using the context
export const useBackendControl = () => useContext(BackendControlContext);

// Define props for your provider, including children and any additional props you expect
interface BackendControlProviderProps {
  children: ReactNode;
  restartBackend: () => Promise<void>;
}

export const BackendControlProvider: React.FC<BackendControlProviderProps> = ({ children, restartBackend }) => {

  return (
    <BackendControlContext.Provider value={{ restartBackend }}>
      {children}
    </BackendControlContext.Provider>
  );
};
