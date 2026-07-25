import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalshoes.app',
  appName: 'My Shoes',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F4D6DD',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // Privacy usage descriptions — all three are required for camera + photo library access
    infoPlist: {
      NSCameraUsageDescription:
        'My Shoes needs camera access so you can photograph shoes directly into your collection.',
      NSPhotoLibraryUsageDescription:
        'My Shoes reads your photo library so you can add shoe photos from your camera roll.',
      NSPhotoLibraryAddUsageDescription:
        'My Shoes saves captured shoe photos to your photo library.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F4D6DD',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4D6DD',
      overlaysWebView: true,
    },
  },
};

export default config;
