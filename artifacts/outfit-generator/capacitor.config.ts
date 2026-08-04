import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalcloset.app',
  appName: 'My Digital Closet',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  server: {
    // Custom URL scheme for deep-link callbacks (email confirmation, password reset)
    // Supabase Auth redirect URL should be set to: mydigitalcloset://auth/callback
    iosScheme: 'mydigitalcloset',
  },

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
      // Required for camera access — missing key causes crash on iOS/iPadOS
      NSCameraUsageDescription: "My Digital Closet uses the camera so you can photograph clothing items to add to your wardrobe.",
      // Required for photo library access (read)
      NSPhotoLibraryUsageDescription: "My Digital Closet accesses your photo library so you can upload clothing photos to your wardrobe.",
      // Required for photo library write access — Capacitor Camera saves captured photos to the library
      NSPhotoLibraryAddUsageDescription: "My Digital Closet saves clothing photos to your photo library.",
      // Required for iOS 9+ to open third-party apps via URL scheme.
      // Without this list, UIApplication.canOpenURL returns false and the
      // share buttons for these apps silently do nothing.
      LSApplicationQueriesSchemes: [
        "fb",           // Facebook
        "instagram",    // Instagram
        "tiktok",       // TikTok
        "whatsapp",     // WhatsApp
        "twitter",      // X (Twitter)
      ],
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
