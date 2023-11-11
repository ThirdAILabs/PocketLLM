// FeatureUsableContext.tsx

import { createContext } from 'react';

export interface FeatureUsableContextProps {
  isFeatureUsable: boolean
}

// Set the initial state and updater function
const defaultState: FeatureUsableContextProps = {
  isFeatureUsable: true, // Default to true
};

export const FeatureUsableContext = createContext<FeatureUsableContextProps>(defaultState);
