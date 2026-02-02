export default ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';
  
  return {
    ...config,
    name: "TripAgent",
    slug: "tripagent",
    version: "2.3.2",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#166534"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tripagent.app",
      buildNumber: "14",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "TripAgent needs your location to find nearby parks, restaurants, and provide personalized travel recommendations.",
        NSSpeechRecognitionUsageDescription: "TripAgent uses speech recognition for voice input to make trip planning easier.",
        NSMicrophoneUsageDescription: "TripAgent needs microphone access to enable voice input for hands-free trip planning.",
        NSPhotoLibraryUsageDescription: "TripAgent needs access to your photo library to save and share trip photos.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.tripagent.app",
      versionCode: 55,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#166534"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "RECORD_AUDIO"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow TripAgent to use the microphone for voice input.",
          "speechRecognitionPermission": "Allow TripAgent to use speech recognition for voice input."
        }
      ],
      "@react-native-community/datetimepicker"
    ],
    extra: {
      eas: {
        projectId: "675e8ace-7c0e-42e4-9e04-d768a159871c"
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
    },
    owner: "derickwowens"
  };
};
