import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vetrx.app',
  appName: 'VetRx',
  webDir: 'dist',
  // Keep the packaged WebView origin on Capacitor's local HTTPS origin.
  // Android API routing and cookie behavior must be validated before release.
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
