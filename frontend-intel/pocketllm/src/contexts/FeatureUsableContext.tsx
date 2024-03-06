// FeatureUsableContext.tsx

import { createContext } from 'react'

export interface FeatureUsableContextProps {
  isFeatureUsable: boolean,
  isPremiumAccount: boolean
}

// Set the initial state and updater function
const defaultState: FeatureUsableContextProps = {
  isFeatureUsable: true, // Default to true
  isPremiumAccount: false
};

export const FeatureUsableContext = createContext<FeatureUsableContextProps>(defaultState)
