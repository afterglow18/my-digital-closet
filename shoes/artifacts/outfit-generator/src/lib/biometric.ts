/**
 * Thin wrapper around @aparajita/capacitor-biometric-auth.
 * Falls back to "always success" in web / dev environments.
 */
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

function isNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export type BiometricResult = 'success' | 'cancelled' | 'unavailable';

/** Returns true if the device can do Face ID or Touch ID. */
export async function checkBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication.
 * In web / dev mode always returns 'success' so the toggle is testable.
 */
export async function authenticateBiometric(
  reason: string,
): Promise<BiometricResult> {
  if (!isNative()) return 'success';
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: false,
      iosFallbackTitle: '',
    });
    return 'success';
  } catch (err: any) {
    // userCancel / systemCancel / appCancel
    const code: string = err?.code ?? err?.message ?? '';
    if (
      code.includes('userCancel') ||
      code.includes('systemCancel') ||
      code.includes('appCancel') ||
      code === '13' // LAErrorUserCancel
    ) {
      return 'cancelled';
    }
    return 'unavailable';
  }
}
