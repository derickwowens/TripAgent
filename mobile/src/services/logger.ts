/**
 * Remote Logger Service
 * Sends errors and logs to Railway backend for monitoring
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

interface LogContext {
  userProfile?: string;
  screen?: string;
  action?: string;
  requestData?: any;
  responseData?: any;
  [key: string]: any;
}

interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  endpoint?: string;
  context?: LogContext;
  device?: {
    brand: string | null;
    model: string | null;
    os: string;
    osVersion: string | number;
    appVersion: string;
  };
  timestamp: string;
}

// Buffer for batching logs
let logBuffer: LogEntry[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 10;

const getDeviceInfo = () => ({
  brand: Device.brand,
  model: Device.modelName,
  os: Platform.OS,
  osVersion: Platform.Version,
  appVersion: Constants.expoConfig?.version || 'unknown',
});

const flushLogs = async () => {
  if (logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];
  logBuffer = [];

  try {
    // Send each log entry (backend handles batching for emails)
    for (const log of logsToSend) {
      await fetch(`${API_URL}/api/log-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: log.message,
          stack: log.stack,
          endpoint: log.endpoint,
          context: {
            ...log.context,
            level: log.level,
            device: log.device,
          },
        }),
      });
    }
  } catch (e) {
    // Don't throw - logging should never break the app
    console.warn('[Logger] Failed to send logs to server:', e);
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, FLUSH_INTERVAL);
};

const addToBuffer = (entry: LogEntry) => {
  logBuffer.push(entry);
  
  // Immediate flush for errors or if buffer is full
  if (entry.level === 'error' || logBuffer.length >= MAX_BUFFER_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushLogs();
  } else {
    scheduleFlush();
  }
};

export const logger = {
  /**
   * Log an error - sends immediately to server
   */
  error: (message: string, error?: Error | any, context?: LogContext) => {
    console.error(`[Error] ${message}`, error);
    
    addToBuffer({
      level: 'error',
      message,
      stack: error?.stack || error?.message || String(error),
      endpoint: context?.endpoint,
      context,
      device: getDeviceInfo(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log API errors with request/response details
   */
  apiError: (endpoint: string, error: any, requestData?: any, responseData?: any) => {
    console.error(`[API Error] ${endpoint}:`, error);
    
    addToBuffer({
      level: 'error',
      message: `API Error: ${endpoint}`,
      stack: error?.stack || error?.message || String(error),
      endpoint,
      context: {
        requestData: requestData ? JSON.stringify(requestData).slice(0, 500) : undefined,
        responseData: responseData ? JSON.stringify(responseData).slice(0, 500) : undefined,
        statusCode: error?.status || error?.statusCode,
      },
      device: getDeviceInfo(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log warnings - batched before sending
   */
  warn: (message: string, context?: LogContext) => {
    console.warn(`[Warn] ${message}`);
    
    addToBuffer({
      level: 'warn',
      message,
      context,
      device: getDeviceInfo(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log info - batched before sending (use sparingly)
   */
  info: (message: string, context?: LogContext) => {
    console.log(`[Info] ${message}`);
    
    addToBuffer({
      level: 'info',
      message,
      context,
      device: getDeviceInfo(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Force flush any pending logs
   */
  flush: flushLogs,
};

export default logger;
