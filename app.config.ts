import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'TruggTutor',
  slug: 'TruggTutor',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'truggtutor',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.truggtutor.app',
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'TruggTutor needs photo library access so you can import a photo of your homework worksheet onto a page.',
      NSCameraUsageDescription:
        'TruggTutor needs camera access so you can photograph your homework worksheet directly onto a page.',
    },
  },
  android: {
    package: 'com.truggtutor.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'TruggTutor needs photo library access so you can import a photo of your homework worksheet onto a page.',
        cameraPermission:
          'TruggTutor needs camera access so you can photograph your homework worksheet directly onto a page.',
      },
    ],
    './plugins/withPencilKitFramework',
  ],
  extra: {
    eas: {
      projectId: undefined,
    },
  },
};

export default config;
