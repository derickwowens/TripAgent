import { Platform } from 'react-native';

/**
 * Platform-specific app name
 * - iOS: "Adventure Agent" (App Store name, "TripAgent" was taken)
 * - Android: "TripAgent"
 */
export const APP_NAME = Platform.OS === 'ios' ? 'Adventure Agent' : 'TripAgent';

/**
 * Internal app identifier (used for storage keys, etc.)
 * This stays consistent across platforms
 */
export const APP_ID = 'TripAgent';
