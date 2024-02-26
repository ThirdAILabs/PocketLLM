// FeatureUsableContext.tsx

import { createContext } from 'react';

export interface FeatureUsableContextProps {
  isPremiumAccount: boolean
}

// Set the initial state and updater function
const defaultState: FeatureUsableContextProps = {
  isPremiumAccount: false
};

export const FeatureUsableContext = createContext<FeatureUsableContextProps>(defaultState);
