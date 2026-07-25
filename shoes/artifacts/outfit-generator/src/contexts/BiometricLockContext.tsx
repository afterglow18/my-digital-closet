/**
 * BiometricLockContext — makes lock state available to Settings page
 * without prop drilling. The actual lock UI lives in App.tsx.
 */
import { createContext, useContext } from 'react';
import type { BiometricResult } from '@/lib/biometric';

export interface BiometricLockContextValue {
  enabled: boolean;
  enableLock: () => Promise<BiometricResult>;
  disableLock: () => Promise<BiometricResult>;
}

export const BiometricLockContext = createContext<BiometricLockContextValue>({
  enabled: false,
  enableLock: async () => 'unavailable',
  disableLock: async () => 'unavailable',
});

export function useBiometricLockContext(): BiometricLockContextValue {
  return useContext(BiometricLockContext);
}
