import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalcloset.app',
  appName: 'My Closet',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#FFFDF7',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // Export compliance — app uses only standard HTTPS; no custom encryption
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Required for Face ID — App Store will reject without this key
      NSFaceIDUsageDescription: "My Digital Closet uses Face ID to keep your wardrobe private.",
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#FFFDF7',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFFDF7',
      overlaysWebView: true,
    },
  },
};

export default config;
