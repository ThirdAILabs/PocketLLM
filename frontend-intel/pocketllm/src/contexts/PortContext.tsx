import React, { createContext, useContext } from 'react';

type PortContextType = {
  port: number | null;
  setPort: React.Dispatch<React.SetStateAction<number | null>>;
};

const PortContext = createContext<PortContextType | undefined>(undefined);

export const usePort = () => {
  const context = useContext(PortContext);
  if (!context) {
    throw new Error('usePort must be used within a PortProvider');
  }
  return context;
};

interface PortProviderProps {
    children: React.ReactNode;
}

export const PortProvider: React.FC<PortProviderProps> = ({ children }) => {
    const [port, setPort] = React.useState<number | null>(null);

  return (
    <PortContext.Provider value={{ port, setPort }}>
      {children}
    </PortContext.Provider>
  );
};
