import nodemailer from 'nodemailer';

interface ErrorLog {
  message: string;
  stack?: string;
  endpoint?: string;
  userAgent?: string;
  timestamp: string;
  context?: Record<string, any>;
}

const ADMIN_EMAIL = 'derickwowens@gmail.com';

// Create transporter - uses environment variables for SMTP config
const createTransporter = () => {
  // For production, use a service like SendGrid, Mailgun, or Gmail
  // For now, we'll use a simple SMTP setup or skip if not configured
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// In-memory error buffer for batching
let errorBuffer: ErrorLog[] = [];
let lastEmailSent = 0;
const EMAIL_COOLDOWN = 60000; // 1 minute between emails

export const logError = async (error: ErrorLog): Promise<void> => {
  // Always log to console
  console.error(`[ERROR] ${error.timestamp}`, {
    message: error.message,
    endpoint: error.endpoint,
    stack: error.stack,
  });

  // Add to buffer
  errorBuffer.push(error);

  // Try to send email if cooldown has passed
  const now = Date.now();
  if (now - lastEmailSent > EMAIL_COOLDOWN && errorBuffer.length > 0) {
    await sendErrorEmail();
  }
};

const sendErrorEmail = async (): Promise<void> => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('[ErrorLogger] SMTP not configured, skipping email notification');
    console.log('[ErrorLogger] Buffered errors:', errorBuffer.length);
    errorBuffer = []; // Clear buffer to prevent memory leak
    return;
  }

  const errors = [...errorBuffer];
  errorBuffer = [];
  lastEmailSent = Date.now();

  const errorSummary = errors.map(e => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Endpoint: ${e.endpoint || 'Unknown'}
⏰ Time: ${e.timestamp}
📱 User Agent: ${e.userAgent || 'Unknown'}

❌ Error: ${e.message}

📋 Stack:
${e.stack || 'No stack trace'}

📦 Context:
${JSON.stringify(e.context, null, 2) || 'None'}
`).join('\n');

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'tripagent@noreply.com',
      to: ADMIN_EMAIL,
      subject: `🚨 TripAgent Error Alert (${errors.length} error${errors.length > 1 ? 's' : ''})`,
      text: `TripAgent encountered ${errors.length} error(s):\n${errorSummary}`,
      html: `
        <h2>🚨 TripAgent Error Alert</h2>
        <p><strong>${errors.length}</strong> error(s) occurred:</p>
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">
${errorSummary}
        </pre>
      `,
    });
    console.log(`[ErrorLogger] Sent error notification email to ${ADMIN_EMAIL}`);
  } catch (emailError) {
    console.error('[ErrorLogger] Failed to send error email:', emailError);
  }
};

// Flush any remaining errors on process exit
process.on('beforeExit', async () => {
  if (errorBuffer.length > 0) {
    await sendErrorEmail();
  }
});

export default { logError };
