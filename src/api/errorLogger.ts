interface ErrorLog {
  message: string;
  stack?: string;
  endpoint?: string;
  userAgent?: string;
  timestamp: string;
  context?: Record<string, any>;
}

const ADMIN_EMAIL = 'derickwowens@gmail.com';

// In-memory error buffer for batching
let errorBuffer: ErrorLog[] = [];
let lastNotificationSent = 0;
const NOTIFICATION_COOLDOWN = 60000; // 1 minute between notifications

export const logError = async (error: ErrorLog): Promise<void> => {
  // Always log to console with full details
  console.error(`[ERROR] ${error.timestamp}`, {
    message: error.message,
    endpoint: error.endpoint,
    stack: error.stack,
    context: error.context,
  });

  // Add to buffer
  errorBuffer.push(error);

  // Try to send notification if cooldown has passed
  const now = Date.now();
  if (now - lastNotificationSent > NOTIFICATION_COOLDOWN && errorBuffer.length > 0) {
    await sendErrorNotification();
  }
};

const sendErrorNotification = async (): Promise<void> => {
  const errors = [...errorBuffer];
  errorBuffer = [];
  lastNotificationSent = Date.now();

  const errorSummary = errors.map(e => ({
    endpoint: e.endpoint || 'Unknown',
    time: e.timestamp,
    error: e.message,
    context: e.context,
  }));

  // Use FormSubmit.co to send email without SMTP config
  try {
    const response = await fetch('https://formsubmit.co/ajax/derickwowens@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        _subject: `🚨 TripAgent Error Alert (${errors.length} error${errors.length > 1 ? 's' : ''})`,
        error_count: errors.length,
        errors: JSON.stringify(errorSummary, null, 2),
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log(`[ErrorLogger] Sent error notification email to ${ADMIN_EMAIL}`);
    } else {
      console.error('[ErrorLogger] Failed to send error notification:', await response.text());
    }
  } catch (notifyError) {
    console.error('[ErrorLogger] Failed to send error notification:', notifyError);
  }
};

// Flush any remaining errors on process exit
process.on('beforeExit', async () => {
  if (errorBuffer.length > 0) {
    await sendErrorNotification();
  }
});

export default { logError };
