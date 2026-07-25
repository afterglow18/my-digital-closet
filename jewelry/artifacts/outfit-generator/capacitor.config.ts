import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitaljewelrybox.app',
  appName: 'My Jewelry',
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
    // Privacy usage descriptions — all three are required for camera + photo
    // library access; missing any one causes a SIGABRT crash or silent refusal
    infoPlist: {
      NSCameraUsageDescription:
        'My Jewelry Box uses the camera so you can photograph your jewelry pieces and add them to your collection.',
      NSPhotoLibraryUsageDescription:
        'My Jewelry Box reads your photo library so you can choose existing photos of your jewelry pieces.',
      NSPhotoLibraryAddUsageDescription:
        'My Jewelry Box saves photos you capture to your photo library so you can keep a copy.',
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
