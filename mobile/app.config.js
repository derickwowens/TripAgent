export default ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';
  
  return {
    ...config,
    name: "TripAgent",
    slug: "tripagent",
    version: "1.7.3",
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
      bundleIdentifier: "com.tripagent.app"
    },
    android: {
      package: "com.tripagent.app",
      versionCode: 35,
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
      ]
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
