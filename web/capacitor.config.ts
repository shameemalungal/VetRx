import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vetrx.app',
  appName: 'VetRx',
  webDir: 'dist',
  // Keep the packaged WebView origin separate from the production API host.
  // The Android build uses VITE_API_URL from .env.android.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: '#faf8ff',
      showSpinner: false,
    },
  },
};

export default config;
